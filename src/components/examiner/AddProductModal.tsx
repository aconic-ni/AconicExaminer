"use client";
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '@/context/AppContext';
import type { ProductFormData } from './FormParts/zodSchemas';
import { productSchema } from './FormParts/zodSchemas';
import type { Product } from '@/types';
import { CustomCheckbox } from './FormParts/CustomCheckbox';
import { X } from 'lucide-react';


export function AddProductModal() {
  const { 
    isAddProductModalOpen, 
    closeAddProductModal, 
    addProduct, 
    updateProduct, 
    editingProduct 
  } = useAppContext();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      itemNumber: '',
      weight: '',
      description: '',
      brand: '',
      model: '',
      unitMeasure: '',
      serial: '',
      origin: '',
      numberPackages: '',
      quantityPackages: undefined, // Use undefined for optional numbers
      quantityUnits: undefined,    // Use undefined for optional numbers
      packagingCondition: '',
      observation: '',
      isConform: false,
      isExcess: false,
      isMissing: false,
      isFault: false,
    },
  });

  useEffect(() => {
    if (editingProduct) {
      form.reset({
        ...editingProduct,
        quantityPackages: editingProduct.quantityPackages !== undefined ? Number(editingProduct.quantityPackages) : undefined,
        quantityUnits: editingProduct.quantityUnits !== undefined ? Number(editingProduct.quantityUnits) : undefined,
      });
    } else {
      form.reset({
        itemNumber: '',
        weight: '',
        description: '',
        brand: '',
        model: '',
        unitMeasure: '',
        serial: '',
        origin: '',
        numberPackages: '',
        quantityPackages: undefined,
        quantityUnits: undefined,
        packagingCondition: '',
        observation: '',
        isConform: false,
        isExcess: false,
        isMissing: false,
        isFault: false,
      });
    }
  }, [editingProduct, form, isAddProductModalOpen]);

  function onSubmit(data: ProductFormData) {
    const productData = {
        ...data,
        quantityPackages: data.quantityPackages !== undefined ? Number(data.quantityPackages) : undefined,
        quantityUnits: data.quantityUnits !== undefined ? Number(data.quantityUnits) : undefined,
    };

    if (editingProduct && editingProduct.id) {
      updateProduct({ ...productData, id: editingProduct.id } as Product);
    } else {
      addProduct(productData as Omit<Product, 'id'>);
    }
    closeAddProductModal();
  }

  if (!isAddProductModalOpen) return null;

  return (
    <Dialog open={isAddProductModalOpen} onOpenChange={(open) => !open && closeAddProductModal()}>
      <DialogContent className="max-w-3xl w-full p-0">
        <ScrollArea className="max-h-[85vh]">
        <div className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold text-gray-800">
            {editingProduct ? 'Editar Producto' : 'Añadir Producto'}
          </DialogTitle>
           <button
            onClick={closeAddProductModal}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="itemNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Item</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="weight" render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <div className="md:col-span-2">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="unitMeasure" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad de Medida</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="serial" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serie</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="origin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Origen</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="numberPackages" render={({ field }) => (
                <FormItem>
                  <FormLabel>Numeración de Bultos</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="quantityPackages" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad de Bultos</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="quantityUnits" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad de Unidades</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)}/></FormControl><FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="packagingCondition" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de Mercancía (Nueva, Usada, Otros)</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )}/>
              <div className="md:col-span-2">
                <FormField control={form.control} name="observation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observación</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-3 mt-4">
              <Controller control={form.control} name="isConform" render={({ field }) => (
                <CustomCheckbox label="Conforme a factura" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isExcess" render={({ field }) => (
                <CustomCheckbox label="Notificar excedente" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isMissing" render={({ field }) => (
                <CustomCheckbox label="Notificar faltante" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
              <Controller control={form.control} name="isFault" render={({ field }) => (
                <CustomCheckbox label="Notificar Avería" checked={field.value} onChange={field.onChange} name={field.name} />
              )}/>
            </div>

            <DialogFooter className="pt-4 gap-3">
              <Button type="button" variant="outline" onClick={closeAddProductModal}>Cancelar</Button>
              <Button type="submit" className="btn-primary">{editingProduct ? 'Guardar Cambios' : 'Guardar Producto'}</Button>
            </DialogFooter>
          </form>
        </Form>
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
