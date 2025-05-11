
"use client";

import type { FC } from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { GroupedDisplayTile, TileVariant } from "@/types";
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
  onEditVariant: (variantId: string) => void; // Kept for potential future use or specific variant edits
  onDeleteVariant: (variantId: string) => void; // Kept for potential future use
  onEditGroup: (group: GroupedDisplayTile) => void;
  onDeleteGroup: (group: GroupedDisplayTile) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

const TileList: FC<TileListProps> = ({ groupedTiles, onEditVariant, onDeleteVariant, onEditGroup, onDeleteGroup }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'variant', data: TileVariant & { groupModelNumberPrefix: string } } | { type: 'group', data: GroupedDisplayTile } | null>(null);
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


  const handleDeleteVariantClick = (variant: TileVariant, groupModelNumberPrefix: string) => {
    setItemToDelete({ type: 'variant', data: { ...variant, groupModelNumberPrefix } });
    setShowDeleteDialog(true);
  };

  const handleDeleteGroupClick = (group: GroupedDisplayTile) => {
    setItemToDelete({ type: 'group', data: group });
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      if (itemToDelete.type === 'variant') {
        onDeleteVariant(itemToDelete.data.id);
      } else if (itemToDelete.type === 'group') {
        onDeleteGroup(itemToDelete.data);
      }
    }
    setShowDeleteDialog(false);
    setItemToDelete(null);
  };
  
  const getExportableData = () => {
    const dataToExport: any[] = [];
    filteredGroupedTiles.forEach(group => {
      group.variants.forEach(variant => {
        dataToExport.push({
          [t('exportHeaderModelPrefix')]: group.modelNumberPrefix === "N/A" ? '-' : group.modelNumberPrefix,
          [t('exportHeaderType')]: variant.typeSuffix === t('noTypeSuffix') || variant.typeSuffix === "N/A" ? '-' : variant.typeSuffix,
          [t('exportHeaderFullModel')]: variant.typeSuffix && variant.typeSuffix !== t('noTypeSuffix') && variant.typeSuffix !== "N/A" && group.modelNumberPrefix !== "N/A"
                                ? `${group.modelNumberPrefix}-${variant.typeSuffix}` 
                                : (group.modelNumberPrefix === "N/A" && variant.typeSuffix && variant.typeSuffix !== "N/A" && variant.typeSuffix !== t('noTypeSuffix') ? variant.typeSuffix : group.modelNumberPrefix),
          [t('exportHeaderWidth')]: group.width,
          [t('exportHeaderHeight')]: group.height,
          [t('exportHeaderQuantity')]: variant.quantity,
        });
      });
    });
    return dataToExport;
  };


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
            t('exportHeaderModelPrefix'), 
            t('exportHeaderType'), 
            t('exportHeaderFullModel'), 
            t('exportHeaderWidth'), 
            t('exportHeaderHeight'), 
            t('exportHeaderQuantity')
        ]], 
        body: exportData.map(item => [ 
          item[t('exportHeaderModelPrefix')], 
          item[t('exportHeaderType')], 
          item[t('exportHeaderFullModel')], 
          item[t('exportHeaderWidth')], 
          item[t('exportHeaderHeight')], 
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedGroupedTiles.map((group) => (
                <Card key={group.groupKey} className="w-full shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col min-w-[280px] max-w-[400px] mx-auto sm:mx-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Box className="text-primary" size={24} aria-label="Box icon"/>
                      {group.modelNumberPrefix}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Ruler size={14} /> {t('tileCardDimensionsLabel', { width: group.width.toString(), height: group.height.toString() })}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow pt-0 pb-3 px-4 space-y-3">
                    {group.variants.map((variant) => (
                      <div key={variant.id} className="p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                           <Badge variant={variant.typeSuffix === "N/A" || variant.typeSuffix === t('noTypeSuffix') ? "secondary" : "default"} className="text-sm">
                             {variant.typeSuffix === "N/A" || variant.typeSuffix === t('noTypeSuffix') ? t('baseModel') : variant.typeSuffix}
                           </Badge>
                           <span className="text-sm font-medium">
                             {t('tileCardQuantityShortLabel', { count: variant.quantity.toString() })}
                           </span>
                        </div>
                        {/* Individual variant edit/delete can be re-added here if needed by uncommenting and passing onEditVariant/onDeleteVariant */}
                        {/* <div className="flex justify-end space-x-2 mt-2">
                          <Button variant="outline" size="sm" onClick={() => onEditVariant(variant.id)}>
                            <Edit3 className="mr-1 h-3 w-3" /> {t('editButton')}
                          </Button>
                          <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteVariantClick(variant, group.modelNumberPrefix)}>
                            <Trash2 className="mr-1 h-3 w-3" /> {t('deleteButton')}
                          </Button>
                        </div> */}
                      </div>
                    ))}
                  </CardContent>
                   <CardFooter className="pt-3 border-t flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onEditGroup(group)}>
                        <Edit className="mr-1 h-4 w-4" /> {t('editGroupButton')}
                      </Button>
                      <Button variant="destructiveOutline" size="sm" onClick={() => handleDeleteGroupClick(group)}>
                        <Trash className="mr-1 h-4 w-4" /> {t('deleteGroupButton')}
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
              {itemToDelete?.type === 'variant' && t('deleteDialogDescriptionVariant', { 
                type: itemToDelete.data.typeSuffix === "N/A" || itemToDelete.data.typeSuffix === t('noTypeSuffix') ? t('baseModel') : itemToDelete.data.typeSuffix, 
                modelNumber: itemToDelete.data.groupModelNumberPrefix 
              })}
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

    