
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import TileForm, { createInitialDefaultFormValues, type TileFormData, typeConfig } from '@/components/TileForm';
import TileList from '@/components/TileList';
import type { GroupedDisplayTile, FirebaseTileDoc, TileVariantDisplay } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import { getFirebaseInstances } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, writeBatch, where, getDocs } from 'firebase/firestore';
import { useAuth, registerFirestoreUnsubscriber } from '@/context/AuthContext';


const InventoryPage: FC = () => {
  const { user, isInitializing } = useAuth();
  const [tiles, setTiles] = useState<FirebaseTileDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTileGroup, setEditingTileGroup] = useState<GroupedDisplayTile | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');

  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (isInitializing || !user) {
      // Wait for auth to initialize or user to be available
      // If no user, AuthContext/layout should redirect
      if (!isInitializing && !user) setIsLoading(false); // Stop loading if auth is done and no user
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | null = null;

    const setupFirestoreListener = async () => {
      try {
        const { db } = await getFirebaseInstances();
        if (!db) {
          throw new Error("Firestore is not initialized.");
        }
        const tilesCollection = collection(db, 'tiles');
        const q = query(tilesCollection, orderBy('createdAt', 'desc'));

        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedTiles: FirebaseTileDoc[] = [];
          querySnapshot.forEach((doc) => {
            fetchedTiles.push({ id: doc.id, ...doc.data() } as FirebaseTileDoc);
          });
          setTiles(fetchedTiles);
          setIsLoading(false);
          setError(null);
        }, (err) => {
          console.error("Error fetching tiles:", err);
          setError(t('errorMessages.fetchErrorDescription'));
          setIsLoading(false);
          toast({ title: t('errorMessages.fetchErrorTitle'), description: t('errorMessages.fetchErrorDescription'), variant: 'destructive' });
        });
        registerFirestoreUnsubscriber(unsubscribe); // Register for cleanup on logout
      } catch (e) {
        console.error("Firestore setup error:", e);
        setError(t('errorMessages.fetchErrorDescription'));
        setIsLoading(false);
        toast({ title: t('errorMessages.fetchErrorTitle'), description: (e as Error).message, variant: 'destructive' });
         registerFirestoreUnsubscriber(null);
      }
    };

    setupFirestoreListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
        registerFirestoreUnsubscriber(null); // Clear global reference on component unmount
      }
    };
  }, [user, isInitializing, t, toast]);


  const groupedTilesData = useMemo((): GroupedDisplayTile[] => {
    const groups: Record<string, GroupedDisplayTile> = {};
    tiles.forEach(tile => {
      const prefix = tile.modelNumberPrefix || "N/A"; // Ensure prefix is never undefined for key
      const groupKey = `${prefix}_${tile.width}x${tile.height}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          modelNumberPrefix: prefix,
          width: tile.width,
          height: tile.height,
          variants: [],
          groupCreatedAt: tile.createdAt?.toDate()
        };
      }

      groups[groupKey].variants.push({
        id: tile.id,
        typeSuffix: tile.typeSuffix === "" ? t('noTypeSuffix') : tile.typeSuffix,
        quantity: tile.quantity,
        createdAt: tile.createdAt?.toDate()
      });
      
      if (tile.createdAt?.toDate() && (!groups[groupKey].groupCreatedAt || tile.createdAt.toDate() < groups[groupKey].groupCreatedAt!)) {
        groups[groupKey].groupCreatedAt = tile.createdAt.toDate();
      }
    });
    
    Object.values(groups).forEach(group => {
      group.variants.sort((a, b) => a.typeSuffix.localeCompare(b.typeSuffix));
    });

    return Object.values(groups).sort((a,b) => (b.groupCreatedAt?.getTime() || 0) - (a.groupCreatedAt?.getTime() || 0));
  }, [tiles, t]);

  const initialFormValues = useMemo(() => {
    if (formMode === 'edit' && editingTileGroup) {
      const formData: any = {
        modelNumberPrefix: editingTileGroup.modelNumberPrefix === "N/A" ? undefined : editingTileGroup.modelNumberPrefix,
        width: editingTileGroup.width,
        height: editingTileGroup.height,
        quantity: undefined, // Global quantity not used when types are present for a group
      };
      typeConfig.forEach(sf => {
        const variant = editingTileGroup.variants.find(v => v.typeSuffix === sf.label || (sf.label === t('noTypeSuffix') && v.typeSuffix === ""));
        formData[sf.name] = !!variant;
        formData[sf.quantityName] = variant ? variant.quantity : undefined;
      });
      return formData as TileFormData;
    }
    return createInitialDefaultFormValues();
  }, [formMode, editingTileGroup, t]);


  const handleSaveTile = async (data: TileFormData) => {
    setIsLoading(true);
    try {
        const { db } = await getFirebaseInstances();
        if (!db) throw new Error("Firestore not initialized");
        const batch = writeBatch(db);

        const now = serverTimestamp();
        const modelPrefixToSave = data.modelNumberPrefix === undefined || String(data.modelNumberPrefix).trim() === "" ? "N/A" : String(data.modelNumberPrefix);
        
        const variantsToProcess: Array<Partial<FirebaseTileDoc> & { originalId?: string }> = [];
        let anyVariantProcessed = false;

        // Case 1: Types are selected
        const checkedTypes = typeConfig.filter(sf => data[sf.name]);
        if (checkedTypes.length > 0) {
            for (const type of checkedTypes) {
                const quantityForType = data[type.quantityName];
                if (quantityForType !== undefined && quantityForType > 0) {
                    variantsToProcess.push({
                        modelNumberPrefix: modelPrefixToSave,
                        typeSuffix: type.key,
                        width: data.width,
                        height: data.height,
                        quantity: quantityForType,
                    });
                    anyVariantProcessed = true;
                }
            }
        } 
        // Case 2: No types selected, but prefix and global quantity exist (base model)
        else if (modelPrefixToSave !== "N/A" && data.quantity !== undefined && data.quantity > 0) {
             variantsToProcess.push({
                modelNumberPrefix: modelPrefixToSave,
                typeSuffix: "", // Empty string for base model
                width: data.width,
                height: data.height,
                quantity: data.quantity,
            });
            anyVariantProcessed = true;
        }
        
        if (!anyVariantProcessed) {
            toast({ title: t('saveErrorTitle'), description: t('saveErrorNoModelOrQuantity'), variant: 'destructive' });
            setIsLoading(false);
            return;
        }

        if (formMode === 'edit' && editingTileGroup) {
            // In edit mode, we need to find existing documents to update or delete, and add new ones.
            const existingVariants = editingTileGroup.variants;
            const variantsInFormMap = new Map(variantsToProcess.map(v => [v.typeSuffix, v]));

            // Update existing or add new
            for (const variantData of variantsToProcess) {
                const existingVariant = existingVariants.find(ev => ev.typeSuffix === variantData.typeSuffix || (variantData.typeSuffix === "" && ev.typeSuffix === t('noTypeSuffix')));
                if (existingVariant) { // Update
                    const docRef = doc(db, 'tiles', existingVariant.id);
                    batch.update(docRef, { ...variantData, updatedAt: now });
                } else { // Add new
                    const docRef = doc(collection(db, 'tiles'));
                    batch.set(docRef, { ...variantData, createdAt: now, updatedAt: now });
                }
            }
            // Delete variants that were in the group but are no longer in the form
            for (const existing of existingVariants) {
                 const typeSuffixInForm = existing.typeSuffix === t('noTypeSuffix') ? "" : existing.typeSuffix;
                if (!variantsInFormMap.has(typeSuffixInForm)) {
                    const docRef = doc(db, 'tiles', existing.id);
                    batch.delete(docRef);
                }
            }
            toast({ title: t('toastGroupUpdatedTitle'), description: t('toastGroupUpdatedDescription', {modelNumberPrefix: editingTileGroup.modelNumberPrefix }) });
        } else { // Add mode
            const modelNumbersAdded: string[] = [];
            for (const variantData of variantsToProcess) {
                const docRef = doc(collection(db, 'tiles'));
                batch.set(docRef, { ...variantData, createdAt: now, updatedAt: now });
                modelNumbersAdded.push(`${variantData.modelNumberPrefix !== "N/A" ? variantData.modelNumberPrefix + "-" : ""}${variantData.typeSuffix || "Base"}`);
            }
             toast({ title: t('toastTileAddedTitle'), description: t('toastTilesAddedDescription', { count: modelNumbersAdded.length.toString(), modelNumbers: modelNumbersAdded.join(', ') }) });
        }

        await batch.commit();
        setIsFormOpen(false);
        setEditingTileGroup(null);
    } catch (e) {
        console.error("Error saving tile(s):", e);
        toast({ title: t('saveErrorTitle'), description: t('saveErrorDescription') + `: ${(e as Error).message}`, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
};


  const handleEditGroup = (group: GroupedDisplayTile) => {
    setEditingTileGroup(group);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteGroup = async (group: GroupedDisplayTile) => {
    setIsLoading(true);
    try {
      const { db } = await getFirebaseInstances();
      if (!db) throw new Error("Firestore not initialized");

      if (!group.variants || group.variants.length === 0) {
        toast({ title: t('deleteErrorTitle'), description: t('deleteErrorGroupNotFound'), variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const batch = writeBatch(db);
      group.variants.forEach(variant => {
        const docRef = doc(db, 'tiles', variant.id);
        batch.delete(docRef);
      });
      await batch.commit();

      toast({ title: t('toastGroupDeletedTitle'), description: t('toastGroupDeletedDescription', { modelNumberPrefix: group.modelNumberPrefix }) });
    } catch (e) {
      console.error("Error deleting group:", e);
      toast({ title: t('deleteErrorTitle'), description: t('deleteErrorGroupDescription') + `: ${(e as Error).message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditingTileGroup(null);
    setFormMode('add');
    setIsFormOpen(true);
  };

  if (isInitializing) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('tileListCardTitle')}</h2>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) setEditingTileGroup(null); // Reset editing state when dialog closes
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('addNewTile')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>
                {formMode === 'edit' ? t('tileFormCardTitleEditGroup') : t('tileFormCardTitleAdd')}
              </DialogTitle>
              <DialogDescription>
                {formMode === 'edit' ? t('tileFormCardDescriptionEditGroup') : t('tileFormCardDescriptionAdd')}
              </DialogDescription>
            </DialogHeader>
            {/* Scrollable Area for Form Content */}
             <div className="flex-grow overflow-y-auto px-1 pb-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <TileForm
                    onSaveTile={handleSaveTile}
                    initialValues={initialFormValues}
                    onCancelEdit={() => {
                        setIsFormOpen(false);
                        setEditingTileGroup(null);
                    }}
                    isEditMode={formMode === 'edit'}
                    isGroupEdit={formMode === 'edit'} // For TileForm, editing a group is the only edit mode now
                />
            </div>

          </DialogContent>
        </Dialog>
      </div>

      {isLoading && !tiles.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-3 animate-pulse">
                <div className="h-6 w-3/4 bg-muted rounded"></div>
                <div className="h-4 w-1/2 bg-muted rounded"></div>
                <div className="space-y-2 pt-2">
                    <div className="h-8 w-full bg-muted/50 rounded"></div>
                    <div className="h-8 w-full bg-muted/50 rounded"></div>
                </div>
                <div className="h-9 w-full bg-muted rounded mt-3"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-center">{error}</p>
      ) : (
        <TileList
          groupedTiles={groupedTilesData}
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      )}
    </div>
  );
};

export default InventoryPage;
