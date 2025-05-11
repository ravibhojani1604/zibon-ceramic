
"use client";

import { useState, useEffect, useCallback } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadCnCardDescription } from '@/components/ui/card'; 
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


const TILES_COLLECTION = "globalTilesInventory";
const SELECT_ITEM_VALUE_FOR_NONE_SUFFIX = "_INTERNAL_NONE_SUFFIX_"; 
const CHECKBOX_SUFFIX_HL1 = "HL-1";
const CHECKBOX_SUFFIX_HL2 = "HL-2";

export default function InventoryPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, locale } = useTranslation();

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
          setTiles(fetchedTiles);
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
  }, [toast, t]);


  useEffect(() => {
    document.title = t('appTitle');
  }, [t, locale]);

  const handleAddNewTileClick = () => {
    setEditingTile(null);
    setIsFormOpen(true);
  };

  const handleSaveTile = useCallback(async (data: TileFormData, id?: string) => {
    const { db } = await getFirebaseInstances();
    if (!db) {
      toast({ title: "Database Error", description: "Database not connected. Cannot save tile.", variant: "destructive"});
      return;
    }
    
    const tileBaseData = {
      width: data.width,
      height: data.height,
      quantity: data.quantity,
    };

    try {
      if (id) { // Editing existing tile
        let modelNumber = "";
        if (data.modelNumberPrefix !== undefined) {
          modelNumber += String(data.modelNumberPrefix);
        }
        // For editing, we primarily use modelNumberSuffixSelect or reconstruct based on HL flags if they were part of original model
        // The form logic for populating these fields during edit is key.
        // Here, we assume the form data reflects the single suffix being edited.
        if (data[CHECKBOX_SUFFIX_HL1] && data.modelNumberPrefix !== undefined) {
            modelNumber = (modelNumber.length > 0 ? modelNumber + "-" : "") + CHECKBOX_SUFFIX_HL1;
        } else if (data[CHECKBOX_SUFFIX_HL2] && data.modelNumberPrefix !== undefined) {
            modelNumber = (modelNumber.length > 0 ? modelNumber + "-" : "") + CHECKBOX_SUFFIX_HL2;
        } else if (data.modelNumberSuffixSelect && data.modelNumberSuffixSelect !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX && data.modelNumberSuffixSelect.trim() !== "") {
          if (modelNumber.length > 0) modelNumber += "-";
          modelNumber += data.modelNumberSuffixSelect;
        }


        if(modelNumber === "") modelNumber = "N/A";
        
        const tileDocRef = doc(db, TILES_COLLECTION, id);
        await updateDoc(tileDocRef, { ...tileBaseData, modelNumber });
        toast({
          title: t('toastTileUpdatedTitle'),
          description: t('toastTileUpdatedDescription', { modelNumber }),
          variant: "default",
        });

      } else { // Adding new tile(s)
        const modelsToCreate: string[] = [];
        let prefixStr = data.modelNumberPrefix !== undefined ? String(data.modelNumberPrefix) : "";

        if (data[CHECKBOX_SUFFIX_HL1] && prefixStr) {
          modelsToCreate.push(prefixStr + "-" + CHECKBOX_SUFFIX_HL1);
        }
        if (data[CHECKBOX_SUFFIX_HL2] && prefixStr) {
          modelsToCreate.push(prefixStr + "-" + CHECKBOX_SUFFIX_HL2);
        }

        // If no HL suffixes were checked OR if a prefix wasn't provided for them,
        // fall back to the select suffix or just prefix.
        if (modelsToCreate.length === 0) {
          let singleModel = prefixStr;
          if (data.modelNumberSuffixSelect && data.modelNumberSuffixSelect !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX && data.modelNumberSuffixSelect.trim() !== "") {
            if (singleModel.length > 0) singleModel += "-";
            singleModel += data.modelNumberSuffixSelect;
          }
          if (singleModel === "" && prefixStr === "") singleModel = "N/A"; // Handle case where everything is empty
          else if (singleModel === "") singleModel = prefixStr || "N/A";


          if (singleModel !== "N/A" || (singleModel === "N/A" && prefixStr !== "N/A" )) { // ensure we have something to add
             modelsToCreate.push(singleModel);
          }
        }
        
        if (modelsToCreate.length === 0 && prefixStr) { // Case: only prefix provided, no specific suffix and no HL
             modelsToCreate.push(prefixStr);
        } else if (modelsToCreate.length === 0 && !prefixStr && data.modelNumberSuffixSelect && data.modelNumberSuffixSelect !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX && data.modelNumberSuffixSelect.trim() !== "") {
            // Case: only select suffix provided (e.g. "L"), no prefix
             modelsToCreate.push(data.modelNumberSuffixSelect);
        }


        if (modelsToCreate.length === 0 || (modelsToCreate.length === 1 && modelsToCreate[0] === "N/A" && !prefixStr && (!data.modelNumberSuffixSelect || data.modelNumberSuffixSelect === SELECT_ITEM_VALUE_FOR_NONE_SUFFIX))) {
           toast({ title: "Save Error", description: "No valid model number to save.", variant: "destructive" });
           return; // Nothing to add based on form input
        }


        const batch = writeBatch(db);
        modelsToCreate.forEach(modelNum => {
          const newTileDocRef = doc(collection(db, TILES_COLLECTION));
          batch.set(newTileDocRef, {
            ...tileBaseData,
            modelNumber: modelNum,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
        
        toast({
          title: t('toastTileAddedTitle'),
          description: t('toastTilesAddedDescription', { count: modelsToCreate.length, modelNumbers: modelsToCreate.join(', ') }),
          variant: "default",
        });
      }
      setIsFormOpen(false);
      setEditingTile(null);
    } catch (error) {
      console.error("Error saving tile(s):", error);
      toast({ title: "Save Error", description: "Failed to save tile(s). Please try again.", variant: "destructive" });
    }
  }, [toast, t]);

  const handleEditTile = useCallback((tile: Tile) => {
    setEditingTile(tile);
    setIsFormOpen(true);
  }, []);

  const handleCancelEditOnForm = useCallback(() => {
    setEditingTile(null);
    setIsFormOpen(false);
  }, []);

  const handleDeleteTile = useCallback(async (tileId: string) => {
    const { db } = await getFirebaseInstances();
    if (!db) { 
      toast({ title: "Database Error", description: "Database not connected. Cannot delete tile.", variant: "destructive"});
      return;
    }

    const tileToDelete = tiles.find(tile => tile.id === tileId);
    if (!tileToDelete) return;

    try {
      const tileDocRef = doc(db, TILES_COLLECTION, tileId);
      await deleteDoc(tileDocRef);
      
      if (editingTile && editingTile.id === tileId) {
        setEditingTile(null); 
        setIsFormOpen(false); 
      }
      const tileDisplayName = tileToDelete.modelNumber;
      toast({
        title: t('toastTileDeletedTitle'),
        description: t('toastTileDeletedDescription', { modelNumber: tileDisplayName }),
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting tile:", error);
      toast({ title: "Delete Error", description: "Failed to delete tile. Please try again.", variant: "destructive" });
    }
  }, [toast, tiles, editingTile, t]);
  

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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                {isEditingForm ? <Edit3 className="text-primary" /> : <PlusCircle className="text-primary" />}
                {isEditingForm ? t('tileFormCardTitleEdit') : t('tileFormCardTitleAdd')}
              </DialogTitle>
              <DialogDescription>
                {isEditingForm ? t('tileFormCardDescriptionEdit') : t('tileFormCardDescriptionAdd')}
              </DialogDescription>
            </DialogHeader>
            <TileForm 
              onSaveTile={handleSaveTile} 
              editingTile={editingTile}
              onCancelEdit={handleCancelEditOnForm}
            />
          </DialogContent>
        </Dialog>
        
        {isLoading ? ( 
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <Card key={index} className="w-full max-w-xs sm:w-72 shadow-md">
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
            tiles={tiles} 
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
