'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import TileForm, { type TileFormData, createInitialDefaultFormValues } from '@/components/TileForm';
import { typeConfig } from '@/components/TileForm'; // Explicitly import typeConfig
import TileList, { ITEMS_PER_PAGE_OPTIONS } from '@/components/TileList'; // Import ITEMS_PER_PAGE_OPTIONS
import type { GroupedDisplayTile, FirebaseTileDoc } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import { getFirebaseInstances } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  Timestamp, 
  serverTimestamp, 
  writeBatch, 
  FirestoreError,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  getCountFromServer,
  type DocumentSnapshot,
  type Query
} from 'firebase/firestore';
import { useAuth, registerFirestoreUnsubscriber } from '@/context/AuthContext';
import { cn } from '@/lib/utils';


const InventoryPage: FC = () => {
  const { user, isInitializing: authIsInitializing } = useAuth(); 
  const [tiles, setTiles] = useState<FirebaseTileDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTileGroup, setEditingTileGroup] = useState<GroupedDisplayTile | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [clientMounted, setClientMounted] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[1]); // Default to 10
  const [totalTileDocs, setTotalTileDocs] = useState(0);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<DocumentSnapshot | null>(null);
  const [queryDirection, setQueryDirection] = useState<'initial' | 'next' | 'prev'>('initial');
  const [isFetchingPageData, setIsFetchingPageData] = useState(false);


  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    setClientMounted(true);
  }, []);

  // Effect for initial total count
  useEffect(() => {
    if (authIsInitializing || !user) return;

    const fetchTotalCount = async () => {
      try {
        const { db } = await getFirebaseInstances();
        const tilesCollection = collection(db, 'tiles');
        const countSnapshot = await getCountFromServer(tilesCollection);
        setTotalTileDocs(countSnapshot.data().count);
      } catch (e) {
        console.error("Error fetching total tile count:", e);
        setError(t('errorMessages.fetchErrorDescription'));
        toast({ title: t('errorMessages.fetchErrorTitle'), description: (e as Error).message, variant: 'destructive' });
      }
    };
    fetchTotalCount();
  }, [user, authIsInitializing, t, toast]);


  useEffect(() => {
    let localUnsubscribe: (() => void) | null = null;
  
    if (authIsInitializing || !user) {
      setIsLoading(false); 
      setTiles([]); 
      setError(null);
      if (localUnsubscribe) localUnsubscribe();
      registerFirestoreUnsubscriber(null);
      return;
    }
  
    // Only proceed if totalTileDocs is fetched (or it's an explicit page change action)
    if (totalTileDocs === 0 && queryDirection === 'initial' && currentPage !== 1) {
       setIsLoading(true); // Waiting for total count before first real fetch
       return;
    }

    setIsFetchingPageData(true);
    // For the very first load, general isLoading is true. For subsequent page fetches, use isFetchingPageData.
    if (queryDirection === 'initial' && currentPage === 1) setIsLoading(true);


    const setupFirestoreListener = async () => {
      try {
        const { db } = await getFirebaseInstances();
        if (!db) {
          throw new Error("Firestore is not initialized.");
        }
        const tilesCollectionRef = collection(db, 'tiles');
        let q: Query;

        if (queryDirection === 'initial' || currentPage === 1) {
          q = query(tilesCollectionRef, orderBy('createdAt', 'desc'), limit(itemsPerPage));
        } else if (queryDirection === 'next' && lastVisibleDoc) {
          q = query(tilesCollectionRef, orderBy('createdAt', 'desc'), startAfter(lastVisibleDoc), limit(itemsPerPage));
        } else if (queryDirection === 'prev' && firstVisibleDoc) {
          q = query(tilesCollectionRef, orderBy('createdAt', 'desc'), endBefore(firstVisibleDoc), limitToLast(itemsPerPage));
        } else {
          // Fallback / edge case: if cursors are missing, default to first page logic
          console.warn("Pagination cursors missing or invalid direction, defaulting to first page.");
          q = query(tilesCollectionRef, orderBy('createdAt', 'desc'), limit(itemsPerPage));
          if (currentPage !== 1) setCurrentPage(1); // Reset to page 1 if cursors lost
        }
  
        localUnsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedTiles: FirebaseTileDoc[] = [];
          querySnapshot.forEach((docSnap) => { // Renamed doc to docSnap to avoid conflict
            fetchedTiles.push({ id: docSnap.id, ...docSnap.data() } as FirebaseTileDoc);
          });
          setTiles(fetchedTiles);

          if (!querySnapshot.empty) {
            setFirstVisibleDoc(querySnapshot.docs[0]);
            setLastVisibleDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
          } else {
            // If the current page is empty
            if (queryDirection === 'next') setLastVisibleDoc(null); // No more "next"
            if (queryDirection === 'prev') setFirstVisibleDoc(null); // No more "prev"
            // If it was an initial load for page 1 and it's empty, both will be null
            if (currentPage === 1) {
              setFirstVisibleDoc(null);
              setLastVisibleDoc(null);
            }
          }

          setIsLoading(false);
          setIsFetchingPageData(false);
          setError(null);
        }, (err: FirestoreError) => {
          console.error("Error fetching tiles:", err.code, err.message);
          if (user) { 
            if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
              console.warn("Firestore permission denied or unauthenticated. This might be due to logout. Suppressing fetch error toast.");
              setTiles([]); // Clear tiles on permission error if user context is still somehow present
            } else {
              setError(t('errorMessages.fetchErrorDescription'));
              toast({ title: t('errorMessages.fetchErrorTitle'), description: t('errorMessages.fetchErrorDescription'), variant: 'destructive' });
            }
          }
          setIsLoading(false);
          setIsFetchingPageData(false);
        });
        registerFirestoreUnsubscriber(localUnsubscribe); 
      } catch (e) {
        console.error("Firestore setup error:", e);
        setError(t('errorMessages.fetchErrorDescription'));
        setIsLoading(false);
        setIsFetchingPageData(false);
        if (user) { 
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
      registerFirestoreUnsubscriber(null); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authIsInitializing, t, toast, currentPage, itemsPerPage, queryDirection, totalTileDocs]); // Added queryDirection and totalTileDocs


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
      const typeConfigEntry = typeConfig.find(tc => tc.key === tile.typeSuffix);
      const displayTypeSuffix = tile.typeSuffix === "" 
        ? t('noTypeSuffix') 
        : (typeConfigEntry ? typeConfigEntry.label : tile.typeSuffix);

      groups[groupKey].variants.push({
        id: tile.id,
        typeSuffix: displayTypeSuffix, 
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
      const formData: Partial<TileFormData> = { 
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

        const checkedTypes = typeConfig.filter(sf => data[sf.name as keyof TileFormData]);
        if (checkedTypes.length > 0) {
            for (const type of checkedTypes) { 
                const quantityForType = data[type.quantityName as keyof TileFormData];
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
                const correspondingTypeConfig = typeConfig.find(tc => tc.key === variantData.typeSuffix);
                const labelForMatching = correspondingTypeConfig ? correspondingTypeConfig.label : (variantData.typeSuffix === "" ? t('noTypeSuffix') : variantData.typeSuffix);

                const existingVariant = existingVariants.find(ev => ev.typeSuffix === labelForMatching);

                if (existingVariant) { 
                    const docRef = doc(db, 'tiles', existingVariant.id);
                    batch.update(docRef, { ...variantData, updatedAt: now }); 
                } else { 
                    const docRef = doc(collection(db, 'tiles'));
                    batch.set(docRef, { ...variantData, createdAt: now, updatedAt: now }); 
                }
            }
            for (const existing of existingVariants) { 
                 const keyInForm = typeConfig.find(tc => tc.label === existing.typeSuffix)?.key ?? (existing.typeSuffix === t('noTypeSuffix') ? "" : null);
                if (keyInForm === null || !variantsInFormMap.has(keyInForm)) {
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
                const labelForDisplay = typeConfig.find(tc => tc.key === variantData.typeSuffix)?.label ?? "Base";
                modelNumbersAdded.push(`${variantData.modelNumberPrefix !== "N/A" ? variantData.modelNumberPrefix + "-" : ""}${labelForDisplay}`);
            }
             toast({ title: t('toastTileAddedTitle'), description: t('toastTilesAddedDescription', { count: modelNumbersAdded.length.toString(), modelNumbers: modelNumbersAdded.join(', ') }) });
        }

        await batch.commit();
        // Refetch total count as data has changed.
        const countSnapshot = await getCountFromServer(collection(db, 'tiles'));
        setTotalTileDocs(countSnapshot.data().count);

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

      const batchCommit = writeBatch(db); // Renamed batch to batchCommit
      group.variants.forEach(variant => {
        const docRef = doc(db, 'tiles', variant.id);
        batchCommit.delete(docRef);
      });
      await batchCommit.commit();
       // Refetch total count as data has changed.
      const countSnapshot = await getCountFromServer(collection(db, 'tiles'));
      setTotalTileDocs(countSnapshot.data().count);


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

  const handlePageChange = (newPage: number, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (newPage === currentPage && direction !== 'initial') return; // No change if already on page, unless it's an initial set
    setQueryDirection(direction);
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setQueryDirection('initial'); // Reset direction
    setCurrentPage(1); // Go to first page
    setFirstVisibleDoc(null); // Reset cursors
    setLastVisibleDoc(null);
  };


  if (authIsInitializing && !user && clientMounted) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="flex items-center justify-center mb-6">
           <svg
            className={cn(
              "h-16 w-16 text-primary",
              { 'animate-spin': clientMounted && authIsInitializing }
            )}
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
        <div className="w-full max-w-xs space-y-3 mx-auto">
          <div className={cn("h-10 w-full bg-muted rounded-md", { 'animate-pulse': clientMounted && authIsInitializing })} />
          <div className={cn("h-6 w-3/4 mx-auto bg-muted rounded-md", { 'animate-pulse': clientMounted && authIsInitializing })} />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-2xl font-semibold tracking-tight text-center sm:text-left">{t('tileListCardTitle')}</h2>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) setEditingTileGroup(null); 
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> {t('addNewTile')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader className="px-6 pt-6 sticky top-0 bg-background z-10 border-b pb-4">
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

      {isLoading && clientMounted && tiles.length === 0 ? ( 
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(itemsPerPage > 3 ? 3 : itemsPerPage)].map((_, i) => ( // Show up to 3 skeletons or itemsPerPage
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
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalTileDocs={totalTileDocs}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isFetchingPageData} // Pass the new loading state for pagination
        />
      )}
    </div>
  );
};

export default InventoryPage;
