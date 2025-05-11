
"use client";

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Edit3, XCircle } from "lucide-react";
import type { Tile } from "@/types";
import { useTranslation } from '@/context/i18n';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added import

// Suffix constants
const SUFFIX_L = "L";
const SUFFIX_HL1 = "HL-1";
const SUFFIX_HL2 = "HL-2";
const SUFFIX_HL4 = "HL-4";
const SUFFIX_HL5 = "HL-5";
const SUFFIX_D = "D";
const SUFFIX_F = "F";

const suffixConfig = [
  { key: "L" as const, name: "suffix_L" as const, label: SUFFIX_L, quantityName: "quantity_L" as const },
  { key: "HL1" as const, name: "suffix_HL1" as const, label: SUFFIX_HL1, quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "suffix_HL2" as const, label: SUFFIX_HL2, quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "suffix_HL4" as const, label: SUFFIX_HL4, quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "suffix_HL5" as const, label: SUFFIX_HL5, quantityName: "quantity_HL5" as const },
  { key: "D" as const, name: "suffix_D" as const, label: SUFFIX_D, quantityName: "quantity_D" as const },
  { key: "F" as const, name: "suffix_F" as const, label: SUFFIX_F, quantityName: "quantity_F" as const },
] as const;


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string, isEditing: boolean) => {
  const baseObjectSchema = {
    modelNumberPrefix: z.preprocess(
      (val) => (String(val).trim() === "" ? undefined : val),
      z.coerce.number({ invalid_type_error: t("modelNumberPrefixInvalidError")})
        .positive({ message: t("modelNumberPrefixPositiveError") })
        .optional()
    ),
    width: z.coerce.number({invalid_type_error: t("widthRequiredError")}).positive({ message: t("widthPositiveError") }),
    height: z.coerce.number({invalid_type_error: t("heightRequiredError")}).positive({ message: t("heightPositiveError") }),
    quantity: z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional(), // Global quantity
  };

  suffixConfig.forEach(sf => {
    (baseObjectSchema as any)[sf.name] = z.boolean().optional();
    (baseObjectSchema as any)[sf.quantityName] = z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional();
  });
  
  return z.object(baseObjectSchema).superRefine((data, ctx) => {
    const checkedSuffixesFromData = suffixConfig.filter(sf => data[sf.name]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined;

    if (isEditing) {
      // Edit Mode Validation
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      if (checkedSuffixesFromData.length > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("editModeSingleSuffixError"), path: ["modelNumberPrefix"] }); 
      }
      if (checkedSuffixesFromData.length === 0 && !prefixIsProvided) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
    } else { 
      // Add New Tile(s) Mode Validation
      const anySuffixChecked = checkedSuffixesFromData.length > 0;

      if (!prefixIsProvided && !anySuffixChecked) {
        // Case: Nothing entered (no prefix, no suffix checked)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } else if (prefixIsProvided && !anySuffixChecked) {
        // Case: Only prefix provided, no suffixes checked. Global quantity is required.
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } else if (anySuffixChecked) {
        // Case: One or more suffixes are checked. Per-suffix quantities are required for *all* checked suffixes.
        for (const sf of checkedSuffixesFromData) {
          if (data[sf.quantityName] === undefined || Number(data[sf.quantityName]) <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("quantityRequiredForSuffixError", { suffix: sf.label }),
              path: [sf.quantityName],
            });
          }
        }
      }
    }

    // Common validation for HL suffixes needing a prefix (applies to both add and edit)
    if ( (data.suffix_HL1 || data.suffix_HL2 || data.suffix_HL4 || data.suffix_HL5) && !prefixIsProvided ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("modelNumberPrefixRequiredWithHL"),
        path: ["modelNumberPrefix"],
      });
    }
  }).refine(data => { // Ensures at least one part of model number is present
      const prefixProvided = data.modelNumberPrefix !== undefined;
      const anySuffixChecked = suffixConfig.some(sf => data[sf.name]);
      return prefixProvided || anySuffixChecked;
  }, {
      message: t("modelNumberRequiredError"),
      path: ["modelNumberPrefix"], 
  });
};


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

// Helper function to create the initial default form values
const createInitialDefaultFormValues = (): Partial<TileFormData> => {
  const values: Partial<TileFormData> = {
    modelNumberPrefix: undefined,
    width: undefined,
    height: undefined,
    quantity: undefined, // Global quantity
  };
  suffixConfig.forEach(sf => {
    values[sf.name] = false; // Suffix checkbox
    values[sf.quantityName] = undefined; // Per-suffix quantity
  });
  return values;
};


const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const { t } = useTranslation();
  const isEditing = !!editingTile;
  const tileSchema = useMemo(() => getTileSchema(t, isEditing), [t, isEditing]);
  const [selectAllSuffixes, setSelectAllSuffixes] = useState(false);
  
  const defaultFormValues = useMemo(() => createInitialDefaultFormValues(), []);


  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: defaultFormValues,
  });

  const watchedSuffixes = suffixConfig.map(sf => form.watch(sf.name));
  const checkedSuffixCount = useMemo(() => watchedSuffixes.filter(Boolean).length, [watchedSuffixes]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  // Determine when to show the global quantity field
  const showGlobalQuantityField = isEditing || (checkedSuffixCount === 0 && watchedModelNumberPrefix !== undefined);

  useEffect(() => {
    if (!isEditing) {
      const allChecked = suffixConfig.every(sf => !!form.getValues(sf.name));
      // Only update selectAllSuffixes if its current state differs from allChecked
      // This prevents an infinite loop if selectAllSuffixes itself is in the dependency array of another effect
      // that might trigger a form value change.
      if (allChecked !== selectAllSuffixes) { 
        setSelectAllSuffixes(allChecked);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [isEditing, form, selectAllSuffixes, ...watchedSuffixes]); // Added watchedSuffixes to correctly track changes
  

  useEffect(() => {
    if (editingTile) {
      setSelectAllSuffixes(false); 
      const resetValues: Partial<TileFormData> = {
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity, // Use global quantity for editing
      };
      suffixConfig.forEach(sf => {
        resetValues[sf.name] = false;
        resetValues[sf.quantityName] = undefined; // Per-suffix quantities not used in edit mode's form
      });

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let mnRemainder = fullMN;

        const matchedSuffixConf = suffixConfig
          .sort((a,b) => b.label.length - a.label.length) 
          .find(sf => fullMN.endsWith("-" + sf.label) || fullMN === sf.label);

        if (matchedSuffixConf) {
            resetValues[matchedSuffixConf.name] = true;
            if (fullMN.endsWith("-" + matchedSuffixConf.label)) {
                 mnRemainder = fullMN.substring(0, fullMN.length - (matchedSuffixConf.label.length + 1));
            } else { 
                 mnRemainder = "";
            }
        }
        
        if (mnRemainder && mnRemainder.length > 0) {
            const num = parseFloat(mnRemainder);
            if (!isNaN(num) && String(num) === mnRemainder) { 
                 resetValues.modelNumberPrefix = num;
            } else {
                if(!matchedSuffixConf) {
                    const numPrefix = parseFloat(fullMN);
                    if (!isNaN(numPrefix) && String(numPrefix) === fullMN) {
                        resetValues.modelNumberPrefix = numPrefix;
                    }
                }
            }
        }
      }
      form.reset(resetValues);
    } else {
      form.reset(defaultFormValues);
      if (selectAllSuffixes) { 
        setSelectAllSuffixes(false);
      }
    }
  }, [editingTile, form, defaultFormValues, selectAllSuffixes]);

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!isEditing) {
        form.reset(defaultFormValues); 
        setSelectAllSuffixes(false);
    }
  };

  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean') {
      setSelectAllSuffixes(checked);
      suffixConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
      });
    }
  };


  return (
    <CardContent className="pt-6">
      <Form {...form}>
        <ScrollArea className="max-h-[60vh] pr-2"> {/* Added ScrollArea and padding for scrollbar */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="modelNumberPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modelNumberPrefixLabel')}</FormLabel>
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
            
            <div className="space-y-2">
                <FormLabel>{t('suffixCheckboxesLabel')}</FormLabel>
                {!isEditing && (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={selectAllSuffixes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-suffixes"
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormLabel htmlFor="select-all-suffixes" className="font-normal">
                      {t('selectAllSuffixes')}
                    </FormLabel>
                  </FormItem>
                )}
                <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2 md:grid-cols-3">
                  {suffixConfig.map(sf => (
                    <div key={sf.key} className="space-y-2">
                      <FormField
                        control={form.control}
                        name={sf.name}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                            <FormControl>
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={(checked) => {
                                  if (isEditing) {
                                    if (typeof checked === 'boolean') {
                                      suffixConfig.forEach(s => {
                                        form.setValue(s.name, s.name === sf.name ? checked : false, {shouldValidate: true});
                                      });
                                    }
                                  } else {
                                    field.onChange(checked); 
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {sf.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      {/* Show per-suffix quantity if !isEditing and this suffix is checked */}
                      {!isEditing && form.watch(sf.name) && (
                        <FormField
                          control={form.control}
                          name={sf.quantityName}
                          render={({ field: qtyField }) => (
                            <FormItem className="pl-3">
                              <FormLabel htmlFor={sf.quantityName} className="text-xs">{t('quantityForSuffixLabel', {suffix: sf.label})}</FormLabel>
                              <FormControl>
                                <Input
                                  id={sf.quantityName}
                                  type="number"
                                  placeholder={t('quantityPlaceholder')}
                                  {...qtyField}
                                  value={qtyField.value ?? ''}
                                  onChange={e => qtyField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {/* Display model number related errors that might not be tied to a single field if prefix is involved */}
                {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") || 
                 form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL")) && 
                 !form.formState.dirtyFields.modelNumberPrefix && // Show only if not specific to prefix field input
                   Object.values(form.formState.errors).every(err => err?.type !== 'invalid_type' && err?.type !== 'too_small') // Avoid double messaging
                   && (
                   <p className="text-sm font-medium text-destructive pt-1">{form.formState.errors.modelNumberPrefix.message}</p>
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
            
            {/* Show global quantity field if in edit mode, OR (not editing AND no suffixes checked AND prefix is provided) */}
            {showGlobalQuantityField && (
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
                          field.onChange(val === '' ? undefined : parseInt(val, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex space-x-2 pt-2"> {/* Added pt-2 for spacing before buttons */}
              <Button type="submit" className="w-full">
                {isEditing ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isEditing ? t('updateTileButton') : t('addTileButton')}
              </Button>
              {(isEditing || !isEditing) && ( // Show cancel always when in dialog
                <Button type="button" variant="outline" onClick={() => { onCancelEdit(); form.reset(defaultFormValues); setSelectAllSuffixes(false); }} className="w-full">
                     <XCircle className="mr-2 h-4 w-4" />
                    {t('cancelButton')}
                </Button>
              )}
            </div>
          </form>
        </ScrollArea>
      </Form>
    </CardContent>
  );
};

export default TileForm;

