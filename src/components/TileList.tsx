"use client";

import type { FC } from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { GroupedDisplayTile } from "@/types"; // TileVariantDisplay removed as it's internal to GroupedDisplayTile
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Archive, Layers, Square, Ruler, Edit, Trash, SearchX, Search, Tag, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, Box, Loader2 } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from '@/context/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface TileListProps {
  groupedTiles: GroupedDisplayTile[];
  onEditGroup: (group: GroupedDisplayTile) => void;
  onDeleteGroup: (group: GroupedDisplayTile) => void;
  currentPage: number;
  itemsPerPage: number;
  totalTileDocs: number; // This is total documents, not groups
  onPageChange: (newPage: number, direction: 'next' | 'prev' | 'initial') => void;
  onItemsPerPageChange: (newItemsPerPage: number) => void;
  isLoading: boolean; 
}

// Export this so InventoryPage can use it if needed, or it can be moved to a shared constants file
export const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50]; 

const TileList: FC<TileListProps> = ({ 
  groupedTiles, 
  onEditGroup, 
  onDeleteGroup,
  currentPage,
  itemsPerPage,
  totalTileDocs,
  onPageChange,
  onItemsPerPageChange,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'group', data: GroupedDisplayTile } | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();


  const filteredGroupedTiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return groupedTiles;
    }
    const searchLower = searchTerm.toLowerCase();
    return groupedTiles.filter(group => {
      const modelMatch = group.modelNumberPrefix.toLowerCase().includes(searchLower);
      const dimensionMatch = `${group.width}x${group.height}`.includes(searchLower) || 
                             `${group.width} x ${group.height}`.includes(searchLower);
      
      const typeMatch = group.variants.some(variant => 
        variant.typeSuffix.toLowerCase().includes(searchLower) ||
        (variant.typeSuffix === t('noTypeSuffix') && t('noTypeSuffix').toLowerCase().includes(searchLower))
      );
      
      const parts = searchLower.split(/[\s-]+/).filter(p => p);
      let advancedMatch = false;
      if (parts.length > 1) {
        const potentialModelPrefix = parts.slice(0, -1).join("").toLowerCase(); 
        const potentialTypeSuffix = parts[parts.length - 1].toLowerCase();
        if (group.modelNumberPrefix.toLowerCase().includes(potentialModelPrefix)) {
            advancedMatch = group.variants.some(v => v.typeSuffix.toLowerCase().includes(potentialTypeSuffix));
        }
      }
      return modelMatch || dimensionMatch || typeMatch || advancedMatch;
    });
  }, [groupedTiles, searchTerm, t]);


  const totalPages = useMemo(() => {
    // totalPages is based on totalTileDocs (individual documents) and itemsPerPage (documents per fetch)
    return Math.max(1, Math.ceil(totalTileDocs / itemsPerPage));
  }, [totalTileDocs, itemsPerPage]);

  // This useEffect for resetting page on search might not be ideal with server-side pagination
  // as search itself should ideally trigger a new fetch from the server.
  // For now, if search is client-side only on the current page's data:
  useEffect(() => {
    if (searchTerm && currentPage !== 1 && filteredGroupedTiles.length === 0 && groupedTiles.length > 0) {
      // If search yields no results on current page, but there was data,
      // it implies client-side filtering. No server page change needed here.
      // If search were server-side, this would be different.
    }
  }, [searchTerm, currentPage, filteredGroupedTiles.length, groupedTiles.length]);


  const handleDeleteGroupClick = (group: GroupedDisplayTile) => {
    setItemToDelete({ type: 'group', data: group });
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (itemToDelete && itemToDelete.type === 'group') {
      onDeleteGroup(itemToDelete.data);
    }
    setShowDeleteDialog(false);
    setItemToDelete(null);
  };
  
  const getExportableData = useCallback(() => {
    const dataToExport: any[] = [];
    // Use filteredGroupedTiles for export if search is active, otherwise all currently loaded groupedTiles
    const sourceTiles = searchTerm ? filteredGroupedTiles : groupedTiles;
    sourceTiles.forEach(group => {
      group.variants.forEach(variant => {
        dataToExport.push({
          [t('exportHeaderFullModel')]: variant.typeSuffix && variant.typeSuffix !== t('noTypeSuffix') && variant.typeSuffix !== "N/A" && group.modelNumberPrefix !== "N/A"
                                ? `${group.modelNumberPrefix}-${variant.typeSuffix}` 
                                : (group.modelNumberPrefix === "N/A" && variant.typeSuffix && variant.typeSuffix !== "N/A" && variant.typeSuffix !== t('noTypeSuffix') ? variant.typeSuffix : group.modelNumberPrefix),
          [t('exportHeaderDimensions')]: `${group.width} x ${group.height}`,
          [t('exportHeaderQuantity')]: variant.quantity,
        });
      });
    });
    return dataToExport;
  }, [groupedTiles, filteredGroupedTiles, searchTerm, t]);


  const handleExportPDF = async () => {
    const exportData = getExportableData();
    if (exportData.length === 0) {
      toast({ title: t("exportNoTiles"), description: t("exportNoTilesDescription"), variant: "destructive" });
      return;
    }
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      autoTable(doc, {
        head: [[
            t('exportHeaderFullModel'), 
            t('exportHeaderDimensions'), 
            t('exportHeaderQuantity')
        ]], 
        body: exportData.map(item => [ 
          item[t('exportHeaderFullModel')], 
          item[t('exportHeaderDimensions')], 
          item[t('exportHeaderQuantity')]
        ]),
        startY: 20,
        didDrawPage: (data: any) => {
          doc.setFontSize(18);
          doc.text(t('pdfExportTitle'), data.settings.margin.left, 15);
        }
      });
      doc.save('zibon_ceramic_tile_inventory.pdf');
      toast({ title: t("exportSuccessPDF"), description: t("tileListCardTitle") });
    } catch (error) {
      console.error("Failed to load PDF export libraries or export PDF:", error);
      toast({ title: t("exportErrorTitle"), description: t("exportErrorPdfDescription"), variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    const exportData = getExportableData();
     if (exportData.length === 0) {
      toast({ title: t("exportNoTiles"), description: t("exportNoTilesDescription"), variant: "destructive" });
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('excelSheetName'));
      XLSX.writeFile(wb, 'zibon_ceramic_tile_inventory.xlsx');
      toast({ title: t("exportSuccessExcel"), description: t("tileListCardTitle") });
    } catch (error) {
      console.error("Failed to load Excel export library or export Excel:", error);
      toast({ title: t("exportErrorTitle"), description: t("exportErrorExcelDescription"), variant: "destructive" });
    }
  };


  const handleItemsPerPageChangeInternal = (value: string) => {
    onItemsPerPageChange(parseInt(value, 10));
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1, 'prev');
    }
  };

  const goToNextPage = () => {
     // Disable if on the last page, determined by totalTileDocs and itemsPerPage
     // Or if currently fetched group count is less than itemsPerPage (assuming itemsPerPage is for groups)
     // The current logic is based on documents, so totalPages is document-based.
     if (currentPage < totalPages) { 
       onPageChange(currentPage + 1, 'next');
    }
  };

  const isEffectivelyLastPage = groupedTiles.length < itemsPerPage && totalTileDocs > 0 && (currentPage * itemsPerPage >= totalTileDocs - itemsPerPage);


  return (
    <>
      <Card className="shadow-lg rounded-xl flex flex-col flex-grow m-2 sm:m-4">
        <CardHeader className="px-4 py-4 sm:px-6 sm:py-5 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Archive className="text-primary h-5 w-5 sm:h-6 sm:w-6" />
              {t('tileListCardTitle')}
            </CardTitle>
             <div className="text-sm sm:text-base font-semibold text-right sm:text-left w-full sm:w-auto text-muted-foreground">
              {t('totalTilesInDBLabel', { count: totalTileDocs.toString() })}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 w-full sm:flex-1">
              <Search className="text-muted-foreground h-4 w-4 sm:h-5 sm:w-5" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm sm:text-base"
                aria-label={t('searchAriaLabel')}
              />
            </div>
            <div className="flex flex-col xs:flex-row gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="w-full xs:w-auto text-xs px-2 py-1.5 sm:text-sm sm:px-3 whitespace-nowrap">
                <FileDown className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('downloadPDF')}
              </Button>
              <Button onClick={handleExportExcel} variant="outline" size="sm" className="w-full xs:w-auto text-xs px-2 py-1.5 sm:text-sm sm:px-3 whitespace-nowrap">
                <FileSpreadsheet className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('downloadExcel')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow px-2 py-4 sm:px-4 sm:py-6 min-h-[calc(100vh-300px)] sm:min-h-[calc(100vh-350px)]">
          {isLoading && groupedTiles.length === 0 ? (
             <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
                <Loader2 size={48} className="mx-auto mb-4 animate-spin text-primary" />
                <p>{t('loadingTiles')}</p>
             </div>
          ) : !isLoading && groupedTiles.length === 0 && !searchTerm && totalTileDocs === 0 ? (
            <div className="text-center text-muted-foreground py-10 w-full h-full flex flex-col justify-center items-center">
              <Layers size={48} className="mx-auto mb-2" />
              <p>{t('noTilesAdded')}</p>
            </div>
          ) : !isLoading && filteredGroupedTiles.length === 0 && searchTerm ? (
             <div className="text-center text-muted-foreground py-10 w-full h-full flex flex-col justify-center items-center">
              <SearchX size={48} className="mx-auto mb-2" />
              <p>{t('noTilesFoundSearch')}</p>
            </div>
          ) : !isLoading && groupedTiles.length === 0 && totalTileDocs > 0 ? (
            <div className="text-center text-muted-foreground py-10 w-full h-full flex flex-col justify-center items-center">
              <Layers size={48} className="mx-auto mb-2" />
              <p>{t('noTilesOnPage')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 w-full items-start justify-center">
              {filteredGroupedTiles.map((group) => (
                <Card key={group.groupKey} className="w-full max-w-sm mx-auto shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col rounded-lg">
                  <CardHeader className="pb-3 px-4 pt-4 sm:px-5 sm:pt-5">
                    <CardTitle className="text-md sm:text-lg flex items-center gap-2">
                      <Box className="text-primary h-5 w-5 sm:h-6 sm:w-6" aria-label="Box icon"/>
                      {group.modelNumberPrefix}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                      <Ruler size={14} /> {t('tileCardDimensionsLabel', { width: group.width.toString(), height: group.height.toString() })}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow pt-2 pb-3 px-4 sm:px-5 flex flex-col items-stretch space-y-2">
                    {group.variants.map((variant) => (
                      <div key={variant.id} className="p-2 sm:p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors shadow-sm w-full"> 
                        <div className="flex justify-between items-center min-w-[100px] gap-2 sm:gap-4">
                           <Badge variant={variant.typeSuffix === "N/A" || variant.typeSuffix === t('noTypeSuffix') ? "secondary" : "default"} className="text-xs sm:text-sm px-2 py-0.5 sm:px-3 sm:py-1 truncate">
                             {variant.typeSuffix}
                           </Badge>
                           <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                             {t('tileCardQuantityShortLabel', { count: variant.quantity.toString() })}
                           </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                   <CardFooter className="pt-3 pb-4 px-4 sm:px-5 border-t flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onEditGroup(group)} className="w-full sm:w-auto text-xs px-2 py-1.5 sm:text-sm sm:px-3">
                        <Edit className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('editGroupButton')}
                      </Button>
                      <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteGroupClick(group)} className="w-full sm:w-auto text-xs px-2 py-1.5 sm:text-sm sm:px-3">
                        <Trash className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('deleteGroupButton')}
                      </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {totalTileDocs > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-0">
              <span>{t('rowsPerPage')}</span>
              <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChangeInternal}>
                <SelectTrigger className="w-[70px] h-8 text-xs sm:text-sm">
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
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground">
              <span>{t('pageIndicator', { currentPage: currentPage.toString(), totalPages: totalPages.toString() })}</span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1 || isLoading}
                  aria-label={t('previousPage')}
                  className="px-2 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1 text-xs sm:text-sm">{t('previousPage')}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages || groupedTiles.length < itemsPerPage || isLoading}
                  aria-label={t('nextPage')}
                  className="px-2 sm:px-3"
                >
                  <span className="hidden sm:inline mr-1 text-xs sm:text-sm">{t('nextPage')}</span>
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
              {itemToDelete?.type === 'group' && t('deleteDialogDescriptionGroup', { 
                modelNumberPrefix: itemToDelete.data.modelNumberPrefix 
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>{t('deleteDialogCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={cn(buttonVariants({variant: "destructive"}))}>
              {t('deleteDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TileList;
