
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
import { ScrollArea } from '@/components/ui/scroll-area';


// Type constants
const TYPE_L = "L";
const TYPE_HL1 = "HL-1";
const TYPE_HL2 = "HL-2";
const TYPE_HL4 = "HL-4";
const TYPE_HL5 = "HL-5";
const TYPE_D = "D";
const TYPE_F = "F";

const typeConfig = [
  { key: "L" as const, name: "type_L" as const, label: TYPE_L, quantityName: "quantity_L" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: TYPE_HL1, quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: TYPE_HL2, quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: TYPE_HL4, quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: TYPE_HL5, quantityName: "quantity_HL5" as const },
  { key: "D" as const, name: "type_D" as const, label: TYPE_D, quantityName: "quantity_D" as const },
  { key: "F" as const, name: "type_F" as const, label: TYPE_F, quantityName: "quantity_F" as const },
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

  typeConfig.forEach(sf => {
    (baseObjectSchema as any)[sf.name] = z.boolean().optional();
    (baseObjectSchema as any)[sf.quantityName] = z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional();
  });
  
  return z.object(baseObjectSchema).superRefine((data, ctx) => {
    const checkedTypesFromData = typeConfig.filter(sf => data[sf.name]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined;

    if (isEditing) {
      // Edit Mode Validation
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      if (checkedTypesFromData.length > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("editModeSingleSuffixError"), path: ["modelNumberPrefix"] }); // Using existing key, consider changing if new message needed
      }
      if (checkedTypesFromData.length === 0 && !prefixIsProvided) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
    } else { 
      // Add New Tile(s) Mode Validation
      const anyTypeChecked = checkedTypesFromData.length > 0;

      if (!prefixIsProvided && !anyTypeChecked) {
        // Case: Nothing entered (no prefix, no type checked)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } else if (prefixIsProvided && !anyTypeChecked) {
        // Case: Only prefix provided, no types checked. Global quantity is required.
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } else if (anyTypeChecked) {
        // Case: One or more types are checked. Per-type quantities are required for *all* checked types.
        for (const sf of checkedTypesFromData) {
          if (data[sf.quantityName] === undefined || Number(data[sf.quantityName]) <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("quantityRequiredForSuffixError", { suffix: sf.label }), // Using existing key, suffix -> type
              path: [sf.quantityName],
            });
          }
        }
      }
    }

    // Common validation for HL types needing a prefix (applies to both add and edit)
    if ( (data.type_HL1 || data.type_HL2 || data.type_HL4 || data.type_HL5) && !prefixIsProvided ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("modelNumberPrefixRequiredWithHL"),
        path: ["modelNumberPrefix"],
      });
    }
  }).refine(data => { // Ensures at least one part of model number is present
      const prefixProvided = data.modelNumberPrefix !== undefined;
      const anyTypeChecked = typeConfig.some(sf => data[sf.name]);
      return prefixProvided || anyTypeChecked;
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
  typeConfig.forEach(sf => {
    values[sf.name] = false; // Type checkbox
    values[sf.quantityName] = undefined; // Per-type quantity
  });
  return values;
};


const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const { t } = useTranslation();
  const isEditing = !!editingTile;
  const tileSchema = useMemo(() => getTileSchema(t, isEditing), [t, isEditing]);
  const [selectAllTypes, setSelectAllTypes] = useState(false);
  
  const defaultFormValues = useMemo(() => createInitialDefaultFormValues(), []);


  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: defaultFormValues,
  });

  const watchedTypes = typeConfig.map(sf => form.watch(sf.name));
  const checkedTypeCount = useMemo(() => watchedTypes.filter(Boolean).length, [watchedTypes]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  // Determine when to show the global quantity field
  const showGlobalQuantityField = isEditing || (checkedTypeCount === 0 && watchedModelNumberPrefix !== undefined);

  useEffect(() => {
    if (!isEditing) {
      const allChecked = typeConfig.every(sf => !!form.getValues(sf.name));
      // Only update selectAllTypes if its state differs from allChecked to prevent loops
      if (allChecked !== selectAllTypes) {
        setSelectAllTypes(allChecked);
      }
    }
  // form.getValues is stable, but watchedTypes change, so including them in deps array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form, selectAllTypes, ...watchedTypes]);
  

  useEffect(() => {
    if (editingTile) {
      setSelectAllTypes(false); 
      const resetValues: Partial<TileFormData> = {
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity, 
      };
      typeConfig.forEach(sf => {
        resetValues[sf.name] = false;
        resetValues[sf.quantityName] = undefined; 
      });

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let mnRemainder = fullMN;

        const matchedTypeConf = typeConfig
          .sort((a,b) => b.label.length - a.label.length) 
          .find(sf => fullMN.endsWith("-" + sf.label) || fullMN === sf.label);

        if (matchedTypeConf) {
            resetValues[matchedTypeConf.name] = true;
            if (fullMN.endsWith("-" + matchedTypeConf.label)) {
                 mnRemainder = fullMN.substring(0, fullMN.length - (matchedTypeConf.label.length + 1));
            } else { 
                 mnRemainder = "";
            }
        }
        
        if (mnRemainder && mnRemainder.length > 0) {
            const num = parseFloat(mnRemainder);
            if (!isNaN(num) && String(num) === mnRemainder) { 
                 resetValues.modelNumberPrefix = num;
            } else {
                if(!matchedTypeConf) { // If no type matched but there's a remainder, it might be just a prefix
                    const numPrefix = parseFloat(fullMN);
                    if (!isNaN(numPrefix) && String(numPrefix) === fullMN) { // check if the fullMN is a number
                        resetValues.modelNumberPrefix = numPrefix;
                    }
                    // If fullMN is not a simple number, it means it was "N/A" or some unparsed string.
                    // In this case, modelNumberPrefix remains undefined (or as per default if N/A case has specific logic)
                }
            }
        }
      }
      form.reset(resetValues);
    } else {
      form.reset(defaultFormValues);
      if (selectAllTypes) { 
        setSelectAllTypes(false); // Reset this when form is reset for adding new tile
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTile, form, defaultFormValues]); 

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!isEditing) {
        form.reset(defaultFormValues); 
        setSelectAllTypes(false);
    }
  };

  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean') {
      setSelectAllTypes(checked);
      typeConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
      });
    }
  };


  return (
    <CardContent className="pt-6">
      <Form {...form}>
        <ScrollArea className="h-full max-h-[calc(85vh-160px)]"> {/* Adjusted max-h calculation */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-4"> 
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
                        checked={selectAllTypes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-types"
                        disabled={isEditing}
                        aria-label={t('selectAllSuffixes')} 
                      />
                    </FormControl>
                    <FormLabel htmlFor="select-all-types" className="font-normal cursor-pointer select-none">
                      {t('selectAllSuffixes')} 
                    </FormLabel>
                  </FormItem>
                )}
                <div className="grid grid-cols-1 gap-y-3 gap-x-3 sm:grid-cols-2"> 
                  {typeConfig.map(sf => (
                    <div key={sf.key} className="rounded-md border p-3 shadow-sm">
                      <div className="flex flex-row items-center justify-between space-x-3">
                        <FormField
                          control={form.control}
                          name={sf.name}
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value ?? false}
                                  onCheckedChange={(checked) => {
                                    if (isEditing) {
                                      if (typeof checked === 'boolean') {
                                        typeConfig.forEach(s => {
                                          form.setValue(s.name, s.name === sf.name ? checked : false, {shouldValidate: true});
                                        });
                                      }
                                    } else {
                                      field.onChange(checked); 
                                    }
                                  }}
                                  id={`checkbox-${sf.key}`}
                                />
                              </FormControl>
                              <FormLabel htmlFor={`checkbox-${sf.key}`} className="font-normal cursor-pointer select-none">
                                {sf.label}
                              </FormLabel>
                            </div>
                          )}
                        />
                        {!isEditing && form.watch(sf.name) && (
                          <FormField
                            control={form.control}
                            name={sf.quantityName}
                            render={({ field: qtyField }) => (
                              <FormItem className="w-24"> 
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
                                <FormMessage className="text-xs pt-1" />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") || 
                 form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL")) && 
                 !form.formState.dirtyFields.modelNumberPrefix && 
                   Object.values(form.formState.errors).every(err => err?.type !== 'invalid_type' && err?.type !== 'too_small') 
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

            <div className="flex space-x-2 pt-2"> 
              <Button type="submit" className="w-full">
                {isEditing ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isEditing ? t('updateTileButton') : t('addTileButton')}
              </Button>
              {(isEditing || !isEditing) && ( 
                <Button type="button" variant="outline" onClick={() => { onCancelEdit(); form.reset(defaultFormValues); setSelectAllTypes(false); }} className="w-full">
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

