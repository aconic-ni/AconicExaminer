
"use client";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { CheckCircle, FilePlus, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export function SuccessModal() {
  const { currentStep, setCurrentStep, resetApp, examData } = useAppContext();

  if (currentStep !== ExamStep.SUCCESS) {
    return null;
  }

  return (
    <Dialog open={currentStep === ExamStep.SUCCESS} onOpenChange={() => { /* Controlled by AppContext */ }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <DialogTitle className="text-xl font-semibold text-gray-800">¡Operación Exitosa!</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-center text-gray-600 space-y-3">
          <div>El examen previo ha sido registrado correctamente.</div>
          <div>
            Se notificó a: <br />
            <span className="font-medium">gerencia@aconic.com</span>,<br />
            <span className="font-medium">asuntos.juridicos@aconic.com</span>,<br />
            <span className="font-medium">coordinacion@aconic.com</span>.
          </div>
          {examData?.manager && <div>Gracias por tu desempeño, {examData.manager}.</div>}
          <div>
            <Link
              href="https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=FhIPTt"
              target="_blank"
              className="text-primary underline hover:text-primary/80"
            >
              Añadir imágenes del predio aquí
            </Link>
          </div>
        </DialogDescription>
        <div className="mt-6 flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:justify-center">
          <Button onClick={() => resetApp()} className="btn-primary w-full sm:w-auto">
            <FilePlus className="mr-2 h-4 w-4" /> Empezar Nuevo
          </Button>
          <Button onClick={() => setCurrentStep(ExamStep.PREVIEW)} variant="outline" className="w-full sm:w-auto">
             <RotateCcw className="mr-2 h-4 w-4" /> Revisar Examen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
