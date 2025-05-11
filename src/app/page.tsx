
"use client";

import { useState, useEffect, useCallback } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile, GroupedDisplayTile, TileVariant } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from '@/context/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { getFirebaseInstances } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';


const TILES_COLLECTION = "globalTilesInventory";

const typeConfigPage = [
  { key: "L" as const, name: "type_L" as const, label: "L", quantityName: "quantity_L" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: "HL-1", quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: "HL-2", quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: "HL-4", quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: "HL-5", quantityName: "quantity_HL5" as const },
  { key: "D" as const, name: "type_D" as const, label: "D", quantityName: "quantity_D" as const },
  { key: "F" as const, name: "type_F" as const, label: "F", quantityName: "quantity_F" as const },
] as const;


export default function InventoryPage() {
  const [rawTiles, setRawTiles] = useState<Tile[]>([]); // Stores the flat list from Firestore
  const [groupedTiles, setGroupedTiles] = useState<GroupedDisplayTile[]>([]);
  const [editingTile, setEditingTile] = useState<Tile | null>(null); // This will be an individual Tile object
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  const groupTiles = useCallback((firestoreTiles: Tile[]): GroupedDisplayTile[] => {
    const groups = new Map<string, GroupedDisplayTile>();
    const knownTypesSorted = typeConfigPage.map(tc => tc.label).sort((a, b) => b.length - a.length);

    firestoreTiles.forEach(tile => {
      let modelNumberPrefix = tile.modelNumber;
      let typeSuffix = "";

      for (const type of knownTypesSorted) {
        if (tile.modelNumber.endsWith(`-${type}`)) {
          modelNumberPrefix = tile.modelNumber.substring(0, tile.modelNumber.length - (type.length + 1));
          typeSuffix = type;
          break;
        } else if (tile.modelNumber === type) {
          modelNumberPrefix = ""; 
          typeSuffix = type;
          break;
        }
      }
      
      // If after attempting to parse, modelNumberPrefix is still the full modelNumber,
      // and it's not "N/A", and no typeSuffix was found, it means it's a base model without a type suffix.
      if (modelNumberPrefix === tile.modelNumber && tile.modelNumber !== "N/A" && typeSuffix === "") {
         // typeSuffix remains ""
      } else if (modelNumberPrefix === "N/A" && typeSuffix === "") {
        // modelNumberPrefix is "N/A", typeSuffix is ""
      }


      const groupKey = `${modelNumberPrefix || "N/A"}_${tile.width}x${tile.height}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          modelNumberPrefix: modelNumberPrefix || "N/A",
          width: tile.width,
          height: tile.height,
          variants: [],
          groupCreatedAt: tile.createdAt,
        });
      }

      const group = groups.get(groupKey)!;
      group.variants.push({
        id: tile.id,
        typeSuffix: typeSuffix || (modelNumberPrefix === tile.modelNumber && modelNumberPrefix !== "N/A" ? t('noTypeSuffix') : "N/A"),
        quantity: tile.quantity,
        createdAt: tile.createdAt,
      });
      
      group.variants.sort((a, b) => {
        const typeOrder = knownTypesSorted.concat(["N/A", t('noTypeSuffix')]);
        return typeOrder.indexOf(a.typeSuffix) - typeOrder.indexOf(b.typeSuffix);
      });

      if (tile.createdAt && (!group.groupCreatedAt || tile.createdAt < group.groupCreatedAt)) {
          group.groupCreatedAt = tile.createdAt;
      }
    });
    
    return Array.from(groups.values()).sort((a,b) => (b.groupCreatedAt?.getTime() || 0) - (a.groupCreatedAt?.getTime() || 0));
  }, [t]);

  useEffect(() => {
    let unsubscribe = () => {};
    const setupFirestoreListener = async () => {
      try {
        const { db } = await getFirebaseInstances();
        if (!db) {
          console.error("Firestore is not initialized.");
          toast({ title: "Error", description: "Failed to connect to database.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const tilesQuery = query(collection(db, TILES_COLLECTION), orderBy("createdAt", "desc"));
        unsubscribe = onSnapshot(tilesQuery, (querySnapshot) => {
          const fetchedTiles: Tile[] = [];
          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            fetchedTiles.push({
              id: docSnapshot.id,
              modelNumber: data.modelNumber || 'N/A',
              width: data.width,
              height: data.height,
              quantity: data.quantity,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            });
          });
          setRawTiles(fetchedTiles);
          setGroupedTiles(groupTiles(fetchedTiles));
          setIsLoading(false);
        }, (error: any) => {
          console.error("Error fetching tiles:", error);
          toast({ title: t('errorMessages.fetchErrorTitle'), description: t('errorMessages.fetchErrorDescription'), variant: "destructive" });
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Firestore initialization error:", error);
        toast({ title: "Initialization Error", description: "Could not initialize database connection.", variant: "destructive" });
        setIsLoading(false);
      }
    };

    setupFirestoreListener();
    return () => unsubscribe();
  }, [toast, t, groupTiles]);


  useEffect(() => {
    document.title = t('appTitle');
  }, [t, locale]);

  const handleAddNewTileClick = () => {
    setEditingTile(null);
    setIsFormOpen(true);
  };

  const handleSaveTile = useCallback(async (data: TileFormData, tileIdToEdit?: string) => {
    const { db } = await getFirebaseInstances();
    if (!db) {
      toast({ title: "Database Error", description: "Database not connected. Cannot save tile.", variant: "destructive"});
      return;
    }

    const tileBaseProperties = {
      width: data.width,
      height: data.height,
    };
    
    const modelNumberPrefixStr = data.modelNumberPrefix !== undefined ? String(data.modelNumberPrefix).trim() : "";

    try {
      if (tileIdToEdit) { // Editing existing tile (variant)
        const activeTypeConfig = typeConfigPage.find(sf => data[sf.name]); // In edit, only one should be true
        let finalModelNumber = modelNumberPrefixStr;

        if (activeTypeConfig && modelNumberPrefixStr) {
          finalModelNumber = `${modelNumberPrefixStr}-${activeTypeConfig.label}`;
        } else if (activeTypeConfig) { // Only type, no prefix
          finalModelNumber = activeTypeConfig.label;
        } else if (!modelNumberPrefixStr) { // No prefix and no type (should be caught by validation)
          finalModelNumber = "N/A";
        }
        // If finalModelNumber is still empty, it means prefix was empty and no type was selected
        if (finalModelNumber === "") finalModelNumber = "N/A";


        const tileDocRef = doc(db, TILES_COLLECTION, tileIdToEdit);
        await updateDoc(tileDocRef, {
          ...tileBaseProperties,
          modelNumber: finalModelNumber,
          quantity: data.quantity // Global quantity is used for the specific variant being edited
        });
        toast({
          title: t('toastTileUpdatedTitle'),
          description: t('toastTileUpdatedDescription', { modelNumber: finalModelNumber }),
        });

      } else { // Adding new tile(s)
        const modelsToCreateMap = new Map<string, Omit<Tile, 'id'|'createdAt'> & {createdAt: any}>();
        const checkedTypes = typeConfigPage.filter(sf => data[sf.name]);

        if (checkedTypes.length > 0) {
            for (const sf of checkedTypes) {
                const model = modelNumberPrefixStr ? `${modelNumberPrefixStr}-${sf.label}` : sf.label;
                const currentQuantity = data[sf.quantityName] ?? 0;

                if (currentQuantity > 0 && !modelsToCreateMap.has(model)) {
                     modelsToCreateMap.set(model, {
                        ...tileBaseProperties,
                        modelNumber: model,
                        quantity: currentQuantity,
                        createdAt: serverTimestamp(),
                    });
                }
            }
        } else if (modelNumberPrefixStr) { // Only prefix is provided, no types selected
            const quantity = data.quantity ?? 0; // Use global quantity
             if (quantity > 0 && !modelsToCreateMap.has(modelNumberPrefixStr)){
                modelsToCreateMap.set(modelNumberPrefixStr, {
                     ...tileBaseProperties,
                    modelNumber: modelNumberPrefixStr,
                    quantity: quantity,
                    createdAt: serverTimestamp(),
                });
            }
        } else { // Neither prefix nor type selected, use global quantity for "N/A" model
             const quantity = data.quantity ?? 0;
             if (quantity > 0 && !modelsToCreateMap.has("N/A")) {
                 modelsToCreateMap.set("N/A", {
                     ...tileBaseProperties,
                    modelNumber: "N/A",
                    quantity: quantity,
                    createdAt: serverTimestamp(),
                });
            }
        }

        const modelsToCreate = Array.from(modelsToCreateMap.keys());
        const tileDataObjects = Array.from(modelsToCreateMap.values());

        if (tileDataObjects.length === 0 ) {
           toast({ title: t("saveErrorTitle"), description: t("saveErrorNoModelOrQuantity"), variant: "destructive" });
           setIsFormOpen(false);
           return;
        }

        const batch = writeBatch(db);
        tileDataObjects.forEach(tileData => {
          const newTileDocRef = doc(collection(db, TILES_COLLECTION));
          batch.set(newTileDocRef, tileData);
        });
        await batch.commit();

        toast({
          title: t('toastTileAddedTitle'),
          description: t('toastTilesAddedDescription', { count: modelsToCreate.length, modelNumbers: modelsToCreate.join(', ') }),
        });
      }
      setIsFormOpen(false);
      setEditingTile(null);
    } catch (error) {
      console.error("Error saving tile(s):", error);
      toast({ title: t("saveErrorTitle"), description: t("saveErrorDescription"), variant: "destructive" });
    }
  }, [toast, t]);

  const handleEditTile = useCallback((variantId: string) => {
    const tileToEdit = rawTiles.find(tile => tile.id === variantId);
    if (tileToEdit) {
      setEditingTile(tileToEdit);
      setIsFormOpen(true);
    } else {
      toast({ title: t("editErrorTitle"), description: t("editErrorNotFound"), variant: "destructive"});
    }
  }, [rawTiles, toast, t]);

  const handleCancelEditOnForm = useCallback(() => {
    setEditingTile(null);
    setIsFormOpen(false);
  }, []);

  const handleDeleteTile = useCallback(async (variantId: string) => {
    const { db } = await getFirebaseInstances();
    if (!db) {
      toast({ title: "Database Error", description: "Database not connected. Cannot delete tile.", variant: "destructive"});
      return;
    }

    const tileToDelete = rawTiles.find(tile => tile.id === variantId);
    if (!tileToDelete) {
        toast({ title: t("deleteErrorTitle"), description: t("deleteErrorNotFound"), variant: "destructive"});
        return;
    }

    try {
      const tileDocRef = doc(db, TILES_COLLECTION, variantId);
      await deleteDoc(tileDocRef);

      if (editingTile && editingTile.id === variantId) {
        setEditingTile(null);
        setIsFormOpen(false);
      }
      toast({
        title: t('toastTileDeletedTitle'),
        description: t('toastTileDeletedDescription', { modelNumber: tileToDelete.modelNumber }),
        variant: "destructive", // Or default
      });
    } catch (error) {
      console.error("Error deleting tile:", error);
      toast({ title: t("deleteErrorTitle"), description: t("deleteErrorDescription"), variant: "destructive" });
    }
  }, [toast, rawTiles, editingTile, t]);


  const isEditingForm = !!editingTile;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="py-6 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
                className="h-10 w-10 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-ai-hint="tiles pattern"
              >
                <path d="M3 3h7v7H3z" />
                <path d="M14 3h7v7h-7z" />
                <path d="M3 14h7v7H3z" />
                <path d="M14 14h7v7h-7z" />
              </svg>
            <h1 className="text-3xl font-bold text-primary tracking-tight">
              {t('headerTitle')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 flex-grow">
        <div className="mb-6 flex justify-end">
          <Button onClick={handleAddNewTileClick}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('addNewTile')}
          </Button>
        </div>

        <Dialog
          open={isFormOpen}
          onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
              setEditingTile(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto flex flex-col">
            <DialogHeader className="px-0 pt-0 pb-4 sticky top-0 bg-card z-10 border-b">
              <DialogTitle className="text-xl flex items-center gap-2">
                {isEditingForm ? <Edit3 className="text-primary" /> : <PlusCircle className="text-primary" />}
                {isEditingForm ? t('tileFormCardTitleEdit') : t('tileFormCardTitleAdd')}
              </DialogTitle>
              <DialogDescription>
                {isEditingForm ? t('tileFormCardDescriptionEdit') : t('tileFormCardDescriptionAdd')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2"> {/* Added pr-2 for scrollbar spacing */}
              <TileForm
                onSaveTile={handleSaveTile}
                editingTile={editingTile}
                onCancelEdit={handleCancelEditOnForm}
              />
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
               <Card key={index} className="w-full shadow-md">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                  <div className="flex justify-end space-x-2 mt-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <TileList
            groupedTiles={groupedTiles}
            onEditTile={handleEditTile}
            onDeleteTile={handleDeleteTile}
          />
        )}
      </main>

      <footer className="py-6 mt-auto text-center text-sm text-muted-foreground border-t border-border bg-card">
        <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}

    