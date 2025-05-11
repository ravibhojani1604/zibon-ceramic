
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
import { CardContent } 
from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Edit3, XCircle } from "lucide-react";
import type { Tile } from "@/types";
import { useTranslation } from '@/context/i18n';


const typeConfig = [
  { key: "L" as const, name: "type_L" as const, label: "L", quantityName: "quantity_L" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: "HL-1", quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: "HL-2", quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: "HL-4", quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: "HL-5", quantityName: "quantity_HL5" as const },
  { key: "D" as const, name: "type_D" as const, label: "D", quantityName: "quantity_D" as const },
  { key: "F" as const, name: "type_F" as const, label: "F", quantityName: "quantity_F" as const },
] as const;


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string, isEditing: boolean) => {
  const baseObjectSchema: Record<string, z.ZodTypeAny> = { 
    modelNumberPrefix: z.preprocess(
      (val) => {
        const strVal = String(val).trim();
        if (strVal === "" || strVal === "N/A") return undefined; // Treat "N/A" or empty as undefined for prefix
        const num = parseFloat(strVal);
        return isNaN(num) ? strVal : num; // Allow string prefix if not purely numeric
      },
      z.union([
        z.number({ invalid_type_error: t("modelNumberPrefixInvalidError")})
          .positive({ message: t("modelNumberPrefixPositiveError") }),
        z.string().min(1, { message: t("modelNumberPrefixNonEmptyError") }) 
      ]).optional()
    ),
    width: z.coerce.number({invalid_type_error: t("widthRequiredError")}).positive({ message: t("widthPositiveError") }),
    height: z.coerce.number({invalid_type_error: t("heightRequiredError")}).positive({ message: t("heightPositiveError") }),
    quantity: z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional(),
  };

  typeConfig.forEach(sf => {
    baseObjectSchema[sf.name] = z.boolean().optional();
    baseObjectSchema[sf.quantityName] = z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional();
  });

  return z.object(baseObjectSchema).superRefine((data, ctx) => {
    const checkedTypesFromData = typeConfig.filter(sf => data[sf.name]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined && String(data.modelNumberPrefix).trim() !== "";
    
    if (isEditing) {
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      // In edit mode, modelNumberPrefix or at least one type (implicitly through editingTile) must exist.
      // The form values are set based on editingTile, so this check mostly ensures data consistency.
      if (!prefixIsProvided && checkedTypesFromData.length === 0) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
       // HL types still need a prefix if they are the selected type
      const selectedTypeConfig = checkedTypesFromData[0]; // In edit mode, only one type should be active
      if (selectedTypeConfig && (selectedTypeConfig.key === "HL1" || selectedTypeConfig.key === "HL2" || selectedTypeConfig.key === "HL4" || selectedTypeConfig.key === "HL5") && !prefixIsProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("modelNumberPrefixRequiredWithHL"),
          path: ["modelNumberPrefix"],
        });
      }

    } else { // Add New Tile(s) Mode Validation
      const anyTypeChecked = checkedTypesFromData.length > 0;

      if (!prefixIsProvided && !anyTypeChecked) { 
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } else if (prefixIsProvided && !anyTypeChecked) { 
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } else if (anyTypeChecked) { 
        let hasAtLeastOneValidQuantity = false;
        for (const sf of checkedTypesFromData) {
          if (data[sf.quantityName] !== undefined && Number(data[sf.quantityName]) > 0) {
            hasAtLeastOneValidQuantity = true;
          } else { // Allow 0 or undefined if not submitting that type
             if (data[sf.quantityName] !== undefined && Number(data[sf.quantityName]) <=0) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("quantityMinError"),
                  path: [sf.quantityName],
                });
             }
          }
           // HL types validation
          if ((sf.key === "HL1" || sf.key === "HL2" || sf.key === "HL4" || sf.key === "HL5") && !prefixIsProvided ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("modelNumberPrefixRequiredWithHL"),
              path: ["modelNumberPrefix"], // Error on prefix as it's missing
            });
          }
        }
        if(!hasAtLeastOneValidQuantity && checkedTypesFromData.length > 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("atLeastOneTypeQuantityError"),
                path: ["type_L"], // Or a general path
            });
        }
      }
    }
  });
};


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const createInitialDefaultFormValues = (): Partial<TileFormData> => {
  const values: Partial<TileFormData> = {
    modelNumberPrefix: undefined,
    width: undefined,
    height: undefined,
    quantity: undefined,
  };
  typeConfig.forEach(sf => {
    values[sf.name] = false;
    values[sf.quantityName] = undefined;
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
    mode: "onChange", 
  });

  const watchedTypeStates = useMemo(() => typeConfig.map(sf => form.watch(sf.name)), [form]);
  const checkedTypeCount = useMemo(() => watchedTypeStates.filter(Boolean).length, [watchedTypeStates]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  const showGlobalQuantityField = isEditing || (checkedTypeCount === 0 && watchedModelNumberPrefix !== undefined && String(watchedModelNumberPrefix).trim() !== "");

  useEffect(() => {
    if (!isEditing) {
      const allChecked = typeConfig.every(sf => !!form.getValues(sf.name));
      if (allChecked !== selectAllTypes) {
        setSelectAllTypes(allChecked);
      }
    }
  }, [isEditing, form, selectAllTypes, watchedTypeStates]); // Removed form.getValues from dep array


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
        let mnPrefix = fullMN;
        let foundType = false;

        const knownTypesSorted = typeConfig.slice().sort((a,b) => b.label.length - a.label.length);

        for (const sf of knownTypesSorted) {
          if (fullMN.endsWith(`-${sf.label}`)) {
            mnPrefix = fullMN.substring(0, fullMN.length - (sf.label.length + 1));
            resetValues[sf.name] = true;
            foundType = true;
            break;
          } else if (fullMN === sf.label) {
            mnPrefix = ""; 
            resetValues[sf.name] = true;
            foundType = true;
            break;
          }
        }
        
        if (mnPrefix === "N/A" && !foundType) {
             resetValues.modelNumberPrefix = undefined; // Represent N/A prefix as undefined in form
        } else if (mnPrefix.trim() !== "") {
            const num = parseFloat(mnPrefix);
            resetValues.modelNumberPrefix = isNaN(num) ? mnPrefix : num;
        } else {
            resetValues.modelNumberPrefix = undefined; // No prefix
        }

      } else if (editingTile.modelNumber === "N/A") {
        resetValues.modelNumberPrefix = undefined; // Explicitly for "N/A"
      }
      form.reset(resetValues);
    } else { 
      form.reset(defaultFormValues);
      if (selectAllTypes) { 
        setSelectAllTypes(false);
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
    if (typeof checked === 'boolean' && !isEditing) {
      setSelectAllTypes(checked);
      typeConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
        if (!checked) { 
          form.setValue(sf.quantityName, undefined, { shouldValidate: true });
        }
      });
    }
  };

  return (
    <CardContent className="pt-6 px-1 md:px-6"> {/* Adjusted padding for smaller screens */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="modelNumberPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modelNumberPrefixLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text" // Changed to text to allow non-numeric prefixes
                      placeholder={t('modelNumberPrefixPlaceholder')}
                      {...field}
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={e => {
                        const val = e.target.value.trim();
                        if (val === "") {
                          field.onChange(undefined);
                        } else {
                           const num = parseFloat(val);
                           field.onChange(isNaN(num) ? val : num);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          
            {!isEditing && (
              <div className="space-y-2">
                  <FormLabel>{t('typeCheckboxesLabel')}</FormLabel>
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                    <FormControl>
                      <Checkbox
                        checked={selectAllTypes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-types"
                        disabled={isEditing} 
                        aria-label={t('selectAllTypes')}
                      />
                    </FormControl>
                    <FormLabel htmlFor="select-all-types" className="font-normal cursor-pointer select-none">
                      {t('selectAllTypes')}
                    </FormLabel>
                  </FormItem>
                  <div className="grid grid-cols-1 gap-y-3 gap-x-3 sm:grid-cols-2">
                    {typeConfig.map(sf => (
                      <div key={sf.key} className="rounded-md border p-3 shadow-sm bg-card">
                        <div className="flex flex-row items-center justify-between space-x-3">
                          <FormField
                            control={form.control}
                            name={sf.name}
                            render={({ field: typeField }) => (
                              <div className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={typeField.value ?? false}
                                    onCheckedChange={(newCheckedState) => {
                                      const isNowChecked = typeof newCheckedState === 'boolean' ? newCheckedState : false;
                                      typeField.onChange(isNowChecked);
                                      if (!isNowChecked) {
                                        form.setValue(sf.quantityName, undefined, { shouldValidate: true });
                                      }
                                    }}
                                    id={`checkbox-${sf.key}`}
                                    disabled={isEditing}
                                  />
                                </FormControl>
                                <FormLabel htmlFor={`checkbox-${sf.key}`} className="font-normal cursor-pointer select-none">
                                  {sf.label}
                                </FormLabel>
                              </div>
                            )}
                          />
                          {form.watch(sf.name) && !isEditing && (
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
                     form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL") ||
                     form.formState.errors.type_L?.message === t("atLeastOneTypeQuantityError") 
                     ) && (
                     <p className="text-sm font-medium text-destructive pt-1">
                        {form.formState.errors.modelNumberPrefix?.message || form.formState.errors.type_L?.message}
                     </p>
                  )}
              </div>
            )}

            {isEditing && editingTile && (
              <FormItem>
                <FormLabel>{t('editingTypeLabel')}</FormLabel>
                <Input
                  type="text"
                  value={typeConfig.find(tc => form.getValues(tc.name))?.label || t('baseModel')}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </FormItem>
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
              <Button type="button" variant="outline" onClick={() => { onCancelEdit(); form.reset(defaultFormValues); setSelectAllTypes(false); }} className="w-full">
                     <XCircle className="mr-2 h-4 w-4" />
                    {t('cancelButton')}
              </Button>
            </div>
        </form>
      </Form>
    </CardContent>
  );
};

export default TileForm;

    