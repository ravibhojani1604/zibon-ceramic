// @ts-nocheck
"use client";

import type { FC } from 'react';
import type { Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Archive, Layers, Square, Ruler, Package } from "lucide-react"; 

interface TileListProps {
  tiles: Tile[];
}

const TileList: FC<TileListProps> = ({ tiles }) => {
  const totalQuantity = tiles.reduce((sum, tile) => sum + tile.quantity, 0);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center gap-2">
            <Archive className="text-primary" />
            Current Inventory
          </CardTitle>
          <div className="text-lg font-semibold">
            Total Tiles: <span className="text-primary">{totalQuantity}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tiles.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            <Layers size={48} className="mx-auto mb-2" />
            <p>No tiles added yet. Use the form to add your first tile.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tiles.map((tile) => (
              <Card key={tile.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 animate-in fade-in-0 duration-300 ease-out">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Square className="text-primary" size={20} aria-label="Tile icon"/>
                    {tile.type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Ruler size={16} />
                    <span>Dimensions: {`${tile.width} x ${tile.height} cm`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package size={16} />
                    <span>Quantity: {tile.quantity}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TileList;
