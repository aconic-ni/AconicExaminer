
"use client";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { ProductTable } from './ProductTable';
import { AddProductModal } from './AddProductModal';
import { PlusCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { ProductDetailsModal } from './ProductDetailsModal';


export function ProductListScreen() {
  const { examData, setCurrentStep, openAddProductModal, products } = useAppContext();

  if (!examData) {
    // Should not happen if navigation is correct, but as a fallback
    return (
      <div className="text-center py-10">
        <p>Error: Datos del examen no encontrados.</p>
        <Button onClick={() => setCurrentStep(ExamStep.WELCOME)}>Volver al inicio</Button>
      </div>
    );
  }
  
  const handleFinish = () => {
     if (products.length === 0) {
        alert('Debe agregar al menos un producto antes de finalizar.');
        return;
      }
    setCurrentStep(ExamStep.PREVIEW);
  }

  return (
    <Card className="w-full max-w-5xl mx-auto custom-shadow">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-4">
          <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">EXAMEN PREVIO</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => openAddProductModal()} className="btn-primary">
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Producto
            </Button>
            <Button onClick={handleFinish} className="btn-secondary">
              <CheckCircle className="mr-2 h-5 w-5" /> Finalizar y Previsualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md shadow">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div><span className="font-semibold">NE:</span> {examData.ne}</div>
                <div><span className="font-semibold">Referencia:</span> {examData.reference || 'N/A'}</div>
                <div><span className="font-semibold">Consignatario:</span> {examData.consignee}</div>
                <div><span className="font-semibold">Gestor:</span> {examData.manager}</div>
                <div><span className="font-semibold">Ubicación:</span> {examData.location}</div>
            </div>
            <div className="mt-3">
                <Button variant="link" onClick={() => setCurrentStep(ExamStep.INITIAL_INFO)} className="text-primary p-0 h-auto">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Regresar para modificar
                </Button>
            </div>
        </div>
        
        <ProductTable />
      </CardContent>
      <AddProductModal />
      <ProductDetailsModal />
    </Card>
  );
}
