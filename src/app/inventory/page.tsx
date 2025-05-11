
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import TileForm, { type TileFormData, createInitialDefaultFormValues } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile, GroupedDisplayTile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, LogOut } from "lucide-react";
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
import { Card, CardContent, CardHeader as MUICardHeader } from '@/components/ui/card'; 
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';


const TILES_COLLECTION = "globalTilesInventory";

const typeConfigPage = [
  { key: "L" as const, name: "type_L" as const, label: "L", quantityName: "quantity_L" as const },
  { key: "D" as const, name: "type_D" as const, label: "D", quantityName: "quantity_D" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: "HL-1", quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: "HL-2", quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: "HL-4", quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: "HL-5", quantityName: "quantity_HL5" as const },
  { key: "F" as const, name: "type_F" as const, label: "F", quantityName: "quantity_F" as const },
] as const;


export default function InventoryPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [rawTiles, setRawTiles] = useState<Tile[]>([]);
  const [groupedTiles, setGroupedTiles] = useState<GroupedDisplayTile[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // For tile data loading
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  const [formMode, setFormMode] = useState<'add' | 'editVariant' | 'editGroup'>('add');
  const [initialDataForForm, setInitialDataForForm] = useState<TileFormData | null>(null);
  const [editingVariant, setEditingVariant] = useState<Tile | null>(null); 
  const [editingGroup, setEditingGroup] = useState<GroupedDisplayTile | null>(null);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);


  const groupTiles = useCallback((firestoreTiles: Tile[]): GroupedDisplayTile[] => {
    const groups = new Map<string, GroupedDisplayTile>();
    const knownTypesSorted = typeConfigPage.map(tc => tc.label); 

    firestoreTiles.forEach(tile => {
      let modelNumberPrefix = tile.modelNumber;
      let typeSuffix = "";

      const sortedTypesForMatching = [...typeConfigPage.map(tc => tc.label)].sort((a,b) => b.length - a.length);

      for (const type of sortedTypesForMatching) {
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
        typeSuffix: typeSuffix || (modelNumberPrefix && modelNumberPrefix !== "N/A" ? t('noTypeSuffix') : "N/A"),
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
    if (!user) return; // Don't fetch if no user

    let unsubscribe = () => {};
    const setupFirestoreListener = async () => {
      setIsLoading(true); // Set loading true when starting to fetch
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
  }, [user, toast, t, groupTiles]);


  useEffect(() => {
    document.title = t('appTitle');
  }, [t, locale]);

  const handleAddNewTileClick = () => {
    setFormMode('add');
    setInitialDataForForm(createInitialDefaultFormValues());
    setEditingVariant(null);
    setEditingGroup(null);
    setIsFormOpen(true);
  };
  
  const prepareDataForGroupEdit = (group: GroupedDisplayTile): TileFormData => {
    const formData: TileFormData = createInitialDefaultFormValues();
    const numPrefix = parseFloat(group.modelNumberPrefix);
    formData.modelNumberPrefix = isNaN(numPrefix) || group.modelNumberPrefix === "" ? (group.modelNumberPrefix === "N/A" ? undefined : group.modelNumberPrefix) : numPrefix;
    formData.width = group.width;
    formData.height = group.height;
  
    typeConfigPage.forEach(sf => {
      const variant = group.variants.find(v => v.typeSuffix === sf.label || (sf.label === "L" && v.typeSuffix === t('noTypeSuffix')));
      if (variant) {
        formData[sf.name] = true;
        formData[sf.quantityName] = variant.quantity;
      } else {
        formData[sf.name] = false;
        formData[sf.quantityName] = undefined;
      }
    });

    const baseVariant = group.variants.find(v => v.typeSuffix === t('noTypeSuffix') || v.typeSuffix === "N/A" || v.typeSuffix === "");
    if (baseVariant && !typeConfigPage.some(sf => formData[sf.name])) { 
        if (group.variants.length === 1 && (baseVariant.typeSuffix === t('noTypeSuffix') || baseVariant.typeSuffix === "N/A" || baseVariant.typeSuffix === "")) {
            formData.quantity = baseVariant.quantity;
        }
    }
    return formData;
  };


  const handleSaveTile = useCallback(async (data: TileFormData) => {
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
      if (formMode === 'editGroup' && editingGroup) {
        const batch = writeBatch(db);
        editingGroup.variants.forEach(variant => {
          const oldDocRef = doc(db, TILES_COLLECTION, variant.id);
          batch.delete(oldDocRef);
        });

        const modelsToCreateOrUpdateMap = new Map<string, Omit<Tile, 'id'|'createdAt'> & {createdAt: any}>();
        const checkedTypes = typeConfigPage.filter(sf => data[sf.name]);

        if (checkedTypes.length > 0) {
            for (const sf of checkedTypes) {
                const model = modelNumberPrefixStr ? `${modelNumberPrefixStr}-${sf.label}` : sf.label;
                const currentQuantity = data[sf.quantityName] ?? 0;
                if (currentQuantity > 0 && !modelsToCreateOrUpdateMap.has(model)) { 
                     modelsToCreateOrUpdateMap.set(model, {
                        ...tileBaseProperties, 
                        modelNumber: model,
                        quantity: currentQuantity,
                        createdAt: serverTimestamp(), 
                    });
                }
            }
        } else if (modelNumberPrefixStr) { 
            const quantity = data.quantity ?? 0; 
             if (quantity > 0 && !modelsToCreateOrUpdateMap.has(modelNumberPrefixStr)){
                modelsToCreateOrUpdateMap.set(modelNumberPrefixStr, {
                     ...tileBaseProperties,
                    modelNumber: modelNumberPrefixStr,
                    quantity: quantity,
                    createdAt: serverTimestamp(),
                });
            }
        } else { 
             const quantity = data.quantity ?? 0;
             if (quantity > 0 && !modelsToCreateOrUpdateMap.has("N/A")) { 
                 modelsToCreateOrUpdateMap.set("N/A", {
                     ...tileBaseProperties,
                    modelNumber: "N/A", 
                    quantity: quantity,
                    createdAt: serverTimestamp(),
                });
            }
        }
        
        const modelsToCreate = Array.from(modelsToCreateOrUpdateMap.keys());
        const tileDataObjects = Array.from(modelsToCreateOrUpdateMap.values());

        if (tileDataObjects.length === 0 && modelsToCreate.length === 0) {
           toast({ title: t("saveErrorTitle"), description: t("saveErrorNoModelOrQuantity"), variant: "destructive" });
           return;
        }

        tileDataObjects.forEach(tileData => {
          const newTileDocRef = doc(collection(db, TILES_COLLECTION)); 
          batch.set(newTileDocRef, tileData);
        });
        await batch.commit();
        toast({
          title: t('toastGroupUpdatedTitle'),
          description: t('toastGroupUpdatedDescription', { modelNumberPrefix: modelNumberPrefixStr || "N/A" }),
        });

      } else { 
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
        } else if (modelNumberPrefixStr) { 
            const quantity = data.quantity ?? 0; 
             if (quantity > 0 && !modelsToCreateMap.has(modelNumberPrefixStr)){ 
                modelsToCreateMap.set(modelNumberPrefixStr, {
                     ...tileBaseProperties,
                    modelNumber: modelNumberPrefixStr,
                    quantity: quantity,
                    createdAt: serverTimestamp(),
                });
            }
        } else { 
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
           setIsFormOpen(true); 
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
      setEditingVariant(null);
      setEditingGroup(null);
      setInitialDataForForm(null);
    } catch (error) {
      console.error("Error saving tile(s):", error);
      toast({ title: t("saveErrorTitle"), description: t("saveErrorDescription"), variant: "destructive" });
    }
  }, [toast, t, formMode, editingVariant, editingGroup]);

  const handleEditGroup = useCallback((group: GroupedDisplayTile) => {
    setFormMode('editGroup');
    setEditingGroup(group);
    setEditingVariant(null); 
    setInitialDataForForm(prepareDataForGroupEdit(group));
    setIsFormOpen(true);
  }, [prepareDataForGroupEdit]); 

  const handleCancelEditOnForm = useCallback(() => {
    setEditingVariant(null);
    setEditingGroup(null);
    setInitialDataForForm(null);
    setIsFormOpen(false);
  }, []);

  const handleDeleteGroup = useCallback(async (group: GroupedDisplayTile) => {
    const { db } = await getFirebaseInstances();
    if (!db) {
      toast({ title: "Database Error", description: "Database not connected. Cannot delete group.", variant: "destructive"});
      return;
    }
    if (!group || group.variants.length === 0) {
        toast({ title: t("deleteErrorTitle"), description: t("deleteErrorGroupNotFound"), variant: "destructive"});
        return;
    }

    try {
      const batch = writeBatch(db);
      group.variants.forEach(variant => {
        const docRef = doc(db, TILES_COLLECTION, variant.id);
        batch.delete(docRef);
      });
      await batch.commit();

      if (editingGroup && editingGroup.groupKey === group.groupKey) {
        setEditingGroup(null);
        setInitialDataForForm(null);
        setIsFormOpen(false);
      }
      toast({
        title: t('toastGroupDeletedTitle'),
        description: t('toastGroupDeletedDescription', { modelNumberPrefix: group.modelNumberPrefix }),
        variant: "destructive", 
      });
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({ title: t("deleteErrorTitle"), description: t("deleteErrorGroupDescription"), variant: "destructive" });
    }
  }, [toast, editingGroup, t]);

  const dialogTitle = useMemo(() => {
    if (formMode === 'add') return t('tileFormCardTitleAdd');
    if (formMode === 'editGroup') return t('tileFormCardTitleEditGroup');
    return "";
  }, [formMode, t]);

  const dialogDescription = useMemo(() => {
    if (formMode === 'add') return t('tileFormCardDescriptionAdd');
    if (formMode === 'editGroup') return t('tileFormCardDescriptionEditGroup');
    return "";
  }, [formMode, t]);

  if (authLoading || (!user && !authLoading)) {
    return (
         <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card w-full max-w-md text-center">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
              <Skeleton className="h-10 w-full mt-4" />
            </div>
         </div>
    );
  }


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
            <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('logoutButton')}
            </Button>
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
              setEditingVariant(null);
              setEditingGroup(null);
              setInitialDataForForm(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="sticky top-0 bg-card z-10 border-b px-6 pt-6 pb-4">
              <DialogTitle className="text-xl flex items-center gap-2">
                {formMode === 'add' ? <PlusCircle className="text-primary" /> : <Edit className="text-primary" />}
                {dialogTitle}
              </DialogTitle>
              <DialogDescription>
                {dialogDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto px-6 py-6">
              {initialDataForForm && (
                <TileForm
                  onSaveTile={handleSaveTile}
                  initialValues={initialDataForForm}
                  onCancelEdit={handleCancelEditOnForm}
                  isEditMode={formMode === 'editGroup'} 
                  isGroupEdit={formMode === 'editGroup'} 
                  key={formMode === 'add' ? 'add' : (editingGroup?.groupKey)} 
                />
              )}
               {formMode === 'add' && !initialDataForForm && ( 
                 <TileForm
                    onSaveTile={handleSaveTile}
                    initialValues={createInitialDefaultFormValues()}
                    onCancelEdit={handleCancelEditOnForm}
                    isEditMode={false}
                    isGroupEdit={false}
                    key="add-empty"
                 />
               )}
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
               <Card key={index} className="w-full shadow-md">
                <MUICardHeader className="pb-2">
                  <Skeleton className="h-6 w-3/4" />
                </MUICardHeader>
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
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        )}
      </main>

      <footer className="py-6 mt-auto text-center text-sm text-muted-foreground border-t border-border bg-card">
        <p>{t('footerCopyright', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}
    
