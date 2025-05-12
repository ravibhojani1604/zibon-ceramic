'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import TileForm, { createInitialDefaultFormValues, typeConfig as tileFormTypeConfig } from '@/components/TileForm';
import type { TileFormData } from '@/components/TileForm';
import TileList, { ITEMS_PER_PAGE_OPTIONS } from '@/components/TileList';
import type { GroupedDisplayTile, FirebaseTileDoc, TileVariantDisplay } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Edit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/i18n';
import { usePaginatedTiles } from '@/hooks/usePaginatedTiles'; // Import the new hook
import { getFirebaseInstances } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext'; // Assuming useAuth provides user

const InventoryPage: FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth(); // Get user from AuthContext

  const {
    tiles: fetchedTiles, // Rename to avoid conflict if needed
    isLoading: isLoadingTiles,
    error: fetchError,
    itemsPerPage,
    currentPage,
    totalTileDocs,
    isFirstPage,
    isLastPage,
    handleItemsPerPageChange,
    handlePageChange,
    fetchTotalTileCount,
    setTiles: setFetchedTiles // If direct manipulation is needed, though usually not
  } = usePaginatedTiles();

  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedDisplayTile | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isGroupEdit, setIsGroupEdit] = useState(false);


  const groupTiles = useCallback((fbTiles: FirebaseTileDoc[]): GroupedDisplayTile[] => {
    if (!fbTiles || fbTiles.length === 0) return [];
    const groups: Record<string, GroupedDisplayTile> = {};

    fbTiles.forEach(tile => {
      const modelPrefixDisplay = tile.modelNumberPrefix && tile.modelNumberPrefix.trim() !== "" ? tile.modelNumberPrefix : "N/A";
      const groupKey = `${modelPrefixDisplay}_${tile.width}x${tile.height}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          modelNumberPrefix: modelPrefixDisplay,
          width: tile.width,
          height: tile.height,
          variants: [],
          groupCreatedAt: tile.createdAt?.toDate ? tile.createdAt.toDate() : new Date(),
        };
      }

      const variantDisplay: TileVariantDisplay = {
        id: tile.id,
        typeSuffix: tile.typeSuffix && tile.typeSuffix.trim() !== "" ? tile.typeSuffix : t('noTypeSuffix'),
        quantity: tile.quantity,
        createdAt: tile.createdAt?.toDate ? tile.createdAt.toDate() : new Date(),
      };
      groups[groupKey].variants.push(variantDisplay);
      
      if (groups[groupKey].groupCreatedAt && variantDisplay.createdAt && variantDisplay.createdAt < groups[groupKey].groupCreatedAt!) {
        groups[groupKey].groupCreatedAt = variantDisplay.createdAt;
      }
    });
    
    Object.values(groups).forEach(group => {
      group.variants.sort((a, b) => {
        const aIsBase = a.typeSuffix === t('noTypeSuffix');
        const bIsBase = b.typeSuffix === t('noTypeSuffix');
        if (aIsBase && !bIsBase) return -1;
        if (!aIsBase && bIsBase) return 1;
        return a.typeSuffix.localeCompare(b.typeSuffix);
      });
    });

    return Object.values(groups).sort((a, b) => {
      if (a.groupCreatedAt && b.groupCreatedAt) {
        return b.groupCreatedAt.getTime() - a.groupCreatedAt.getTime();
      }
      return 0;
    });
  }, [t]);

  const groupedTilesForDisplay = useMemo(() => groupTiles(fetchedTiles), [fetchedTiles, groupTiles]);
  
  const initialFormValues = useMemo((): TileFormData => {
    if (isEditMode && editingGroup) {
        const baseValues: Partial<TileFormData> = {
            modelNumberPrefix: editingGroup.modelNumberPrefix === "N/A" ? undefined : editingGroup.modelNumberPrefix,
            width: editingGroup.width,
            height: editingGroup.height,
        };
        tileFormTypeConfig.forEach(sf => {
            const variant = editingGroup.variants.find(v => v.typeSuffix === sf.label || (sf.label === t('noTypeSuffix') && v.typeSuffix === t('noTypeSuffix')));
            (baseValues as any)[sf.name] = !!variant;
            (baseValues as any)[sf.quantityName] = variant ? variant.quantity : undefined;
        });

        if (isGroupEdit) { // For group edit, all variants are effectively "checked" if they exist
             return baseValues as TileFormData;
        } else { // Single variant edit (not directly supported by current UI path to here, but logic for future)
            // This case is tricky if editingGroup represents multiple variants.
            // Let's assume if !isGroupEdit, we'd pick the first variant or a specific one.
            // For now, group edit is the primary path from TileList.
            // If we were to edit a single variant, initialValues would be simpler.
            // The current editingGroup structure is for the whole group.
            // To edit a single variant, we'd need to pass that specific variant's data.
            // This part of the logic might need refinement if single variant edit from list is re-introduced.
             const firstVariant = editingGroup.variants[0]; // Example: edit first variant data
             if (firstVariant) {
                const typeKeyForFirstVariant = tileFormTypeConfig.find(tc => tc.label === firstVariant.typeSuffix)?.name;
                tileFormTypeConfig.forEach(sf => {
                    (baseValues as any)[sf.name] = sf.name === typeKeyForFirstVariant;
                    (baseValues as any)[sf.quantityName] = sf.name === typeKeyForFirstVariant ? firstVariant.quantity : undefined;
                });
                // If the first variant is a "Base Model" (no type suffix), handle global quantity
                if (firstVariant.typeSuffix === t('noTypeSuffix')) {
                    baseValues.quantity = firstVariant.quantity;
                }
             }
            return baseValues as TileFormData;
        }

    }
    return createInitialDefaultFormValues();
  }, [isEditMode, editingGroup, isGroupEdit, t]);


  const handleSaveTile = async (data: TileFormData) => {
    if (!user) {
      toast({ title: t('authErrorTitle'), description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const { db } = await getFirebaseInstances();
      const tilesCollectionRef = collection(db, 'tiles');
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      let savedCount = 0;
      const savedModelNumbers: string[] = [];

      const modelPrefixToSave = data.modelNumberPrefix !== undefined && String(data.modelNumberPrefix).trim() !== "" ? String(data.modelNumberPrefix) : "N/A";

      if (isEditMode && editingGroup) {
        // Group Edit Logic
        const existingVariantIds = new Set(editingGroup.variants.map(v => v.id));
        const typesToUpdateOrAdd = tileFormTypeConfig.filter(sf => data[sf.name as keyof TileFormData]);

        for (const sf of tileFormTypeConfig) {
          const typeIsChecked = data[sf.name as keyof TileFormData];
          const quantityForType = data[sf.quantityName as keyof TileFormData] as number | undefined;
          const existingVariant = editingGroup.variants.find(v => v.typeSuffix === sf.label || (sf.label === t('noTypeSuffix') && v.typeSuffix === t('noTypeSuffix')));

          if (typeIsChecked && quantityForType !== undefined && quantityForType > 0) {
            const typeSuffixToSave = sf.label === t('noTypeSuffix') ? "" : sf.label;
            const tileDocData = {
              modelNumberPrefix: modelPrefixToSave,
              typeSuffix: typeSuffixToSave,
              width: data.width,
              height: data.height,
              quantity: quantityForType,
              updatedAt: timestamp,
              // createdAt is only set for new documents
            };

            if (existingVariant) { // Update existing variant
              batch.update(doc(db, 'tiles', existingVariant.id), tileDocData);
              existingVariantIds.delete(existingVariant.id);
            } else { // Add new variant
              batch.set(doc(tilesCollectionRef), { ...tileDocData, createdAt: timestamp, userId: user.uid });
            }
            savedCount++;
            if (!savedModelNumbers.includes(modelPrefixToSave)) {
               savedModelNumbers.push(modelPrefixToSave);
            }
          } else if (existingVariant && (!typeIsChecked || quantityForType === undefined || quantityForType <= 0)) {
            // Delete variant if it's unchecked or quantity is invalid
            batch.delete(doc(db, 'tiles', existingVariant.id));
            existingVariantIds.delete(existingVariant.id);
          }
        }
        // Delete variants that were part of the group but are no longer (e.g. type unchecked)
        // This is already handled above by deleting if !typeIsChecked.
        // existingVariantIds.forEach(idToDelete => batch.delete(doc(db, 'tiles', idToDelete)));


        await batch.commit();
        toast({ title: t('toastGroupUpdatedTitle'), description: t('toastGroupUpdatedDescription', { modelNumberPrefix: modelPrefixToSave }) });

      } else { // Add New Tile(s) Logic
        const selectedTypes = tileFormTypeConfig.filter(sf => data[sf.name as keyof TileFormData]);
        
        if (selectedTypes.length > 0) {
          for (const sf of selectedTypes) {
            const quantityForType = data[sf.quantityName as keyof TileFormData] as number | undefined;
            if (quantityForType !== undefined && quantityForType > 0) {
              const typeSuffixToSave = sf.label === t('noTypeSuffix') ? "" : sf.label;
              batch.set(doc(tilesCollectionRef), {
                modelNumberPrefix: modelPrefixToSave,
                typeSuffix: typeSuffixToSave,
                width: data.width,
                height: data.height,
                quantity: quantityForType,
                createdAt: timestamp,
                updatedAt: timestamp,
                userId: user.uid,
              });
              savedCount++;
              if (!savedModelNumbers.includes(modelPrefixToSave)) {
                 savedModelNumbers.push(modelPrefixToSave);
              }
            }
          }
        } else if (data.quantity !== undefined && data.quantity > 0 && modelPrefixToSave !== "N/A") {
          // Save as a base model if no types selected but global quantity and prefix are present
          batch.set(doc(tilesCollectionRef), {
            modelNumberPrefix: modelPrefixToSave,
            typeSuffix: "", // Base model
            width: data.width,
            height: data.height,
            quantity: data.quantity,
            createdAt: timestamp,
            updatedAt: timestamp,
            userId: user.uid,
          });
          savedCount++;
           if (!savedModelNumbers.includes(modelPrefixToSave)) {
             savedModelNumbers.push(modelPrefixToSave);
           }
        }

        if (savedCount > 0) {
          await batch.commit();
          toast({
            title: t('toastTileAddedTitle'),
            description: t('toastTilesAddedDescription', { count: savedCount.toString(), modelNumbers: savedModelNumbers.join(', ') }),
          });
        } else {
          toast({ title: t('saveErrorTitle'), description: t('saveErrorNoModelOrQuantity'), variant: "destructive" });
        }
      }
      await fetchTotalTileCount(); // Refresh total count
      setIsDialogOpen(false);
      setEditingGroup(null);
      setIsEditMode(false);
      setIsGroupEdit(false);
    } catch (error) {
      console.error("Error saving tile(s):", error);
      toast({ title: t('saveErrorTitle'), description: t('saveErrorDescription'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGroup = (group: GroupedDisplayTile) => {
    setEditingGroup(group);
    setIsEditMode(true);
    setIsGroupEdit(true); // Always true when editing from list context for now
    setIsDialogOpen(true);
  };

  const handleDeleteGroup = async (group: GroupedDisplayTile) => {
    if (!user) {
      toast({ title: t('authErrorTitle'), description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsSaving(true); // Use isSaving to disable buttons during delete
    try {
      const { db } = await getFirebaseInstances();
      const batch = writeBatch(db);
      if (group.variants.length === 0) {
        toast({ title: t('deleteErrorTitle'), description: t('deleteErrorGroupNotFound'), variant: "destructive" });
        setIsSaving(false);
        return;
      }
      group.variants.forEach(variant => {
        batch.delete(doc(db, 'tiles', variant.id));
      });
      await batch.commit();
      toast({ title: t('toastGroupDeletedTitle'), description: t('toastGroupDeletedDescription', { modelNumberPrefix: group.modelNumberPrefix }) });
      await fetchTotalTileCount(); // Refresh total count
      // The onSnapshot listener in usePaginatedTiles should update the list automatically.
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({ title: t('deleteErrorTitle'), description: t('deleteErrorGroupDescription'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancelEdit = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
    setIsEditMode(false);
    setIsGroupEdit(false);
  };

  const dialogTitle = isEditMode ? t('tileFormCardTitleEditGroup') : t('tileFormCardTitleAdd');
  const dialogDescription = isEditMode ? t('tileFormCardDescriptionEditGroup') : t('tileFormCardDescriptionAdd');


  if (fetchError) {
    return <div className="text-destructive text-center py-10">{fetchError}</div>;
  }
  
  return (
    <div className="flex flex-col h-full">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (isSaving) return; // Prevent closing while saving
        setIsDialogOpen(open);
        if (!open) handleCancelEdit();
      }}>
        <DialogTrigger asChild>
          <Button 
            onClick={() => { setIsEditMode(false); setIsGroupEdit(false); setEditingGroup(null); setIsDialogOpen(true); }} 
            className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 lg:bottom-10 lg:right-10 z-50 rounded-full p-0 h-12 w-12 sm:h-14 sm:w-14 shadow-lg"
            aria-label={t('addNewTile')}
          >
            <PlusCircle className="h-6 w-6 sm:h-7 sm:w-7" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl w-[90vw] sm:w-full max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 border-b sticky top-0 bg-background z-10">
            <DialogTitle>{dialogTitle}</DialogTitle>
            {/* <DialogDescription>{dialogDescription}</DialogDescription> */}
          </DialogHeader>
          <div className="overflow-y-auto flex-grow p-1 sm:p-0">
            <TileForm
              key={editingGroup ? editingGroup.groupKey : 'add-new'}
              onSaveTile={handleSaveTile}
              initialValues={initialFormValues}
              onCancelEdit={handleCancelEdit}
              isEditMode={isEditMode}
              isGroupEdit={isGroupEdit}
            />
          </div>
           {isSaving && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoadingTiles && groupedTilesForDisplay.length === 0 ? (
         <div className="flex-grow flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <TileList
          groupedTiles={groupedTilesForDisplay}
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalTileDocs={totalTileDocs}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          isLoading={isLoadingTiles || isSaving} 
        />
      )}
    </div>
  );
};

export default InventoryPage;
