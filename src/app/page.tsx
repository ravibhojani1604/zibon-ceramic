"use client";

import { useState, useEffect, useCallback } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function InventoryPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const savedTiles = localStorage.getItem('tileInventory');
    if (savedTiles) {
      try {
        const parsedTiles = JSON.parse(savedTiles);
        if (Array.isArray(parsedTiles)) {
          // Ensure loaded tiles conform to the new structure or have defaults
          const migratedTiles = parsedTiles.map(tile => ({
            id: tile.id,
            modelNumber: tile.modelNumber || (tile.type ? String(tile.type) : 'N/A'), // Basic migration/default
            material: tile.material || 'Unknown', // Basic migration/default
            width: tile.width,
            height: tile.height,
            quantity: tile.quantity,
          }));
          setTiles(migratedTiles);
        }
      } catch (error) {
        console.error("Failed to parse tiles from localStorage", error);
        // Potentially set empty array if parsing fails or old data is incompatible
        setTiles([]);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('tileInventory', JSON.stringify(tiles));
    }
  }, [tiles, isClient]);

  const handleSaveTile = useCallback((data: TileFormData, id?: string) => {
    if (!isClient) return;

    const tileDisplayName = `${data.modelNumber} - ${data.material}`;

    if (id) { // Update existing tile
      setTiles(prevTiles =>
        prevTiles.map(tile => (tile.id === id ? { ...tile, ...data } : tile))
      );
      toast({
        title: "Tile Updated",
        description: `The tile "${tileDisplayName}" has been updated successfully.`,
        variant: "default",
      });
      setEditingTile(null); 
    } else { // Add new tile
      const newTile: Tile = {
        id: crypto.randomUUID(),
        ...data,
      };
      setTiles(prevTiles => [newTile, ...prevTiles]);
      toast({
        title: "Tile Added",
        description: `New tile "${tileDisplayName}" has been added successfully.`,
        variant: "default",
      });
    }
  }, [isClient, toast]);

  const handleEditTile = useCallback((tile: Tile) => {
    setEditingTile(tile);
    const formElement = document.getElementById('tile-form-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTile(null);
  }, []);

  const handleDeleteTile = useCallback((tileId: string) => {
    if (!isClient) return;
    const tileToDelete = tiles.find(t => t.id === tileId);
    setTiles(prevTiles => prevTiles.filter(tile => tile.id !== tileId));
    if (editingTile && editingTile.id === tileId) {
      setEditingTile(null); 
    }
    if (tileToDelete){
      const tileDisplayName = `${tileToDelete.modelNumber} - ${tileToDelete.material}`;
      toast({
        title: "Tile Deleted",
        description: `The tile "${tileDisplayName}" has been deleted.`,
        variant: "destructive",
      });
    }
  }, [isClient, toast, tiles, editingTile]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="py-6 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-8 flex items-center gap-3">
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
            Zibon Ceramic
          </h1>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1" id="tile-form-card">
            <TileForm 
              onSaveTile={handleSaveTile} 
              editingTile={editingTile}
              onCancelEdit={handleCancelEdit}
            />
          </div>
          <div className="lg:col-span-2">
            <TileList 
              tiles={tiles} 
              onEditTile={handleEditTile}
              onDeleteTile={handleDeleteTile}
            />
          </div>
        </div>
      </main>

      <footer className="py-6 mt-auto text-center text-sm text-muted-foreground border-t border-border bg-card">
        <p>© {isClient ? new Date().getFullYear() : '...'} Zibon Ceramic. All rights reserved.</p>
      </footer>
    </div>
  );
}
