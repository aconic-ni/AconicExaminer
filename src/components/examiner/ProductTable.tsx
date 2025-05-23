"use client";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { Eye, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ProductTable() {
  const { products, openAddProductModal, deleteProduct, openProductDetailModal } = useAppContext();

  const getStatusBadge = (product: Product) => {
    if (product.isExcess) return <Badge variant="destructive" className="bg-red-100 text-red-800">Excedente</Badge>;
    if (product.isConform) return <Badge variant="default" className="bg-green-100 text-green-800">Conforme</Badge>;
    if (product.isMissing) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Faltante</Badge>;
    if (product.isFault) return <Badge variant="outline" className="bg-gray-100 text-gray-800">Avería</Badge>;
    return <Badge variant="outline">Sin Estado</Badge>;
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay productos añadidos. Haga clic en "Añadir Nuevo" para comenzar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <TableRow key={product.id} className={
              product.isExcess ? 'bg-red-50 hover:bg-red-100' : 
              product.isConform ? 'bg-green-50 hover:bg-green-100' :
              product.isMissing ? 'bg-yellow-50 hover:bg-yellow-100' :
              product.isFault ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-muted/50'
            }>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.itemNumber || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{product.description || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{product.brand || 'N/A'}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{`${product.quantityUnits || 0} unid. / ${product.quantityPackages || 0} bultos`}</TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-500">{getStatusBadge(product)}</TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openProductDetailModal(product)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAddProductModal(product)}>
                      <Edit3 className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (confirm('¿Está seguro de que desea eliminar este producto?')) {
                        deleteProduct(product.id);
                      }
                    }} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
