
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
import { PlusCircle, Edit, XCircle } from "lucide-react"; // Removed Edit3
import { useTranslation } from '@/context/i18n';


export const typeConfig = [
  { key: "L" as const, name: "type_L" as const, label: "L", quantityName: "quantity_L" as const },
  { key: "D" as const, name: "type_D" as const, label: "D", quantityName: "quantity_D" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: "HL-1", quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: "HL-2", quantityName: "quantity_HL2" as const },
  { key: "HL3" as const, name: "type_HL3" as const, label: "HL-3", quantityName: "quantity_HL3" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: "HL-4", quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: "HL-5", quantityName: "quantity_HL5" as const },
  { key: "F" as const, name: "type_F" as const, label: "F", quantityName: "quantity_F" as const },
] as const;


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string, isEditMode: boolean, isGroupEdit: boolean) => {
  const baseObjectSchema: Record<string, z.ZodTypeAny> = { 
    modelNumberPrefix: z.preprocess(
      (val) => {
        const strVal = String(val).trim();
        if (strVal === "" || strVal === "N/A") return undefined; 
        const num = parseFloat(strVal);
        return isNaN(num) ? strVal : num; 
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
    const checkedTypesFromData = typeConfig.filter(sf => data[sf.name as keyof typeof data]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined && String(data.modelNumberPrefix).trim() !== "";
    
    if (isEditMode && !isGroupEdit) { 
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      if (!prefixIsProvided && checkedTypesFromData.length === 0) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
      const selectedTypeConfig = checkedTypesFromData[0]; 
      if (selectedTypeConfig && selectedTypeConfig.key.startsWith("HL") && !prefixIsProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("modelNumberPrefixRequiredWithHL"),
          path: ["modelNumberPrefix"],
        });
      }
    } else { 
      const anyTypeChecked = checkedTypesFromData.length > 0;

      if (!prefixIsProvided && !anyTypeChecked) { 
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } 
      else if (prefixIsProvided && !anyTypeChecked) { 
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } 
      else if (anyTypeChecked) { 
        let hasAtLeastOneValidQuantityForTypes = false;
        for (const sf of checkedTypesFromData) {
          const quantityForType = data[sf.quantityName as keyof typeof data];
          if (quantityForType !== undefined && Number(quantityForType) > 0) {
            hasAtLeastOneValidQuantityForTypes = true;
          } else { 
             if (quantityForType !== undefined && Number(quantityForType) <=0) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("quantityMinError"),
                  path: [sf.quantityName],
                });
             }
          }
          if (sf.key.startsWith("HL") && !prefixIsProvided ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("modelNumberPrefixRequiredWithHL"),
              path: ["modelNumberPrefix"], 
            });
          }
        }
        if(!hasAtLeastOneValidQuantityForTypes && checkedTypesFromData.length > 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("atLeastOneTypeQuantityError"),
                path: ["type_L"], 
            });
        }
      }
    }
  });
};


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

export const createInitialDefaultFormValues = (): TileFormData => {
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
  return values as TileFormData;
};

interface TileFormProps {
  onSaveTile: (data: TileFormData) => void;
  initialValues: TileFormData;
  onCancelEdit: () => void;
  isEditMode: boolean; 
  isGroupEdit: boolean; 
}


const TileForm: FC<TileFormProps> = ({ onSaveTile, initialValues, onCancelEdit, isEditMode, isGroupEdit }) => {
  const { t } = useTranslation();
  const tileSchema = useMemo(() => getTileSchema(t, isEditMode, isGroupEdit), [t, isEditMode, isGroupEdit]);
  const [selectAllTypes, setSelectAllTypes] = useState(false);

  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: initialValues,
    mode: "onChange", 
  });

  const watchedTypeStates = useMemo(() => typeConfig.map(sf => form.watch(sf.name)), [form]);
  const checkedTypeCount = useMemo(() => watchedTypeStates.filter(Boolean).length, [watchedTypeStates]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  const showGlobalQuantityField = 
    (isEditMode && !isGroupEdit) || 
    (checkedTypeCount === 0 && watchedModelNumberPrefix !== undefined && String(watchedModelNumberPrefix).trim() !== ""); 


  useEffect(() => {
    form.reset(initialValues); 
    if (!isEditMode || isGroupEdit) {
        const allChecked = typeConfig.every(sf => !!form.getValues(sf.name));
        setSelectAllTypes(allChecked);
    } else { 
        setSelectAllTypes(false);
    }
  }, [initialValues, form, isEditMode, isGroupEdit]);


  const onSubmit = (data: TileFormData) => {
    onSaveTile(data);
    if (!isEditMode) { 
        form.reset(createInitialDefaultFormValues());
        setSelectAllTypes(false); 
    }
  };

  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean' && (!isEditMode || isGroupEdit)) { 
      setSelectAllTypes(checked);
      typeConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
        if (!checked) { 
          form.setValue(sf.quantityName, undefined, { shouldValidate: true });
        }
      });
    }
  };
  
  const isTypeFieldDisabled = isEditMode && !isGroupEdit;

  return (
    <CardContent className="pt-6 px-1 md:px-6">
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
                      type="text" 
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
          
            {(!isEditMode || isGroupEdit) && (
              <div className="space-y-2">
                  <FormLabel>{t('typeCheckboxesLabel')}</FormLabel>
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                    <FormControl>
                      <Checkbox
                        checked={selectAllTypes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-types"
                        disabled={isTypeFieldDisabled} 
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
                                      const currentTypeValues = typeConfig.map(c => form.getValues(c.name));
                                      setSelectAllTypes(currentTypeValues.every(Boolean));
                                    }}
                                    id={`checkbox-${sf.key}`}
                                    disabled={isTypeFieldDisabled}
                                  />
                                </FormControl>
                                <FormLabel htmlFor={`checkbox-${sf.key}`} className="font-normal cursor-pointer select-none">
                                  {sf.label}
                                </FormLabel>
                              </div>
                            )}
                          />
                          {form.watch(sf.name) && (!isEditMode || isGroupEdit) && (
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

            {isEditMode && !isGroupEdit && initialValues[typeConfig.find(tc => initialValues[tc.name as keyof TileFormData])?.name as keyof TileFormData] && (
              <FormItem>
                <FormLabel>{t('editingTypeLabel')}</FormLabel>
                <Input
                  type="text"
                  value={typeConfig.find(tc => initialValues[tc.name as keyof TileFormData])?.label || t('baseModel')}
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
                {isEditMode ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isEditMode ? (isGroupEdit ? t('updateGroupButton') : t('updateTileButton')) : t('addTileButton')}
              </Button>
              <Button type="button" variant="outline" onClick={() => { onCancelEdit(); form.reset(createInitialDefaultFormValues()); setSelectAllTypes(false); }} className="w-full">
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
