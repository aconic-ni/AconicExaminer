"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { downloadTxtFile, downloadExcelFile } from '@/lib/fileExporter';
import type { Product } from '@/types';
import { Download, Check, ArrowLeft } from 'lucide-react';

export function PreviewScreen() {
  const { examData, products, setCurrentStep } = useAppContext();

  if (!examData) {
    return <div className="text-center p-10">Error: No se encontraron datos del examen.</div>;
  }

  const handleConfirm = () => {
    // Here you would typically send data to a backend or trigger an email
    // For this version, we just move to success step
    setCurrentStep(ExamStep.SUCCESS);
  };

  const getStatusBadge = (product: Product) => {
    if (product.isExcess) return <Badge variant="destructive" className="bg-red-100 text-red-800">Excedente</Badge>;
    if (product.isConform) return <Badge variant="default" className="bg-green-100 text-green-800">Conforme</Badge>;
    if (product.isMissing) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Faltante</Badge>;
    if (product.isFault) return <Badge variant="outline" className="bg-gray-100 text-gray-800">Avería</Badge>;
    return <Badge variant="outline">Sin Estado</Badge>;
  };

  return (
    <Card className="w-full max-w-5xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">Vista Previa del Examen</CardTitle>
        <CardDescription>Revise la información antes de confirmar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-lg font-medium mb-2 text-gray-700">Información General</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-gray-50 p-4 rounded-md shadow-sm text-sm">
            <div><span className="font-semibold">NE:</span> {examData.ne}</div>
            <div><span className="font-semibold">Referencia:</span> {examData.reference || 'N/A'}</div>
            <div><span className="font-semibold">Gestor:</span> {examData.manager}</div>
            <div><span className="font-semibold">Ubicación:</span> {examData.location}</div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium mb-2 text-gray-700">Productos</h4>
          {products.length > 0 ? (
            <div className="overflow-x-auto table-container rounded-lg border">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className={
                      product.isExcess ? 'bg-red-50' : 
                      product.isConform ? 'bg-green-50' :
                      product.isMissing ? 'bg-yellow-50' :
                      product.isFault ? 'bg-gray-50' : ''
                    }>
                      <TableCell>{product.itemNumber || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{product.description || 'N/A'}</TableCell>
                      <TableCell>{`${product.brand || 'N/A'} / ${product.model || 'N/A'}`}</TableCell>
                      <TableCell>{`${product.quantityUnits || 0} unid. / ${product.quantityPackages || 0} bultos`}</TableCell>
                      <TableCell>{getStatusBadge(product)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-gray-500">No hay productos para mostrar.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(ExamStep.PRODUCT_LIST)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Productos
            </Button>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => downloadTxtFile(examData, products)}>
                    <Download className="mr-2 h-4 w-4" /> Descargar TXT
                </Button>
                <Button variant="outline" onClick={() => downloadExcelFile(examData, products)}>
                    <Download className="mr-2 h-4 w-4" /> Descargar Excel
                </Button>
                <Button onClick={handleConfirm} className="btn-primary">
                    <Check className="mr-2 h-4 w-4" /> Confirmar Examen
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
