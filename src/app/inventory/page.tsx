
"use client";

import { useState, useEffect, useCallback } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useTranslation } from '@/context/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { db, ensureFirebaseInitialized } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


const TILES_COLLECTION = "globalTilesInventory";
const SELECT_ITEM_VALUE_FOR_NONE_SUFFIX = "_INTERNAL_NONE_SUFFIX_"; 

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
        await ensureFirebaseInitialized(); 
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
        }, (error) => {
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
    await ensureFirebaseInitialized();
    if (!db) {
      toast({ title: "Database Error", description: "Database not connected. Cannot save tile.", variant: "destructive"});
      return;
    }
    
    let modelNumber = "";
    if (data.modelNumberPrefix !== undefined && data.modelNumberPrefix !== null && String(data.modelNumberPrefix).trim() !== "") {
      modelNumber += String(data.modelNumberPrefix);
    }
    if (data.modelNumberSuffix && data.modelNumberSuffix.trim() !== "" && data.modelNumberSuffix !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX) {
      if (modelNumber.length > 0) {
        modelNumber += "-";
      }
      modelNumber += data.modelNumberSuffix;
    }
    
    if(modelNumber === "") modelNumber = "N/A";
    const tileDisplayName = modelNumber;

    const tileDataForStorage = {
      modelNumber,
      width: data.width,
      height: data.height,
      quantity: data.quantity,
    };

    try {
      if (id) {
        const tileDocRef = doc(db, TILES_COLLECTION, id);
        await updateDoc(tileDocRef, tileDataForStorage);
        toast({
          title: t('toastTileUpdatedTitle'),
          description: t('toastTileUpdatedDescription', { modelNumber: tileDisplayName }),
          variant: "default",
        });
      } else {
        await addDoc(collection(db, TILES_COLLECTION), {
          ...tileDataForStorage,
          createdAt: serverTimestamp(), 
        });
        toast({
          title: t('toastTileAddedTitle'),
          description: t('toastTileAddedDescription', { modelNumber: tileDisplayName }),
          variant: "default",
        });
      }
      setIsFormOpen(false);
      setEditingTile(null);
    } catch (error) {
      console.error("Error saving tile:", error);
      toast({ title: "Save Error", description: "Failed to save tile. Please try again.", variant: "destructive" });
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
    await ensureFirebaseInitialized();
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
  
  if (isLoading) { 
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Skeleton className="w-full h-full" />
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
            <TileForm 
              onSaveTile={handleSaveTile} 
              editingTile={editingTile}
              onCancelEdit={handleCancelEditOnForm}
            />
          </DialogContent>
        </Dialog>
        
        {isLoading ? ( // This specific isLoading check might be redundant if the top-level one handles it.
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
