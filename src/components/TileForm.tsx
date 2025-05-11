
"use client";

import type { FC } from 'react';
import { useEffect } from 'react';
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

const modelNumberSuffixOptions = ["L", "HL-1", "HL-2", "HL-3", "D", "F"];
const EMPTY_SUFFIX_VALUE = ""; 

const tileSchema = z.object({
  modelNumberPrefix: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : val), 
    z.coerce.number({ invalid_type_error: "Model prefix must be a valid number."})
      .positive({ message: "Model prefix must be a positive number if entered." })
      .optional()
  ),
  modelNumberSuffix: z.string().optional(),
  width: z.coerce.number({invalid_type_error: "Width must be a number."}).positive({ message: "Width must be a positive number." }),
  height: z.coerce.number({invalid_type_error: "Height must be a number."}).positive({ message: "Height must be a positive number." }),
  quantity: z.coerce.number({invalid_type_error: "Quantity must be a number."}).int().min(1, { message: "Quantity must be at least 1." }),
}).refine(data => data.modelNumberPrefix !== undefined || (data.modelNumberSuffix && data.modelNumberSuffix.length > 0), {
  message: "Either model number prefix or suffix must be provided.",
  path: ["modelNumberPrefix"], 
});

export type TileFormData = z.infer<typeof tileSchema>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      modelNumberPrefix: undefined,
      modelNumberSuffix: EMPTY_SUFFIX_VALUE, // Default to "" which shows "None"
      width: undefined, 
      height: undefined,
      quantity: undefined,
    },
  });

  useEffect(() => {
    if (editingTile) {
      let parsedPrefix: number | undefined = undefined;
      let parsedSuffix: string = "";

      if (editingTile.modelNumber && editingTile.modelNumber !== "N/A") {
        const fullMN = editingTile.modelNumber;
        let foundMatch = false;
        // Sort options by length descending to match longer suffixes first (e.g., "HL-1" before "L")
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
            // Handles cases where the model number is *only* a suffix (e.g., "L", "HL-1")
            // The additional checks prevent "D" from matching if, for example, "D-FLOOR" was a suffix and "D" was also a suffix.
            parsedSuffix = opt;
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch && fullMN.length > 0) {
          // If no suffix matched, try to parse the whole string as a prefix or extract leading number
          const num = parseFloat(fullMN);
          if (!isNaN(num) && String(num) === fullMN) { 
            parsedPrefix = num;
          } else {
             // Fallback: if it's not purely a number, check if it starts with a number (e.g. "123CUSTOM")
             // This part might be less relevant now with fixed suffix options
             const leadingNumberMatch = fullMN.match(/^(\d+(\.\d+)?)/);
             if (leadingNumberMatch) {
                parsedPrefix = parseFloat(leadingNumberMatch[1]);
                // Potentially, what remains could be a custom suffix not in the list, but we default to no suffix.
             }
             // If no number found and no suffix matched, parsedPrefix remains undefined, parsedSuffix remains ""
          }
        }
      }
      // parsedSuffix will be "" if no standard suffix was found or if only a prefix was present.
      // This correctly sets the dropdown to "None".
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
        modelNumberSuffix: EMPTY_SUFFIX_VALUE, // Default to "" which shows "None"
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
          {isEditing ? 'Edit Tile' : 'Add New Tile'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <FormLabel>Model Number</FormLabel>
              <div className="flex gap-2 items-start mt-1">
                <FormField
                  control={form.control}
                  name="modelNumberPrefix"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 123" 
                          {...field} 
                          value={field.value ?? ''} // Use ?? '' to prevent uncontrolled to controlled warning
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
                        onValueChange={field.onChange} // Directly use field.onChange, selectedValue will be "" for "None"
                        value={field.value ?? EMPTY_SUFFIX_VALUE} // Ensure "None" is selected if value is undefined or ""
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select suffix" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={EMPTY_SUFFIX_VALUE}>None</SelectItem>
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
               {form.formState.errors.modelNumberPrefix && form.formState.errors.modelNumberPrefix.message?.includes("Either model number prefix or suffix") && (
                <p className="text-sm font-medium text-destructive pt-1">{form.formState.errors.modelNumberPrefix.message}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (in)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 24" 
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
                    <FormLabel>Height (in)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 12" 
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
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 100" 
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
                {isEditing ? 'Update Tile' : 'Add Tile'}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={() => { form.reset(); onCancelEdit();}} className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
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
