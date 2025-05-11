
"use client";

import type { FC } from 'react';
import { useEffect, useMemo } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Edit3, XCircle } from "lucide-react";
import type { Tile } from "@/types";
import { useTranslation } from '@/context/i18n';

const modelNumberSuffixOptions = ["L", "HL-1", "HL-2", "HL-3", "D", "F"];
const FORM_FIELD_EMPTY_SUFFIX_VALUE = ""; 
const SELECT_ITEM_VALUE_FOR_NONE_SUFFIX = "_INTERNAL_NONE_SUFFIX_";


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string) => z.object({
  modelNumberPrefix: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : val), 
    z.coerce.number({ invalid_type_error: t("modelNumberPrefixInvalidError")})
      .positive({ message: t("modelNumberPrefixPositiveError") })
      .optional()
  ),
  modelNumberSuffix: z.string().optional(),
  width: z.coerce.number({invalid_type_error: t("widthRequiredError")}).positive({ message: t("widthPositiveError") }),
  height: z.coerce.number({invalid_type_error: t("heightRequiredError")}).positive({ message: t("heightPositiveError") }),
  quantity: z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }),
}).refine(data => data.modelNumberPrefix !== undefined || (data.modelNumberSuffix && data.modelNumberSuffix !== FORM_FIELD_EMPTY_SUFFIX_VALUE && data.modelNumberSuffix !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX), {
  message: t("modelNumberRequiredError"),
  path: ["modelNumberPrefix"], 
});

export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const { t } = useTranslation();
  const tileSchema = useMemo(() => getTileSchema(t), [t]);

  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      modelNumberPrefix: undefined,
      modelNumberSuffix: FORM_FIELD_EMPTY_SUFFIX_VALUE, 
      width: undefined, 
      height: undefined,
      quantity: undefined,
    },
  });

  useEffect(() => {
    if (editingTile) {
      let parsedPrefix: number | undefined = undefined;
      let parsedSuffix: string = FORM_FIELD_EMPTY_SUFFIX_VALUE;

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let foundMatch = false;
        
        const sortedSuffixOptions = [...modelNumberSuffixOptions].sort((a, b) => b.length - a.length);

        for (const opt of sortedSuffixOptions) {
          if (fullMN.endsWith(`-${opt}`)) {
            const prefixStr = fullMN.substring(0, fullMN.length - opt.length - 1);
            if (prefixStr.length > 0) {
              const num = parseFloat(prefixStr);
              if (!isNaN(num)) parsedPrefix = num;
            }
            parsedSuffix = opt;
            foundMatch = true;
            break;
          } else if (fullMN === opt && !sortedSuffixOptions.some(sOpt => fullMN.startsWith(sOpt + "-") || sortedSuffixOptions.some(sOpt2 => sOpt2 !== opt && fullMN.endsWith("-" + sOpt2)) )) {
            // Handles cases where model number is just a suffix, e.g. "L"
            // And ensure it's not a prefix of another suffix (e.g. "H" vs "HL-1")
            // Or that no other suffix is part of a combined model number like "123-L-D" (though current logic may not fully support this complex case)
            if (!parsedPrefix && !parsedSuffix) { // only if nothing else matched
                parsedSuffix = opt;
                foundMatch = true;
                break;
            }
          }
        }
        
        if (!foundMatch && fullMN.length > 0) {
            // Attempt to parse as a pure number if no suffix match
            const num = parseFloat(fullMN);
            if (!isNaN(num) && String(num) === fullMN) { 
                parsedPrefix = num;
            } else {
                // Fallback: try to extract leading number if any part is non-numeric and not a known suffix
                 const leadingNumberMatch = fullMN.match(/^(\d+(\.\d+)?)/);
                 if (leadingNumberMatch) {
                    parsedPrefix = parseFloat(leadingNumberMatch[1]);
                    // Potentially, the rest could be a custom suffix, but current logic doesn't store custom suffix input
                 }
                 // If no numeric prefix and no known suffix, it might be a fully custom model number
                 // or a suffix-only model number not caught above.
                 // For now, if it's not purely numeric, and not a known suffix ending, 
                 // we'll assume it's either a custom suffix or prefix was not number.
                 // The form currently doesn't have a field for "custom suffix text", so this part is tricky.
                 // Let's assume if not parsed as prefix/suffix, it's a prefix that might not be a number, or custom.
                 // We'll assign it to prefix field if it's numeric, otherwise leave suffix blank.
                 // This part of logic might need refinement based on how "custom" model numbers are structured.
            }
        }
      }
      form.reset({
        modelNumberPrefix: parsedPrefix,
        modelNumberSuffix: parsedSuffix, 
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity,
      });
    } else {
      form.reset({
        modelNumberPrefix: undefined,
        modelNumberSuffix: FORM_FIELD_EMPTY_SUFFIX_VALUE, 
        width: undefined,
        height: undefined,
        quantity: undefined,
      });
    }
  }, [editingTile, form]);

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!editingTile) { 
        form.reset(); 
    }
  };

  const isEditing = !!editingTile;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          {isEditing ? <Edit3 className="text-primary" /> : <PlusCircle className="text-primary" />}
          {isEditing ? t('tileFormCardTitleEdit') : t('tileFormCardTitleAdd')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <FormLabel>{t('modelNumberLabel')}</FormLabel>
              <div className="flex gap-2 items-start mt-1">
                <FormField
                  control={form.control}
                  name="modelNumberPrefix"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={t('modelNumberPrefixPlaceholder')} 
                          {...field} 
                          value={field.value ?? ''} 
                          onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                          step="any"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modelNumberSuffix"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select 
                        onValueChange={(selectedValue) => {
                          field.onChange(selectedValue === SELECT_ITEM_VALUE_FOR_NONE_SUFFIX ? FORM_FIELD_EMPTY_SUFFIX_VALUE : selectedValue);
                        }}
                        value={
                          (field.value === FORM_FIELD_EMPTY_SUFFIX_VALUE || typeof field.value === 'undefined')
                            ? SELECT_ITEM_VALUE_FOR_NONE_SUFFIX
                            : field.value
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('modelNumberSuffixPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_ITEM_VALUE_FOR_NONE_SUFFIX}>{t('modelNumberSuffixNone')}</SelectItem>
                          {modelNumberSuffixOptions.map(option => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               {form.formState.errors.modelNumberPrefix && form.formState.errors.modelNumberPrefix.message?.includes(t("modelNumberRequiredError")) && (
                <p className="text-sm font-medium text-destructive pt-1">{t("modelNumberRequiredError")}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('widthLabel')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={t('widthPlaceholder')} 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                        step="any" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('heightLabel')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={t('heightPlaceholder')} 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                        step="any"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('quantityLabel')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder={t('quantityPlaceholder')} 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          field.onChange(undefined);
                        } else {
                          const num = parseInt(val, 10);
                          field.onChange(isNaN(num) ? undefined : num);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-2">
              <Button type="submit" className="w-full">
                {isEditing ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isEditing ? t('updateTileButton') : t('addTileButton')}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={() => { form.reset(); onCancelEdit();}} className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('cancelButton')}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TileForm;
