"use client";

import type { FC } from 'react';
import type { Tile } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Layers, Square } from "lucide-react"; // Square for tile icon, Layers for total

interface TileListProps {
  tiles: Tile[];
}

const TileList: FC<TileListProps> = ({ tiles }) => {
  const totalQuantity = tiles.reduce((sum, tile) => sum + tile.quantity, 0);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Archive className="text-primary" />
          Current Inventory
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tiles.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            <Layers size={48} className="mx-auto mb-2" />
            <p>No tiles added yet. Use the form to add your first tile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">Icon</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Dimensions (WxH cm)</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiles.map((tile) => (
                  <TableRow key={tile.id} className="animate-in fade-in-0 duration-300 ease-out">
                    <TableCell className="text-center">
                      <Square className="mx-auto text-primary" size={20} aria-label="Tile icon"/>
                    </TableCell>
                    <TableCell className="font-medium">{tile.type}</TableCell>
                    <TableCell className="text-right">{`${tile.width} x ${tile.height}`}</TableCell>
                    <TableCell className="text-right">{tile.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
               <TableCaption className="mt-4 text-lg font-semibold">
                Total Tile Count: <span className="text-primary">{totalQuantity}</span>
              </TableCaption>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TileList;
