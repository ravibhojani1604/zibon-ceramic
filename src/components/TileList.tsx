

"use client";

import type { FC } from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { GroupedDisplayTile, TileVariantDisplay } from "@/types";
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
import { Archive, Layers, Square, Ruler, Edit3, Trash2, SearchX, Search, Tag, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, Box, Edit, Trash } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from '@/context/i18n';
import { Badge } from '@/components/ui/badge';


interface TileListProps {
  groupedTiles: GroupedDisplayTile[];
  onEditGroup: (group: GroupedDisplayTile) => void;
  onDeleteGroup: (group: GroupedDisplayTile) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

const TileList: FC<TileListProps> = ({ groupedTiles, onEditGroup, onDeleteGroup }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'group', data: GroupedDisplayTile } | null>(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[1]);
  const { t } = useTranslation();

  const totalGroupedQuantity = useMemo(() => {
    return groupedTiles.reduce((sum, group) => 
      sum + group.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0)
    , 0);
  }, [groupedTiles]);

  const filteredGroupedTiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return groupedTiles;
    }
    const searchLower = searchTerm.toLowerCase();
    return groupedTiles.filter(group => {
      const modelMatch = group.modelNumberPrefix.toLowerCase().includes(searchLower);
      const dimensionMatch = `${group.width}x${group.height}`.includes(searchLower) || 
                             `${group.width} x ${group.height}`.includes(searchLower);
      const typeMatch = group.variants.some(variant => variant.typeSuffix.toLowerCase().includes(searchLower));
      
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
  }, [groupedTiles, searchTerm]);

  const paginatedGroupedTiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGroupedTiles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGroupedTiles, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredGroupedTiles.length / itemsPerPage));
  }, [filteredGroupedTiles, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm, itemsPerPage]);


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
    filteredGroupedTiles.forEach(group => {
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
  }, [filteredGroupedTiles, t]);


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
      XLSX.utils.book_append_sheet(wb, ws, t('excelSheetName')); // Using translated sheet name
      XLSX.writeFile(wb, 'zibon_ceramic_tile_inventory.xlsx');
      toast({ title: t("exportSuccessExcel"), description: t("tileListCardTitle") });
    } catch (error) {
      console.error("Failed to load Excel export library or export Excel:", error);
      toast({ title: t("exportErrorTitle"), description: t("exportErrorExcelDescription"), variant: "destructive" });
    }
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
              {t('totalTilesLabel', { count: totalGroupedQuantity.toString() })}
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
            <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              <Button onClick={handleExportPDF} variant="outline" size="sm" className="w-full sm:w-auto text-xs px-2 sm:text-sm sm:px-3"> {/* Adjusted button padding and text size */}
                <FileDown className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('downloadPDF')}
              </Button>
              <Button onClick={handleExportExcel} variant="outline" size="sm" className="w-full sm:w-auto text-xs px-2 sm:text-sm sm:px-3"> {/* Adjusted button padding and text size */}
                <FileSpreadsheet className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('downloadExcel')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center items-start px-2 py-4 sm:px-6 sm:py-6">
          {groupedTiles.length === 0 && !searchTerm ? (
            <div className="text-center text-muted-foreground py-10">
              <Layers size={48} className="mx-auto mb-2" />
              <p>{t('noTilesAdded')}</p>
            </div>
          ) : filteredGroupedTiles.length === 0 && searchTerm ? (
            <div className="text-center text-muted-foreground py-10">
              <SearchX size={48} className="mx-auto mb-2" />
              <p>{t('noTilesFoundSearch')}</p>
            </div>
          ) : (
            <div className="inline-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-4">
              {paginatedGroupedTiles.map((group) => (
                <Card key={group.groupKey} className="w-full shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col max-w-[400px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Box className="text-primary" size={24} aria-label="Box icon"/>
                      {group.modelNumberPrefix}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Ruler size={14} /> {t('tileCardDimensionsLabel', { width: group.width.toString(), height: group.height.toString() })}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow pt-2 pb-3 px-4 flex flex-col items-center space-y-2">
                    {group.variants.map((variant) => (
                      <div key={variant.id} className="p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors shadow-sm w-full max-w-xs"> 
                        <div className="flex justify-between items-center min-w-[150px] gap-4">
                           <Badge variant={variant.typeSuffix === "N/A" || variant.typeSuffix === t('noTypeSuffix') ? "secondary" : "default"} className="text-sm">
                             {variant.typeSuffix === "N/A" || variant.typeSuffix === t('noTypeSuffix') ? t('baseModel') : variant.typeSuffix}
                           </Badge>
                           <span className="text-sm font-medium">
                             {t('tileCardQuantityShortLabel', { count: variant.quantity.toString() })}
                           </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                   <CardFooter className="pt-3 pb-4 px-4 border-t flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onEditGroup(group)} className="w-full sm:w-auto text-xs px-2 sm:text-sm sm:px-3"> {/* Adjusted button padding and text size */}
                        <Edit className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('editGroupButton')}
                      </Button>
                      <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteGroupClick(group)} className="w-full sm:w-auto text-xs px-2 sm:text-sm sm:px-3"> {/* Adjusted button padding and text size */}
                        <Trash className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {t('deleteGroupButton')}
                      </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {filteredGroupedTiles.length > 0 && (
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
                  <span className="hidden sm:inline">{t('previousPage')}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  aria-label={t('nextPage')}
                >
                  <span className="hidden sm:inline">{t('nextPage')}</span>
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

