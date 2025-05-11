
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
  const baseObjectSchema: Record<string, any> = { // Use Record<string, any> for dynamic properties
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
    baseObjectSchema[sf.name] = z.boolean().optional();
    baseObjectSchema[sf.quantityName] = z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional();
  });

  return z.object(baseObjectSchema).superRefine((data, ctx) => {
    const checkedTypesFromData = typeConfig.filter(sf => data[sf.name]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined && data.modelNumberPrefix !== null && String(data.modelNumberPrefix).length > 0 ;


    if (isEditing) {
      // Edit Mode Validation
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      if (checkedTypesFromData.length > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("editModeSingleTypeError"), path: ["modelNumberPrefix"] }); // Or a more appropriate path
      }
      // In edit mode, either a prefix or exactly one type (which implies a model number part) must be present.
      // If a type is checked, it forms part of the model number. If no type is checked, prefix must exist.
      if (checkedTypesFromData.length === 0 && !prefixIsProvided) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
    } else {
      // Add New Tile(s) Mode Validation
      const anyTypeChecked = checkedTypesFromData.length > 0;

      if (!prefixIsProvided && !anyTypeChecked) { // Neither prefix nor any type is selected
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } else if (prefixIsProvided && !anyTypeChecked) { // Only prefix is provided, no types selected
        // Global quantity is required
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } else if (anyTypeChecked) { // One or more types are checked
        // Quantity is required for each checked type
        let hasAtLeastOneValidQuantity = false;
        for (const sf of checkedTypesFromData) {
          if (data[sf.quantityName] !== undefined && Number(data[sf.quantityName]) > 0) {
            hasAtLeastOneValidQuantity = true;
          }
          if (data[sf.quantityName] === undefined || Number(data[sf.quantityName]) <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("quantityRequiredForType", { type: sf.label }),
              path: [sf.quantityName],
            });
          }
        }
        if(!hasAtLeastOneValidQuantity && checkedTypesFromData.length > 0) {
            // This case could be redundant if individual messages are already added.
            // However, it ensures that if types are checked, at least one must have a quantity.
            // Consider if this top-level error is needed or if per-type errors are sufficient.
        }
      }
    }

    // Common validation for HL types needing a prefix
    if ( (data.type_HL1 || data.type_HL2 || data.type_HL4 || data.type_HL5) && !prefixIsProvided ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("modelNumberPrefixRequiredWithHL"),
        path: ["modelNumberPrefix"],
      });
    }
  }).refine(data => { // Overall refinement: at least some model identifier must be present
      const prefixProvided = data.modelNumberPrefix !== undefined && data.modelNumberPrefix !== null && String(data.modelNumberPrefix).length > 0;
      const anyTypeChecked = typeConfig.some(sf => data[sf.name]);
      return prefixProvided || anyTypeChecked;
  }, {
      message: t("modelNumberRequiredError"), // This message might be too generic if specific issues are caught above
      path: ["modelNumberPrefix"], // Or a more general path like form root if appropriate
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
    mode: "onChange", // Validate on change for better UX
  });

  const watchedTypeStates = typeConfig.map(sf => form.watch(sf.name));
  const checkedTypeCount = useMemo(() => watchedTypeStates.filter(Boolean).length, [watchedTypeStates]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  // Show global quantity field if:
  // 1. In edit mode (always uses global quantity for the single item being edited)
  // 2. In add mode, AND no type checkboxes are checked, AND a model number prefix has been entered.
  const showGlobalQuantityField = isEditing || (checkedTypeCount === 0 && watchedModelNumberPrefix !== undefined && String(watchedModelNumberPrefix).length > 0);


  useEffect(() => {
    if (!isEditing) {
      const allChecked = typeConfig.every(sf => !!form.getValues(sf.name));
      if (allChecked !== selectAllTypes) {
        setSelectAllTypes(allChecked);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form, selectAllTypes, ...watchedTypeStates]);


  useEffect(() => {
    if (editingTile) {
      setSelectAllTypes(false); // Not applicable in edit mode
      const resetValues: Partial<TileFormData> = {
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity, // Global quantity for editing
      };
      // Initialize all type checkboxes to false and their quantities to undefined
      typeConfig.forEach(sf => {
        resetValues[sf.name] = false;
        resetValues[sf.quantityName] = undefined;
      });

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let mnRemainder = fullMN;

        // Find the longest matching suffix first to handle cases like "HL-1" vs "L"
        const matchedTypeConf = typeConfig
          .slice() // Create a copy before sorting to avoid mutating the original
          .sort((a,b) => b.label.length - a.label.length) // Sort by label length descending
          .find(sf => fullMN.endsWith("-" + sf.label) || fullMN === sf.label);

        if (matchedTypeConf) {
            resetValues[matchedTypeConf.name] = true; // Check the corresponding type box
            // Determine the prefix part
            if (fullMN.endsWith("-" + matchedTypeConf.label)) {
                 mnRemainder = fullMN.substring(0, fullMN.length - (matchedTypeConf.label.length + 1));
            } else { // fullMN === sf.label
                 mnRemainder = ""; // No prefix part
            }
        }
        // If there's a remainder, try to parse it as a number for the prefix
        if (mnRemainder && mnRemainder.length > 0) {
            const num = parseFloat(mnRemainder);
            if (!isNaN(num) && String(num) === mnRemainder) { // Check if it's a clean number
                 resetValues.modelNumberPrefix = num;
            } else {
                // This case handles model numbers that are entirely non-numeric and don't match a type label
                // (e.g. a custom model number that was somehow saved without a type)
                // Or, if there was no matchedTypeConf, the fullMN might be the prefix.
                if(!matchedTypeConf) { // If no type was matched, assume fullMN could be a prefix
                    const numPrefix = parseFloat(fullMN);
                    if (!isNaN(numPrefix) && String(numPrefix) === fullMN) {
                        resetValues.modelNumberPrefix = numPrefix;
                    }
                    // If it's not a number, and not a type, it's a purely custom model - leave prefix empty
                }
            }
        } else if (!matchedTypeConf && fullMN && fullMN !== "N/A"){
            // If no type matched and no remainder, but fullMN exists, it might be a numeric prefix itself
            const numPrefix = parseFloat(fullMN);
            if (!isNaN(numPrefix) && String(numPrefix) === fullMN) {
                resetValues.modelNumberPrefix = numPrefix;
            }
        }
      }
      form.reset(resetValues);
    } else { // Adding new tile, reset to defaults
      form.reset(defaultFormValues);
      if (selectAllTypes) { // Ensure selectAllTypes is also reset if form is fully reset
        setSelectAllTypes(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTile, form, defaultFormValues]); // defaultFormValues is stable

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!isEditing) { // Only reset form if adding new, not after editing
        form.reset(defaultFormValues);
        setSelectAllTypes(false); // Also reset the "Select All" checkbox state
    }
  };

  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean') {
      setSelectAllTypes(checked);
      typeConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
        if (!checked) { // If unchecking all, clear their quantities too
          form.setValue(sf.quantityName, undefined, { shouldValidate: true });
        }
      });
    }
  };


  return (
    <CardContent className="pt-6">
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
                      type="number"
                      placeholder={t('modelNumberPrefixPlaceholder')}
                      {...field}
                      value={field.value ?? ''}
                      // Ensure onChange converts empty string to undefined for optional number
                      onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                      step="any"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
                <FormLabel>{t('typeCheckboxesLabel')}</FormLabel>
                {!isEditing && ( // "Select All" only for add mode
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={selectAllTypes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-types"
                        disabled={isEditing} // Should always be false here due to !isEditing wrapper, but for clarity
                        aria-label={t('selectAllTypes')}
                      />
                    </FormControl>
                    <FormLabel htmlFor="select-all-types" className="font-normal cursor-pointer select-none">
                      {t('selectAllTypes')}
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
                                  onCheckedChange={(newCheckedState) => {
                                    const isNowChecked = typeof newCheckedState === 'boolean' ? newCheckedState : false;
                                    if (isEditing) {
                                      // In edit mode, only one type can be active.
                                      // Checking one will uncheck others.
                                      typeConfig.forEach(s => {
                                        form.setValue(s.name, s.name === sf.name ? isNowChecked : false, {shouldValidate: true});
                                        // In edit mode, quantities are global, no need to clear individuals here.
                                      });
                                    } else {
                                      // In add mode
                                      field.onChange(isNowChecked); // Update the checkbox's own state
                                      if (!isNowChecked) {
                                        // If checkbox is unchecked, clear its specific quantity
                                        form.setValue(sf.quantityName, undefined, { shouldValidate: true });
                                      }
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
                        {/* Show quantity input for this type if in 'add new' mode AND its checkbox is checked */}
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
                                <FormMessage className="text-xs pt-1" /> {/* For individual quantity errors */}
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Display general model number error if present and not specific to a dirty field or type error */}
                {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") ||
                 form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL")) &&
                 !form.formState.dirtyFields.modelNumberPrefix && // Only show if not actively typing in prefix
                   Object.values(form.formState.errors).every(err => err?.type !== 'invalid_type' && err?.type !== 'too_small') // Avoid showing if a more specific error exists
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

            {/* Global quantity field logic:
                - Shown in 'edit' mode.
                - Shown in 'add' mode ONLY IF no type checkboxes are checked AND a prefix is entered.
            */}
            {showGlobalQuantityField && (
              <FormField
                control={form.control}
                name="quantity" // This is the global quantity
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

    