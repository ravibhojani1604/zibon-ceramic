'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import TileForm, { type TileFormData } from '@/components/TileForm';
import {typeConfig, createInitialDefaultFormValues} from '@/components/TileForm';
import TileList from '@/components/TileList';
import type { GroupedDisplayTile, FirebaseTileDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import { getFirebaseInstances } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, writeBatch, where, getDocs, FirestoreError } from 'firebase/firestore';
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
    let localUnsubscribe: (() => void) | null = null;
  
    if (isInitializing || !user) {
      setIsLoading(false);
      setTiles([]); 
      setError(null);
      // Cleanup for previous effect run if user became null or isInitializing became true
      // This is handled by the return function of useEffect
      return;
    }
  
    setIsLoading(true);
    const setupFirestoreListener = async () => {
      try {
        const { db } = await getFirebaseInstances();
        if (!db) {
          throw new Error("Firestore is not initialized.");
        }
        const tilesCollection = collection(db, 'tiles');
        const q = query(tilesCollection, orderBy('createdAt', 'desc'));
  
        localUnsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedTiles: FirebaseTileDoc[] = [];
          querySnapshot.forEach((doc) => {
            fetchedTiles.push({ id: doc.id, ...doc.data() } as FirebaseTileDoc);
          });
          setTiles(fetchedTiles);
          setIsLoading(false);
          setError(null);
        }, (err: FirestoreError) => {
          console.error("Error fetching tiles:", err.code, err.message);
          // Check if the user object (from the closure of this effect) was present when the listener was set up.
          // This helps differentiate between a normal fetch error and a permission error due to logout.
          if (user) { 
            if (err.code === 'permission-denied') {
              // If permission is denied, it's likely due to logout. Suppress user-facing toast.
              console.warn("Firestore permission denied. This might be due to logout. Suppressing fetch error toast.");
              // Optionally, clear tiles and set a soft error message if needed, but generally,
              // the app will redirect, making a persistent error message unnecessary.
              setTiles([]); // Clear tiles as access is lost
            } else {
              // For other errors, show the toast.
              setError(t('errorMessages.fetchErrorDescription'));
              toast({ title: t('errorMessages.fetchErrorTitle'), description: t('errorMessages.fetchErrorDescription'), variant: 'destructive' });
            }
          }
          setIsLoading(false);
        });
        registerFirestoreUnsubscriber(localUnsubscribe); 
      } catch (e) {
        console.error("Firestore setup error:", e);
        setError(t('errorMessages.fetchErrorDescription'));
        setIsLoading(false);
        if (user) { // Only toast if we expected to fetch
           toast({ title: t('errorMessages.fetchErrorTitle'), description: (e as Error).message, variant: 'destructive' });
        }
        registerFirestoreUnsubscriber(null);
      }
    };
  
    setupFirestoreListener();
  
    return () => {
      if (localUnsubscribe) {
        localUnsubscribe();
        console.log('InventoryPage: Local Firestore listener unsubscribed.');
      }
      // When the component unmounts or dependencies change leading to cleanup,
      // ensure the global unsubscriber reference is also cleared if this instance set it.
      registerFirestoreUnsubscriber(null); 
    };
  }, [user, isInitializing, t, toast]);


  const groupedTilesData = useMemo((): GroupedDisplayTile[] => {
    const groups: Record<string, GroupedDisplayTile> = {};
    tiles.forEach(tile => {
      const prefix = tile.modelNumberPrefix || "N/A"; 
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
        quantity: undefined, 
      };
      typeConfig.forEach(sf => {
        const variant = editingTileGroup.variants.find(v => v.typeSuffix === sf.label || (sf.label === t('noTypeSuffix') && v.typeSuffix === t('noTypeSuffix')));
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
        else if (modelPrefixToSave !== "N/A" && data.quantity !== undefined && data.quantity > 0) {
             variantsToProcess.push({
                modelNumberPrefix: modelPrefixToSave,
                typeSuffix: "", 
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
            const existingVariants = editingTileGroup.variants;
            const variantsInFormMap = new Map(variantsToProcess.map(v => [v.typeSuffix, v]));

            for (const variantData of variantsToProcess) {
                const existingVariant = existingVariants.find(ev => ev.typeSuffix === variantData.typeSuffix || (variantData.typeSuffix === "" && ev.typeSuffix === t('noTypeSuffix')));
                if (existingVariant) { 
                    const docRef = doc(db, 'tiles', existingVariant.id);
                    batch.update(docRef, { ...variantData, updatedAt: now });
                } else { 
                    const docRef = doc(collection(db, 'tiles'));
                    batch.set(docRef, { ...variantData, createdAt: now, updatedAt: now });
                }
            }
            for (const existing of existingVariants) {
                 const typeSuffixInForm = existing.typeSuffix === t('noTypeSuffix') ? "" : existing.typeSuffix;
                if (!variantsInFormMap.has(typeSuffixInForm)) {
                    const docRef = doc(db, 'tiles', existing.id);
                    batch.delete(docRef);
                }
            }
            toast({ title: t('toastGroupUpdatedTitle'), description: t('toastGroupUpdatedDescription', {modelNumberPrefix: editingTileGroup.modelNumberPrefix }) });
        } else { 
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

  if (isInitializing && !user) { // Show full page loader only if initializing and no user yet
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="flex items-center justify-center mb-6">
           <svg
            className="h-16 w-16 text-primary animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-ai-hint="ceramic tile"
          >
            <path d="M3 3h7v7H3z" />
            <path d="M14 3h7v7h-7z" />
            <path d="M3 14h7v7H3z" />
            <path d="M14 14h7v7h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">{t('appTitle')}</h1>
        <p className="text-muted-foreground mb-6">{t('authForm.loadingPage')}</p>
        <div className="w-full max-w-xs space-y-3">
          <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
          <div className="h-6 w-3/4 mx-auto bg-muted rounded-md animate-pulse" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('tileListCardTitle')}</h2>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) setEditingTileGroup(null); 
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
             <div className="flex-grow overflow-y-auto px-1 pb-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <TileForm
                    onSaveTile={handleSaveTile}
                    initialValues={initialFormValues}
                    onCancelEdit={() => {
                        setIsFormOpen(false);
                        setEditingTileGroup(null);
                    }}
                    isEditMode={formMode === 'edit'}
                    isGroupEdit={formMode === 'edit'} 
                />
            </div>

          </DialogContent>
        </Dialog>
      </div>

      {isLoading && !tiles.length && user ? ( // Show skeleton only if loading, no tiles yet, and user is present
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
