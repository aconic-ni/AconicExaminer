"use client";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { X } from 'lucide-react';

export function ProductDetailsModal() {
  const { productToView, isProductDetailModalOpen, closeProductDetailModal } = useAppContext();

  if (!isProductDetailModalOpen || !productToView) {
    return null;
  }

  const getStatusText = (product: Product) => {
    const statuses = [];
    if (product.isConform) statuses.push("Conforme a factura");
    if (product.isExcess) statuses.push("Se encontró excedente");
    if (product.isMissing) statuses.push("Se encontró faltante");
    if (product.isFault) statuses.push("Se encontró avería");
    return statuses.length > 0 ? statuses.join(', ') : 'Sin estado específico';
  };
  
  const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-base text-foreground">{String(value ?? 'N/A')}</p>
    </div>
  );


  return (
    <Dialog open={isProductDetailModalOpen} onOpenChange={(open) => !open && closeProductDetailModal()}>
      <DialogContent className="max-w-2xl w-full p-0">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg md:text-xl font-semibold text-gray-800">Detalles del Producto</DialogTitle>
              <button
                onClick={closeProductDetailModal}
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                aria-label="Cerrar"
              >
                <X className="h-6 w-6" />
              </button>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem label="Número de Item" value={productToView.itemNumber} />
                <DetailItem label="Peso" value={productToView.weight} />
                <div className="sm:col-span-2">
                  <DetailItem label="Descripción" value={productToView.description} />
                </div>
                <DetailItem label="Marca" value={productToView.brand} />
                <DetailItem label="Modelo" value={productToView.model} />
                <DetailItem label="Unidad de Medida" value={productToView.unitMeasure} />
                <DetailItem label="Serie" value={productToView.serial} />
                <DetailItem label="Origen" value={productToView.origin} />
                <DetailItem label="Numeración de Bultos" value={productToView.numberPackages} />
                <DetailItem label="Cantidad de Bultos" value={productToView.quantityPackages} />
                <DetailItem label="Cantidad de Unidades" value={productToView.quantityUnits} />
                <DetailItem label="Estado de Mercancía" value={productToView.packagingCondition} />
                 <div className="sm:col-span-2">
                  <DetailItem label="Observación" value={productToView.observation} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Estado</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {productToView.isConform && <Badge className="bg-green-100 text-green-800">Conforme</Badge>}
                    {productToView.isExcess && <Badge className="bg-red-100 text-red-800">Excedente</Badge>}
                    {productToView.isMissing && <Badge className="bg-yellow-100 text-yellow-800">Faltante</Badge>}
                    {productToView.isFault && <Badge className="bg-gray-100 text-gray-800">Avería</Badge>}
                    {!productToView.isConform && !productToView.isExcess && !productToView.isMissing && !productToView.isFault && <Badge variant="outline">Sin especificar</Badge>}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={closeProductDetailModal}>Cerrar</Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
