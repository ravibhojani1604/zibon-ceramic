
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

// Suffix constants
const SUFFIX_L = "L";
const SUFFIX_HL1 = "HL-1";
const SUFFIX_HL2 = "HL-2";
const SUFFIX_HL4 = "HL-4";
const SUFFIX_HL5 = "HL-5";
const SUFFIX_D = "D";
const SUFFIX_F = "F";


const getTileSchema = (t: (key: string, options?: Record<string, string | number>) => string) => z.object({
  modelNumberPrefix: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : val),
    z.coerce.number({ invalid_type_error: t("modelNumberPrefixInvalidError")})
      .positive({ message: t("modelNumberPrefixPositiveError") })
      .optional()
  ),
  suffix_L: z.boolean().optional(),
  suffix_HL1: z.boolean().optional(),
  suffix_HL2: z.boolean().optional(),
  suffix_D: z.boolean().optional(),
  suffix_F: z.boolean().optional(),
  suffix_HL4: z.boolean().optional(),
  suffix_HL5: z.boolean().optional(),
  width: z.coerce.number({invalid_type_error: t("widthRequiredError")}).positive({ message: t("widthPositiveError") }),
  height: z.coerce.number({invalid_type_error: t("heightRequiredError")}).positive({ message: t("heightPositiveError") }),
  quantity: z.coerce.number({invalid_type_error: t("quantityRequiredError")}).int().min(1, { message: t("quantityMinError") }),
}).refine(data => {
  const prefixProvided = data.modelNumberPrefix !== undefined;
  const anySuffixChecked = data.suffix_L || data.suffix_HL1 || data.suffix_HL2 || data.suffix_D || data.suffix_F || data.suffix_HL4 || data.suffix_HL5;
  return prefixProvided || anySuffixChecked;
}, {
  message: t("modelNumberRequiredError"),
  path: ["modelNumberPrefix"], 
}).refine(data => {
  // HL-1, HL-2, HL-4, HL-5 require a prefix
  if ((data.suffix_HL1 || data.suffix_HL2 || data.suffix_HL4 || data.suffix_HL5) && data.modelNumberPrefix === undefined) {
    return false;
  }
  return true;
}, {
  message: t("modelNumberPrefixRequiredWithHL"),
  path: ["modelNumberPrefix"],
});


export type TileFormData = z.infer<ReturnType<typeof getTileSchema>>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const suffixFields: (keyof TileFormData)[] = [
  "suffix_L", "suffix_HL1", "suffix_HL2", "suffix_HL4", "suffix_HL5", "suffix_D", "suffix_F"
];

const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const { t } = useTranslation();
  const isEditing = !!editingTile;
  const tileSchema = useMemo(() => getTileSchema(t), [t]);
  const [selectAllSuffixes, setSelectAllSuffixes] = useState(false);

  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      modelNumberPrefix: undefined,
      suffix_L: false,
      suffix_HL1: false,
      suffix_HL2: false,
      suffix_D: false,
      suffix_F: false,
      suffix_HL4: false,
      suffix_HL5: false,
      width: undefined,
      height: undefined,
      quantity: undefined,
    },
  });

  const watchedSuffixes = form.watch(suffixFields);

  useEffect(() => {
    if (!isEditing) {
      const allChecked = suffixFields.every(field => !!form.getValues(field));
      if (allChecked !== selectAllSuffixes) {
        setSelectAllSuffixes(allChecked);
      }
    }
  }, [watchedSuffixes, isEditing, form, selectAllSuffixes]);


  useEffect(() => {
    if (editingTile) {
      setSelectAllSuffixes(false); // Disable select all on edit mode
      let parsedPrefix: number | undefined = undefined;
      let parsedSuffix_L = false;
      let parsedSuffix_HL1 = false;
      let parsedSuffix_HL2 = false;
      let parsedSuffix_D = false;
      let parsedSuffix_F = false;
      let parsedSuffix_HL4 = false;
      let parsedSuffix_HL5 = false;

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let mnRemainder = fullMN;

        // Order of checks: Longer, more specific suffixes first.
        if (fullMN.endsWith("-" + SUFFIX_HL1)) {
          parsedSuffix_HL1 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_HL1.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_HL2)) {
          parsedSuffix_HL2 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_HL2.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_HL4)) {
          parsedSuffix_HL4 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_HL4.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_HL5)) {
          parsedSuffix_HL5 = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_HL5.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_L)) {
          parsedSuffix_L = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_L.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_D)) {
          parsedSuffix_D = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_D.length + 1));
        } else if (fullMN.endsWith("-" + SUFFIX_F)) {
          parsedSuffix_F = true;
          mnRemainder = fullMN.substring(0, fullMN.length - (SUFFIX_F.length + 1));
        } else if (fullMN === SUFFIX_L) { 
          parsedSuffix_L = true;
          mnRemainder = "";
        } else if (fullMN === SUFFIX_D) { 
          parsedSuffix_D = true;
          mnRemainder = "";
        } else if (fullMN === SUFFIX_F) { 
          parsedSuffix_F = true;
          mnRemainder = "";
        }
        
        if (mnRemainder && mnRemainder.length > 0) {
            const num = parseFloat(mnRemainder);
            if (!isNaN(num) && String(num) === mnRemainder) { 
                 parsedPrefix = num;
            }
        }
      }
      
      form.reset({
        modelNumberPrefix: parsedPrefix,
        suffix_L: parsedSuffix_L,
        suffix_HL1: parsedSuffix_HL1,
        suffix_HL2: parsedSuffix_HL2,
        suffix_D: parsedSuffix_D,
        suffix_F: parsedSuffix_F,
        suffix_HL4: parsedSuffix_HL4,
        suffix_HL5: parsedSuffix_HL5,
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity,
      });
    } else {
      form.reset({
        modelNumberPrefix: undefined,
        suffix_L: false,
        suffix_HL1: false,
        suffix_HL2: false,
        suffix_D: false,
        suffix_F: false,
        suffix_HL4: false,
        suffix_HL5: false,
        width: undefined,
        height: undefined,
        quantity: undefined,
      });
      setSelectAllSuffixes(false);
    }
  }, [editingTile, form]); 

  const onSubmit = (data: TileFormData) => {
    onSaveTile(data, editingTile?.id);
    if (!isEditing) {
        form.reset(); 
        setSelectAllSuffixes(false);
    }
  };

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAllSuffixes(checked);
    suffixFields.forEach(field => {
      form.setValue(field, checked, { shouldValidate: true });
    });
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { name: "suffix_L" as const, label: SUFFIX_L },
                  { name: "suffix_HL1" as const, label: SUFFIX_HL1 },
                  { name: "suffix_HL2" as const, label: SUFFIX_HL2 },
                  { name: "suffix_HL4" as const, label: SUFFIX_HL4 },
                  { name: "suffix_HL5" as const, label: SUFFIX_HL5 },
                  { name: "suffix_D" as const, label: SUFFIX_D },
                  { name: "suffix_F" as const, label: SUFFIX_F },
                ].map(suffix => (
                  <FormField
                    key={suffix.name}
                    control={form.control}
                    name={suffix.name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              if (isEditing) {
                                // When editing, only one suffix can be active.
                                if (checked) {
                                  suffixFields.forEach(sField => {
                                    form.setValue(sField, sField === suffix.name);
                                  });
                                } else {
                                   field.onChange(false); // Allow unchecking
                                }
                              } else {
                                field.onChange(checked); // Allow multiple checks when adding
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {suffix.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              {(form.formState.errors.modelNumberPrefix?.message === t("modelNumberRequiredError") || form.formState.errors.modelNumberPrefix?.message === t("modelNumberPrefixRequiredWithHL")) && (
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
  );
};

export default TileForm;
