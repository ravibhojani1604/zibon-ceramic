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

const tileSchema = z.object({
  modelNumber: z.string().min(1, { message: "Model number is required." }),
  material: z.string().nonempty({ message: "Material is required." }),
  width: z.coerce.number().positive({ message: "Width must be a positive number." }),
  height: z.coerce.number().positive({ message: "Height must be a positive number." }),
  quantity: z.coerce.number().int().min(1, { message: "Quantity must be at least 1." }),
});

export type TileFormData = z.infer<typeof tileSchema>;

interface TileFormProps {
  onSaveTile: (data: TileFormData, id?: string) => void;
  editingTile: Tile | null;
  onCancelEdit: () => void;
}

const materialOptions = ["Ceramic", "Porcelain", "Stone", "Glass", "Mosaic", "Vinyl", "Other"];

const TileForm: FC<TileFormProps> = ({ onSaveTile, editingTile, onCancelEdit }) => {
  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      modelNumber: "",
      material: "",
      width: "" as unknown as number, 
      height: "" as unknown as number,
      quantity: "" as unknown as number,
    },
  });

  useEffect(() => {
    if (editingTile) {
      form.reset({
        modelNumber: editingTile.modelNumber || "",
        material: editingTile.material || "",
        width: editingTile.width,
        height: editingTile.height,
        quantity: editingTile.quantity,
      });
    } else {
      form.reset({
        modelNumber: "",
        material: "",
        width: "" as unknown as number,
        height: "" as unknown as number,
        quantity: "" as unknown as number,
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
            <FormField
              control={form.control}
              name="modelNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., A123 or 00785" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a material" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {materialOptions.map(option => (
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="width"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Width (in)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 24" {...field} step="any" />
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
                      <Input type="number" placeholder="e.g., 12" {...field} step="any" />
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
                    <Input type="number" placeholder="e.g., 100" {...field} />
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
                <Button type="button" variant="outline" onClick={onCancelEdit} className="w-full">
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
