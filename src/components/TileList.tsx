
"use client";

import type { FC } from 'react';
import { useState, useMemo } from 'react';
import type { Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Layers, Square, Ruler, Package, Edit3, Trash2, SearchX, Search } from "lucide-react"; 

interface TileListProps {
  tiles: Tile[];
  onEditTile: (tile: Tile) => void;
  onDeleteTile: (tileId: string) => void;
}

const TileList: FC<TileListProps> = ({ tiles, onEditTile, onDeleteTile }) => {
  const [searchTermType, setSearchTermType] = useState('');
  const [searchTermWidth, setSearchTermWidth] = useState('');
  const [searchTermHeight, setSearchTermHeight] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tileToDelete, setTileToDelete] = useState<Tile | null>(null);

  const totalQuantity = useMemo(() => {
    return tiles.reduce((sum, tile) => sum + tile.quantity, 0);
  }, [tiles]);

  const filteredTiles = useMemo(() => {
    return tiles.filter(tile => {
      const typeMatch = searchTermType === '' || tile.type.toLowerCase().includes(searchTermType.toLowerCase());
      
      const searchWidthNum = parseFloat(searchTermWidth);
      const widthMatch = searchTermWidth === '' || Number.isNaN(searchWidthNum) ? true : tile.width === searchWidthNum;
      
      const searchHeightNum = parseFloat(searchTermHeight);
      const heightMatch = searchTermHeight === '' || Number.isNaN(searchHeightNum) ? true : tile.height === searchHeightNum;
      
      return typeMatch && widthMatch && heightMatch;
    });
  }, [tiles, searchTermType, searchTermWidth, searchTermHeight]);

  const handleDeleteClick = (tile: Tile) => {
    setTileToDelete(tile);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (tileToDelete) {
      onDeleteTile(tileToDelete.id);
    }
    setShowDeleteDialog(false);
    setTileToDelete(null);
  };

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Archive className="text-primary" />
              Current Inventory
            </CardTitle>
            <div className="text-lg font-semibold">
              Total Tiles: <span className="text-primary">{totalQuantity}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <Input
              placeholder="Search by type..."
              value={searchTermType}
              onChange={(e) => setSearchTermType(e.target.value)}
              className="w-full"
              aria-label="Search by tile type"
            />
            <Input
              type="number"
              placeholder="Width (in)"
              value={searchTermWidth}
              onChange={(e) => setSearchTermWidth(e.target.value)}
              className="w-full"
              aria-label="Search by tile width in inches"
            />
            <Input
              type="number"
              placeholder="Height (in)"
              value={searchTermHeight}
              onChange={(e) => setSearchTermHeight(e.target.value)}
              className="w-full"
              aria-label="Search by tile height in inches"
            />
          </div>
        </CardHeader>
        <CardContent>
          {tiles.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <Layers size={48} className="mx-auto mb-2" />
              <p>No tiles added yet. Use the form to add your first tile.</p>
            </div>
          ) : filteredTiles.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <SearchX size={48} className="mx-auto mb-2" />
              <p>No tiles match your search criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTiles.map((tile) => (
                <Card key={tile.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 animate-in fade-in-0 duration-300 ease-out">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Square className="text-primary" size={20} aria-label="Tile icon"/>
                        {tile.type}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Ruler size={16} />
                      <span>Dimensions: {`${tile.width} x ${tile.height} in`}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package size={16} />
                      <span>Quantity: {tile.quantity}</span>
                    </div>
                    <div className="sm:col-span-2 flex justify-end space-x-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => onEditTile(tile)}>
                        <Edit3 className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteClick(tile)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tile
              "{tileToDelete?.type}" from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTileToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TileList;

