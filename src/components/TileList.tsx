
"use client";

import type { FC } from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Tile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, Layers, Square, Ruler, Package, Edit3, Trash2, SearchX, Search, Tag, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react"; 
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from '@/context/i18n';


interface TileListProps {
  tiles: Tile[];
  onEditTile: (tile: Tile) => void;
  onDeleteTile: (tileId: string) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

const TileList: FC<TileListProps> = ({ tiles, onEditTile, onDeleteTile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tileToDelete, setTileToDelete] = useState<Tile | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[1]);
  const { t } = useTranslation();


  const totalQuantity = useMemo(() => {
    return tiles.reduce((sum, tile) => sum + tile.quantity, 0);
  }, [tiles]);

  const filteredTiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return tiles;
    }

    const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);

    return tiles.filter(tile => {
      return searchTerms.every(term => {
        const sizeMatch = term.match(/^(\d*\.?\d*)x(\d*\.?\d*)$/i);
        if (sizeMatch) {
          const searchWidth = parseFloat(sizeMatch[1]);
          const searchHeight = parseFloat(sizeMatch[2]);
          let widthMatches = true;
          let heightMatches = true;

          if (!Number.isNaN(searchWidth) && sizeMatch[1] !== '') {
            widthMatches = tile.width === searchWidth;
          }
          if (!Number.isNaN(searchHeight) && sizeMatch[2] !== '') {
            heightMatches = tile.height === searchHeight;
          }
          return widthMatches && heightMatches;
        }

        return (
          (tile.modelNumber?.toLowerCase() || '').includes(term)
        );
      });
    });
  }, [tiles, searchTerm]);

  const paginatedTiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTiles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTiles, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTiles.length / itemsPerPage));
  }, [filteredTiles, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm, itemsPerPage]);


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

  const handleExportPDF = () => {
    if (filteredTiles.length === 0) {
      toast({
        title: t("exportNoTiles"),
        description: t("exportNoTilesDescription"),
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    (doc as any).autoTable({
      head: [['Model Number', 'Width (in)', 'Height (in)', 'Quantity']], // These headers are not translated, consider if needed.
      body: filteredTiles.map(tile => [ 
        tile.modelNumber || 'N/A',
        tile.width,
        tile.height,
        tile.quantity,
      ]),
      startY: 20,
      didDrawPage: (data: any) => {
        doc.setFontSize(18);
        doc.text("Zibon Ceramic - Tile Inventory", data.settings.margin.left, 15); // Static title in PDF
      }
    });
    doc.save('zibon_ceramic_tile_inventory.pdf');
    toast({
      title: t("exportSuccessPDF"),
      description: t("tileListCardTitle"), // Using card title as a generic description
    });
  };

  const handleExportExcel = () => {
    if (filteredTiles.length === 0) {
      toast({
        title: t("exportNoTiles"),
        description: t("exportNoTilesDescription"),
        variant: "destructive",
      });
      return;
    }
    const dataToExport = filteredTiles.map(tile => ({ 
      'Model Number': tile.modelNumber || 'N/A', // Headers in Excel not translated
      'Width (in)': tile.width,
      'Height (in)': tile.height,
      'Quantity': tile.quantity,
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tiles');
    XLSX.writeFile(wb, 'zibon_ceramic_tile_inventory.xlsx');
    toast({
      title: t("exportSuccessExcel"),
      description: t("tileListCardTitle"),
    });
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };


  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Archive className="text-primary" />
              {t('tileListCardTitle')}
            </CardTitle>
            <div className="text-lg font-semibold text-right sm:text-left w-full sm:w-auto">
              {t('totalTilesLabel', { count: totalQuantity.toString() })}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 w-full sm:flex-1">
              <Search className="text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                aria-label={t('searchAriaLabel')}
              />
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="w-full sm:w-auto">
                <FileDown className="mr-1 h-4 w-4" /> {t('exportPDF')}
              </Button>
              <Button onClick={handleExportExcel} variant="outline" size="sm" className="w-full sm:w-auto">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> {t('exportExcel')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tiles.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <Layers size={48} className="mx-auto mb-2" />
              <p>{t('noTilesAdded')}</p>
            </div>
          ) : filteredTiles.length === 0 && searchTerm ? (
            <div className="text-center text-muted-foreground py-10">
              <SearchX size={48} className="mx-auto mb-2" />
              <p>{t('noTilesFoundSearch')}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
              {paginatedTiles.map((tile) => (
                <Card key={tile.id} className="w-full max-w-xs sm:w-72 shadow-md hover:shadow-lg transition-shadow duration-200 animate-in fade-in-0 duration-300 ease-out">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Square className="text-primary" size={20} aria-label="Tile icon"/>
                        {tile.modelNumber || 'N/A'}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm pt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Tag size={16} />
                      <span>{t('tileCardModelLabel', { modelNumber: tile.modelNumber || 'N/A' })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Ruler size={16} />
                      <span>{t('tileCardDimensionsLabel', { width: tile.width.toString(), height: tile.height.toString() })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package size={16} />
                      <span>{t('tileCardQuantityLabel', { count: tile.quantity.toString() })}</span>
                    </div>
                     <div className="flex justify-end space-x-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => onEditTile(tile)}>
                        <Edit3 className="mr-1 h-4 w-4" /> {t('editButton')}
                      </Button>
                      <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteClick(tile)}>
                        <Trash2 className="mr-1 h-4 w-4" /> {t('deleteButton')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {filteredTiles.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2 sm:mb-0">
              <span>{t('rowsPerPage')}</span>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue placeholder={itemsPerPage.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={option.toString()}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{t('pageIndicator', { currentPage: currentPage.toString(), totalPages: totalPages.toString() })}</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  aria-label={t('previousPage')}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('previousPage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  aria-label={t('nextPage')}
                >
                  {t('nextPage')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialogDescription', { modelNumber: tileToDelete?.modelNumber || 'N/A' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTileToDelete(null)}>{t('deleteDialogCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {t('deleteDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TileList;
