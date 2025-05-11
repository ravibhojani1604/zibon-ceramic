
"use client";

import { useState, useEffect, useCallback } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from '@/context/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function InventoryPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  useEffect(() => {
    setIsClient(true);
    const savedTiles = localStorage.getItem('tileInventory');
    if (savedTiles) {
      try {
        const parsedTiles = JSON.parse(savedTiles);
        if (Array.isArray(parsedTiles)) {
          const migratedTiles = parsedTiles.map(tile => ({
            id: tile.id,
            modelNumber: tile.modelNumber || 'N/A', 
            width: tile.width,
            height: tile.height,
            quantity: tile.quantity,
          }));
          setTiles(migratedTiles);
        }
      } catch (error) {
        console.error("Failed to parse tiles from localStorage", error);
        setTiles([]);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('tileInventory', JSON.stringify(tiles));
      // Update document title dynamically based on language
      document.title = t('appTitle');
    }
  }, [tiles, isClient, t, locale]);

  const handleAddNewTileClick = () => {
    setEditingTile(null);
    setIsFormOpen(true);
  };

  const handleSaveTile = useCallback((data: TileFormData, id?: string) => {
    if (!isClient) return;

    let modelNumber = "";
    if (data.modelNumberPrefix !== undefined && data.modelNumberPrefix !== null && String(data.modelNumberPrefix).trim() !== "") {
      modelNumber += String(data.modelNumberPrefix);
    }
    if (data.modelNumberSuffix && data.modelNumberSuffix.trim() !== "") {
      if (modelNumber.length > 0) {
        modelNumber += "-";
      }
      modelNumber += data.modelNumberSuffix;
    }
    
    if(modelNumber === "") modelNumber = "N/A";

    const tileDisplayName = modelNumber;

    const tileDataForStorage = {
      width: data.width,
      height: data.height,
      quantity: data.quantity,
    };

    if (id) { 
      setTiles(prevTiles =>
        prevTiles.map(tile => (tile.id === id ? { ...tile, ...tileDataForStorage, modelNumber } : tile))
      );
      toast({
        title: t('toastTileUpdatedTitle'),
        description: t('toastTileUpdatedDescription', { modelNumber: tileDisplayName }),
        variant: "default",
      });
    } else { 
      const newTile: Tile = {
        id: crypto.randomUUID(),
        modelNumber,
        ...tileDataForStorage,
      };
      setTiles(prevTiles => [newTile, ...prevTiles]);
      toast({
        title: t('toastTileAddedTitle'),
        description: t('toastTileAddedDescription', { modelNumber: tileDisplayName }),
        variant: "default",
      });
    }
    setIsFormOpen(false);
    setEditingTile(null);
  }, [isClient, toast, t]);

  const handleEditTile = useCallback((tile: Tile) => {
    setEditingTile(tile);
    setIsFormOpen(true);
  }, []);

  const handleCancelEditOnForm = useCallback(() => {
    setEditingTile(null);
    setIsFormOpen(false);
  }, []);

  const handleDeleteTile = useCallback((tileId: string) => {
    if (!isClient) return;
    const tileToDelete = tiles.find(t => t.id === tileId);
    setTiles(prevTiles => prevTiles.filter(tile => tile.id !== tileId));
    
    if (editingTile && editingTile.id === tileId) {
      setEditingTile(null); 
      setIsFormOpen(false); 
    }
    if (tileToDelete){
      const tileDisplayName = tileToDelete.modelNumber;
      toast({
        title: t('toastTileDeletedTitle'),
        description: t('toastTileDeletedDescription', { modelNumber: tileDisplayName }),
        variant: "destructive",
      });
    }
  }, [isClient, toast, tiles, editingTile, t]);

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
          <LanguageSwitcher />
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
        
        <div>
          <TileList 
            tiles={tiles} 
            onEditTile={handleEditTile}
            onDeleteTile={handleDeleteTile}
          />
        </div>
      </main>

      <footer className="py-6 mt-auto text-center text-sm text-muted-foreground border-t border-border bg-card">
        <p>{t('footerCopyright', { year: isClient ? new Date().getFullYear().toString() : '...' })}</p>
      </footer>
    </div>
  );
}
