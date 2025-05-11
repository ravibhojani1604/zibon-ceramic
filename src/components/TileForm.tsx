"use client";

import type { FC } from 'react';
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
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";

const tileSchema = z.object({
  type: z.string().min(3, { message: "Tile type must be at least 3 characters." }),
  width: z.coerce.number().positive({ message: "Width must be a positive number." }),
  height: z.coerce.number().positive({ message: "Height must be a positive number." }),
  quantity: z.coerce.number().int().min(1, { message: "Quantity must be at least 1." }),
});

export type TileFormData = z.infer<typeof tileSchema>;

interface TileFormProps {
  onAddTile: (data: TileFormData) => void;
}

const TileForm: FC<TileFormProps> = ({ onAddTile }) => {
  const { toast } = useToast();
  const form = useForm<TileFormData>({
    resolver: zodResolver(tileSchema),
    defaultValues: {
      type: "",
      width: undefined, // Use undefined for number inputs to show placeholder
      height: undefined,
      quantity: undefined,
    },
  });

  const onSubmit = (data: TileFormData) => {
    onAddTile(data);
    form.reset();
    toast({
      title: "Tile Added Successfully",
      description: `${data.type} (${data.width}x${data.height}) has been added to the inventory.`,
      variant: "default",
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <PlusCircle className="text-primary" />
          Add New Tile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tile Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ceramic Floor Tile" {...field} />
                  </FormControl>
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
            <Button type="submit" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Tile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TileForm;
