
"use client";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { CheckCircle, FilePlus, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { ExamDocument, Product } from '@/types';

export function SuccessModal() {
  const { currentStep, setCurrentStep, resetApp, examData, products } = useAppContext();
  const { user } = useAuth();
  const { toast } = useToast();

const handleSaveToDatabase = async () => {
  if (!examData || !user || !user.email) {
    toast({
      title: "Error al guardar",
      description: "Faltan datos del examen o información del usuario.",
      variant: "destructive",
    });
    return;
  }
  if (!examData.ne) {
    toast({
      title: "Error al guardar",
      description: "El número NE (Seguimiento NX1) es requerido para guardar.",
      variant: "destructive",
    });
    return;
  }

  try {
    const examDocRef = doc(db, "examenesPrevios", examData.ne);

      // Sanitize products: convert undefined to null
      const productsForDb = products.map((product) => {
        // Define el tipo para newProduct para reflejar que las propiedades pueden ser null
        const newProduct: { [K in keyof Product]: Product[K] extends undefined ? null : Product[K] | null } = {} as any; // Usamos as any temporalmente para la construcción

        (Object.keys(product) as Array<keyof Product>).forEach((key) => {
          if (product[key] === undefined) { // Solo necesitamos verificar undefined aquí, ya que null es aceptado por Firestore
            newProduct[key] = null; // Firestore accepts null
        } else {
            // Asignamos el valor, permitiendo null si ya era null, o el tipo original si no era undefined
            newProduct[key] = product[key] === null ? null : product[key] as any; // Usamos as any aquí también para simplificar la asignación después de la verificación de undefined
        }
        });
        return newProduct as Product; // Aún puedes castear como Product si tu tipo Product ya maneja null
      });

    const dataToSave: Omit<ExamDocument, 'id'> = {
      ...examData, // examData fields are mostly required or defaulted to ''
      products: productsForDb,
      savedAt: Timestamp.fromDate(new Date()),
      savedBy: user.email, // user.email can be string | null. Firestore accepts null.
    };

    await setDoc(examDocRef, dataToSave);
    toast({
      title: "Examen Guardado",
      description: `El examen NE: ${examData.ne} ha sido guardado en la base de datos.`,
    });
  } catch (error: any) {
    console.error("Error saving document to Firestore: ", error);
    toast({
      title: "Error al Guardar en BD",
      description: `No se pudo guardar el examen en la base de datos. ${error.message}`,
      variant: "destructive",
    });
  }
};

  if (currentStep !== ExamStep.SUCCESS) {
    return null;
  }

  return (
    <Dialog open={currentStep === ExamStep.SUCCESS} onOpenChange={() => { /* Controlled by AppContext */ }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <DialogTitle className="text-xl font-semibold text-foreground">¡Operación Exitosa!</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
           <div className="text-center text-muted-foreground space-y-3">
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
           </div>
        </DialogDescription>
        <div className="mt-6 flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:gap-3 sm:justify-center items-center">
          <Button
            onClick={handleSaveToDatabase}
            variant="destructive"
            size="icon"
            aria-label="Guardar en Base de Datos"
          >
            <Save className="h-5 w-5 text-destructive-foreground" />
          </Button>
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
