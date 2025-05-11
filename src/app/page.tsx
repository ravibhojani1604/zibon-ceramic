"use client";

import { useState, useEffect } from 'react';
import TileForm, { type TileFormData } from "@/components/TileForm";
import TileList from "@/components/TileList";
import type { Tile } from "@/types";

export default function InventoryPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Optionally load saved tiles from localStorage
    const savedTiles = localStorage.getItem('tileInventory');
    if (savedTiles) {
      try {
        const parsedTiles = JSON.parse(savedTiles);
        if (Array.isArray(parsedTiles)) {
          setTiles(parsedTiles);
        }
      } catch (error) {
        console.error("Failed to parse tiles from localStorage", error);
      }
    }
  }, []);

  useEffect(() => {
    // Save tiles to localStorage whenever they change
    if (isClient) { // Ensure this only runs on client
        localStorage.setItem('tileInventory', JSON.stringify(tiles));
    }
  }, [tiles, isClient]);


  const handleAddTile = (data: TileFormData) => {
    if (!isClient) return; // Ensure crypto.randomUUID is available
    const newTile: Tile = {
      id: crypto.randomUUID(),
      ...data,
    };
    setTiles((prevTiles) => [newTile, ...prevTiles]); // Add new tile to the beginning of the list
  };

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
          <div className="lg:col-span-1">
            <TileForm onAddTile={handleAddTile} />
          </div>
          <div className="lg:col-span-2">
            <TileList tiles={tiles} />
          </div>
        </div>
      </main>

      <footer className="py-6 mt-auto text-center text-sm text-muted-foreground border-t border-border bg-card">
        <p>© {isClient ? new Date().getFullYear() : '...'} Zibon Ceramic. All rights reserved.</p>
      </footer>
    </div>
  );
}
