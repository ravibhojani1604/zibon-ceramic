
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Edit3, XCircle } from "lucide-react";
import type { Tile } from "@/types";
import { useTranslation } from '@/context/i18n';

// Suffixes for the Select dropdown
const SELECT_SUFFIX_OPTIONS = ["L", "HL-3", "D", "F"] as const;
// Suffixes for Checkboxes
const CHECKBOX_SUFFIX_HL1 = "HL-1";
const CHECKBOX_SUFFIX_HL2 = "HL-2";

const FORM_FIELD_EMPTY_SUFFIX_VALUE = "";
const SELECT_ITEM_VALUE_FOR_NONE_SUFFIX = "_INTERNAL_NONE_SUFFIX_";


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string, isEditing: boolean) => z.object({
  modelNumberPrefix: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : val),
    z.coerce.number({ invalid_type_error: t("modelNumberPrefixInvalidError")})
      .positive({ message: t("modelNumberPrefixPositiveError") })
      .optional()
  ),
  modelNumberSuffixSelect: z.string().optional(), // Value from SELECT_SUFFIX_OPTIONS or SELECT_ITEM_VALUE_FOR_NONE_SUFFIX
  [CHECKBOX_SUFFIX_HL1]: z.boolean().optional(),
  [CHECKBOX_SUFFIX_HL2]: z.boolean().optional(),
  width: z.coerce.number({invalid_type_error: t("widthRequiredError")}).positive({ message: t("widthPositiveError") }),
  height: z.coerce.number({invalid_type_error: t("heightRequiredError")}).positive({ message: t("heightPositiveError") }),
  quantity: z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }),
}).refine(data => {
  const prefixProvided = data.modelNumberPrefix !== undefined;
  const selectSuffixProvided = data.modelNumberSuffixSelect && data.modelNumberSuffixSelect !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX && data.modelNumberSuffixSelect !== FORM_FIELD_EMPTY_SUFFIX_VALUE;
  const hl1Checked = data[CHECKBOX_SUFFIX_HL1];
  const hl2Checked = data[CHECKBOX_SUFFIX_HL2];

  return prefixProvided || selectSuffixProvided || hl1Checked || hl2Checked;
}, {
  message: t("modelNumberRequiredError"),
  path: ["modelNumberPrefix"], // General error displayed under prefix, or make a dedicated error display spot
}).refine(data => {
  // This refine is specifically for add mode. In edit mode, this check is not strictly needed as we parse an existing valid model.
  if (isEditing) return true;
  
  const prefixProvided = data.modelNumberPrefix !== undefined;
  const hl1Checked = data[CHECKBOX_SUFFIX_HL1];
  const hl2Checked = data[CHECKBOX_SUFFIX_HL2];
  if ((hl1Checked || hl2Checked) && !prefixProvided) return false;
  return true;
}, {
  message: t("modelNumberPrefixRequiredWithHL"),
  path: ["modelNumberPrefix"]
});


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const { t } = useTranslation();
  const isEditing = !!editingTile;
  const tileSchema = useMemo(() => getTileSchema(t, isEditing), [t, isEditing]);

  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      modelNumberPrefix: undefined,
      modelNumberSuffixSelect: SELECT_ITEM_VALUE_FOR_NONE_SUFFIX,
      [CHECKBOX_SUFFIX_HL1]: false,
      [CHECKBOX_SUFFIX_HL2]: false,
      width: undefined,
      height: undefined,
      quantity: undefined,
    },
  });

  useEffect(() => {
    if (editingTile) {
      let parsedPrefix: number | undefined = undefined;
      let parsedSuffixSelect: string = SELECT_ITEM_VALUE_FOR_NONE_SUFFIX;
      let parsedHl1 = false;
      let parsedHl2 = false;

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let mnRemainder = fullMN;

        // Check for HL suffixes first as they are more specific
        if (fullMN.endsWith("-" + CHECKBOX_SUFFIX_HL1)) {
          parsedHl1 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (CHECKBOX_SUFFIX_HL1.length + 1));
        } else if (fullMN.endsWith("-" + CHECKBOX_SUFFIX_HL2)) {
          parsedHl2 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (CHECKBOX_SUFFIX_HL2.length + 1));
        }

        // If HL suffix was found, mnRemainder is now the prefix part
        // If no HL suffix, mnRemainder is still fullMN, try to parse select suffix
        if (!parsedHl1 && !parsedHl2) {
            const sortedSelectOptions = [...SELECT_SUFFIX_OPTIONS].sort((a, b) => b.length - a.length);
            for (const opt of sortedSelectOptions) {
                if (fullMN.endsWith("-" + opt)) {
                    parsedSuffixSelect = opt;
                    mnRemainder = fullMN.substring(0, fullMN.length - (opt.length + 1));
                    break;
                } else if (fullMN === opt) { // Suffix is the entire model number
                    parsedSuffixSelect = opt;
                    mnRemainder = ""; // No prefix
                    break;
                }
            }
        }
        
        // Parse prefix from whatever remains
        if (mnRemainder && mnRemainder.length > 0) {
            const num = parseFloat(mnRemainder);
            if (!isNaN(num) && String(num) === mnRemainder) {
                 parsedPrefix = num;
            } else {
                // If remainder is not a clean number, and it wasn't a select suffix,
                // it might be a prefix that's not purely numeric or a custom unhandled model.
                // For simplicity, if it's not a number, we leave prefix as undefined.
                // This might happen if model was "CUSTOM-HL-1" or "TEXTPART-L".
                // Current form doesn't support non-numeric prefixes well.
            }
        }
      }
      
      form.reset({
        modelNumberPrefix: parsedPrefix,
        modelNumberSuffixSelect: parsedSuffixSelect,
        [CHECKBOX_SUFFIX_HL1]: parsedHl1,
        [CHECKBOX_SUFFIX_HL2]: parsedHl2,
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity,
      });
    } else {
      form.reset({
        modelNumberPrefix: undefined,
        modelNumberSuffixSelect: SELECT_ITEM_VALUE_FOR_NONE_SUFFIX,
        [CHECKBOX_SUFFIX_HL1]: false,
        [CHECKBOX_SUFFIX_HL2]: false,
        width: undefined,
        height: undefined,
        quantity: undefined,
      });
    }
  }, [editingTile, form, t]); // Added t to dependencies as it's used in schema

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!isEditing) {
        form.reset(); // Reset only if adding new tile
    }
  };


  return (
    <Card className="shadow-none border-none">
      <CardContent className="pt-6">
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
                  name="modelNumberSuffixSelect"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select
                        onValueChange={(selectedValue) => {
                          field.onChange(selectedValue);
                        }}
                        value={field.value ?? SELECT_ITEM_VALUE_FOR_NONE_SUFFIX}
                        disabled={isEditing && (form.getValues(CHECKBOX_SUFFIX_HL1) || form.getValues(CHECKBOX_SUFFIX_HL2))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('modelNumberSuffixPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_ITEM_VALUE_FOR_NONE_SUFFIX}>{t('modelNumberSuffixNone')}</SelectItem>
                          {SELECT_SUFFIX_OPTIONS.map(option => (
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
              {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") || form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL")) && (
                <p className="text-sm font-medium text-destructive pt-1">{form.formState.errors.modelNumberPrefix.message}</p>
              )}
            </div>

            {!isEditing && ( // Only show HL checkboxes when adding new, not when editing
              <div className="space-y-2">
                  <FormLabel>{t('hlSuffixesLabel')}</FormLabel>
                  <FormDescription>{t('hlSuffixesDescription')}</FormDescription>
                  <div className="flex gap-4 items-center">
                    <FormField
                      control={form.control}
                      name={CHECKBOX_SUFFIX_HL1}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isEditing || (!!form.watch('modelNumberSuffixSelect') && form.watch('modelNumberSuffixSelect') !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX)}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{CHECKBOX_SUFFIX_HL1}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={CHECKBOX_SUFFIX_HL2}
                      render={({ field }) => (
                         <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isEditing || (!!form.watch('modelNumberSuffixSelect') && form.watch('modelNumberSuffixSelect') !== SELECT_ITEM_VALUE_FOR_NONE_SUFFIX)}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{CHECKBOX_SUFFIX_HL2}</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                   <FormMessage>{form.formState.errors[CHECKBOX_SUFFIX_HL1]?.message || form.formState.errors[CHECKBOX_SUFFIX_HL2]?.message}</FormMessage>
              </div>
            )}


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
