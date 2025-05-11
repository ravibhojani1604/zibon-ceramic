
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
import { PlusCircle, Edit3, XCircle, Edit } from "lucide-react";
import { useTranslation } from '@/context/i18n';


const typeConfig = [
  { key: "L" as const, name: "type_L" as const, label: "L", quantityName: "quantity_L" as const },
  { key: "D" as const, name: "type_D" as const, label: "D", quantityName: "quantity_D" as const },
  { key: "HL1" as const, name: "type_HL1" as const, label: "HL-1", quantityName: "quantity_HL1" as const },
  { key: "HL2" as const, name: "type_HL2" as const, label: "HL-2", quantityName: "quantity_HL2" as const },
  { key: "HL4" as const, name: "type_HL4" as const, label: "HL-4", quantityName: "quantity_HL4" as const },
  { key: "HL5" as const, name: "type_HL5" as const, label: "HL-5", quantityName: "quantity_HL5" as const },
  { key: "F" as const, name: "type_F" as const, label: "F", quantityName: "quantity_F" as const },
] as const;


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string, isEditMode: boolean, isGroupEdit: boolean) => {
  const baseObjectSchema: Record<string, z.ZodTypeAny> = { 
    modelNumberPrefix: z.preprocess(
      (val) => {
        const strVal = String(val).trim();
        if (strVal === "" || strVal === "N/A") return undefined; // Allow empty string or N/A to become undefined
        const num = parseFloat(strVal);
        return isNaN(num) ? strVal : num; // Return as string if not a number, else as number
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

  // Dynamically add type boolean fields and their corresponding quantity fields
  typeConfig.forEach(sf => {
    baseObjectSchema[sf.name] = z.boolean().optional();
    baseObjectSchema[sf.quantityName] = z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }).optional();
  });

  return z.object(baseObjectSchema).superRefine((data, ctx) => {
    const checkedTypesFromData = typeConfig.filter(sf => data[sf.name]);
    const prefixIsProvided = data.modelNumberPrefix !== undefined && String(data.modelNumberPrefix).trim() !== "";
    
    // Validation logic for different modes
    if (isEditMode && !isGroupEdit) { // Editing a single variant (deprecated path, but kept for safety)
      // A single variant must have a quantity
      if (data.quantity === undefined || data.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
      }
      // A single variant usually has a model number (prefix or full if it's just a type like 'L')
      if (!prefixIsProvided && checkedTypesFromData.length === 0) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      }
      // HL types require a prefix
      const selectedTypeConfig = checkedTypesFromData[0]; // In single edit, only one type is expected
      if (selectedTypeConfig && (selectedTypeConfig.key === "HL1" || selectedTypeConfig.key === "HL2" || selectedTypeConfig.key === "HL4" || selectedTypeConfig.key === "HL5") && !prefixIsProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("modelNumberPrefixRequiredWithHL"),
          path: ["modelNumberPrefix"],
        });
      }
    } else { // Add New Tile(s) Mode or Edit Group Mode
      const anyTypeChecked = checkedTypesFromData.length > 0;

      // Scenario 1: No prefix AND no types checked -> Error, need something
      if (!prefixIsProvided && !anyTypeChecked) { 
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("modelNumberRequiredError"), path: ["modelNumberPrefix"] });
      } 
      // Scenario 2: Prefix provided BUT no types checked -> Global quantity is required
      else if (prefixIsProvided && !anyTypeChecked) { 
        if (data.quantity === undefined || data.quantity <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("quantityRequiredError"), path: ["quantity"] });
        }
      } 
      // Scenario 3: Types are checked (prefix may or may not be provided)
      else if (anyTypeChecked) { 
        let hasAtLeastOneValidQuantityForTypes = false;
        for (const sf of checkedTypesFromData) {
          // Check if quantity for this specific type is provided and positive
          if (data[sf.quantityName] !== undefined && Number(data[sf.quantityName]) > 0) {
            hasAtLeastOneValidQuantityForTypes = true;
          } else { 
             // If quantity is defined but not positive, add error to that specific quantity field
             if (data[sf.quantityName] !== undefined && Number(data[sf.quantityName]) <=0) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("quantityMinError"),
                  path: [sf.quantityName],
                });
             }
             // If quantity is undefined for a checked type, this will be caught by the general "atLeastOneTypeQuantityError"
             // unless it's the *only* error. Specific undefined errors per type are not added here to avoid clutter.
          }
          // HL types require a prefix if they are selected
          if ((sf.key === "HL1" || sf.key === "HL2" || sf.key === "HL4" || sf.key === "HL5") && !prefixIsProvided ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("modelNumberPrefixRequiredWithHL"),
              path: ["modelNumberPrefix"], 
            });
          }
        }
        // If types are checked, at least one of them must have a valid quantity
        if(!hasAtLeastOneValidQuantityForTypes && checkedTypesFromData.length > 0) {
             // Add a general error indicating at least one type needs a quantity.
             // Path is arbitrarily set to the first type's checkbox for UI indication,
             // but the message is general.
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t("atLeastOneTypeQuantityError"),
                path: ["type_L"], // Could be any type, or a more general path if preferred
            });
        }
      }
    }
  });
};


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

// Helper to create initial form values
export const createInitialDefaultFormValues = (): TileFormData => {
  const values: any = { // Using any temporarily for easier construction
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
  isEditMode: boolean; // General edit mode (true for variant edit AND group edit)
  isGroupEdit: boolean; // Specifically for group edit, to differentiate from single variant edit
}


const TileForm: FC<TileFormProps> = ({ onSaveTile, initialValues, onCancelEdit, isEditMode, isGroupEdit }) => {
  const { t } = useTranslation();
  const tileSchema = useMemo(() => getTileSchema(t, isEditMode, isGroupEdit), [t, isEditMode, isGroupEdit]);
  const [selectAllTypes, setSelectAllTypes] = useState(false);

  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: initialValues,
    mode: "onChange", // Validate on change for better UX
  });

  // Watch relevant fields to conditionally render UI elements
  const watchedTypeStates = useMemo(() => typeConfig.map(sf => form.watch(sf.name)), [form]);
  const checkedTypeCount = useMemo(() => watchedTypeStates.filter(Boolean).length, [watchedTypeStates]);
  const watchedModelNumberPrefix = form.watch('modelNumberPrefix');

  // Determine when to show the global quantity field
  const showGlobalQuantityField = 
    (isEditMode && !isGroupEdit) || // Old single variant edit (might be deprecated)
    (checkedTypeCount === 0 && watchedModelNumberPrefix !== undefined && String(watchedModelNumberPrefix).trim() !== ""); // Or when no types are checked but a prefix exists


  useEffect(() => {
    form.reset(initialValues); // Reset form with new initial values when they change
    // For add mode or group edit mode, evaluate selectAllTypes based on initialValues
    if (!isEditMode || isGroupEdit) {
        const allChecked = typeConfig.every(sf => !!form.getValues(sf.name));
        setSelectAllTypes(allChecked);
    } else { // For single variant edit mode, selectAllTypes is not applicable
        setSelectAllTypes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, form]); // form.reset will update internal state


  const onSubmit = (data: TileFormData) => {
    onSaveTile(data);
    if (!isEditMode) { // If it was 'add' mode, reset form to defaults for next entry
        form.reset(createInitialDefaultFormValues());
        setSelectAllTypes(false); // Also reset the select all checkbox
    }
    // For edit modes, the parent component (InventoryPage) handles closing the dialog and resetting states.
  };

  // Handler for the "Select All Types" checkbox
  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === 'boolean' && (!isEditMode || isGroupEdit)) { // Allow select all for add and group edit
      setSelectAllTypes(checked);
      typeConfig.forEach(sf => {
        form.setValue(sf.name, checked, { shouldValidate: true });
        if (!checked) { // If unselecting all, clear their quantities
          form.setValue(sf.quantityName, undefined, { shouldValidate: true });
        }
      });
    }
  };
  
  // Determine if type fields should be disabled (e.g., in single variant edit mode)
  const isTypeFieldDisabled = isEditMode && !isGroupEdit;

  return (
    <CardContent className="pt-6 px-1 md:px-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Model Number Prefix Field */}
            <FormField
              control={form.control}
              name="modelNumberPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('modelNumberPrefixLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text" // Keep as text to allow non-numeric prefixes
                      placeholder={t('modelNumberPrefixPlaceholder')}
                      {...field}
                      value={field.value === undefined ? '' : String(field.value)} // Ensure value is string for input
                      onChange={e => {
                        const val = e.target.value.trim();
                        if (val === "") {
                          field.onChange(undefined); // Set to undefined if empty
                        } else {
                           // Try to parse as number, if fails, keep as string
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
          
            {/* Type Checkboxes Section - Shown for Add mode and Group Edit mode */}
            {(!isEditMode || isGroupEdit) && (
              <div className="space-y-2">
                  <FormLabel>{t('typeCheckboxesLabel')}</FormLabel>
                  {/* Select All Types Checkbox */}
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                    <FormControl>
                      <Checkbox
                        checked={selectAllTypes}
                        onCheckedChange={handleSelectAllChange}
                        id="select-all-types"
                        disabled={isTypeFieldDisabled} // Disable if in single variant edit mode
                        aria-label={t('selectAllTypes')}
                      />
                    </FormControl>
                    <FormLabel htmlFor="select-all-types" className="font-normal cursor-pointer select-none">
                      {t('selectAllTypes')}
                    </FormLabel>
                  </FormItem>
                  {/* Grid for Individual Type Checkboxes and Quantities */}
                  <div className="grid grid-cols-1 gap-y-3 gap-x-3 sm:grid-cols-2">
                    {typeConfig.map(sf => (
                      <div key={sf.key} className="rounded-md border p-3 shadow-sm bg-card">
                        <div className="flex flex-row items-center justify-between space-x-3">
                          {/* Type Checkbox */}
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
                                      if (!isNowChecked) { // If unchecked, clear its quantity
                                        form.setValue(sf.quantityName, undefined, { shouldValidate: true });
                                      }
                                      // Update selectAllTypes state if an individual checkbox changes
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
                          {/* Quantity Input for this Type (if checked) */}
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
                                      className="h-8 text-sm" // Smaller input
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
                  {/* Display general validation errors related to model number or type quantities */}
                   {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") ||
                     form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL") ||
                     form.formState.errors.type_L?.message === t("atLeastOneTypeQuantityError") // Example path, message is general
                     ) && (
                     <p className="text-sm font-medium text-destructive pt-1">
                        {form.formState.errors.modelNumberPrefix?.message || form.formState.errors.type_L?.message}
                     </p>
                  )}
              </div>
            )}

            {/* Display for single variant edit mode (deprecated path) */}
            {isEditMode && !isGroupEdit && initialValues[typeConfig.find(tc => initialValues[tc.name])?.name as keyof TileFormData] && (
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


            {/* Width and Height Fields */}
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
                        value={field.value ?? ''} // Handle undefined by showing empty string
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        step="any" // Allow decimals
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
                        value={field.value ?? ''} // Handle undefined
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        step="any" // Allow decimals
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Global Quantity Field (for base models or single variant edit) */}
            {showGlobalQuantityField && (
              <FormField
                control={form.control}
                name="quantity" // This is the global quantity field
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('quantityLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('quantityPlaceholder')}
                        {...field}
                        value={field.value ?? ''} // Handle undefined
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === '' ? undefined : parseInt(val, 10)); // Parse as int
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Submit and Cancel Buttons */}
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

    

    
