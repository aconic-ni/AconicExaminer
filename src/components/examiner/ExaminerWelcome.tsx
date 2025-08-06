
"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, FilePlus, RefreshCw } from 'lucide-react';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ExamDocument } from '@/types';
import { useAuth } from '@/context/AuthContext';

export function ExaminerWelcome() {
  const { setCurrentStep, setExamData, setProducts, resetApp } = useAppContext();
  const { user } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);
  const [neToRecover, setNeToRecover] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleStartNew = () => {
    resetApp(); // Ensure everything is clean
    setCurrentStep(ExamStep.INITIAL_INFO);
  };

  const handleRecover = async () => {
    if (!neToRecover.trim()) {
      setError("Por favor, ingrese un NE para recuperar.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const examDocRef = doc(db, "examenesPrevios", neToRecover.trim().toUpperCase());
      const docSnap = await getDoc(examDocRef);

      if (docSnap.exists()) {
        const recoveredExam = docSnap.data() as ExamDocument;
        
        // Load data into context and flag as recovery
        setExamData({
            ne: recoveredExam.ne,
            reference: recoveredExam.reference,
            consignee: recoveredExam.consignee,
            location: recoveredExam.location,
            manager: recoveredExam.manager
        }, true); // true indicates this is a recovery
        setProducts(recoveredExam.products || []);

        toast({
          title: "Examen Recuperado",
          description: `Se cargó el progreso del examen ${recoveredExam.ne}.`,
        });

        // Move to the product list step
        setCurrentStep(ExamStep.PRODUCT_LIST);

      } else {
        setError(`No se encontró ningún examen en progreso para el NE: ${neToRecover}`);
        toast({
          title: "Error de Recuperación",
          description: `No se encontró un examen para el NE: ${neToRecover}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error recovering exam:", err);
      setError("Ocurrió un error al intentar recuperar el examen.");
      toast({
        title: "Error de Servidor",
        description: "No se pudo comunicar con la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Gestor';

  return (
    <Card className="w-full max-w-2xl mx-auto custom-shadow">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">Bienvenido, {welcomeName}</CardTitle>
        <CardDescription>¿Qué desea hacer hoy?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isRecovering ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setIsRecovering(true)} size="lg" variant="outline" className="h-20 text-lg">
              <RefreshCw className="mr-3 h-6 w-6" />
              Continuar Examen Previo
            </Button>
            <Button onClick={handleStartNew} size="lg" className="h-20 text-lg btn-primary">
              <FilePlus className="mr-3 h-6 w-6" />
              Empezar Examen Nuevo
            </Button>
          </div>
        ) : (
          <div className="p-4 border rounded-md bg-secondary/30">
            <h3 className="font-semibold text-center mb-3">Recuperar Examen no Finalizado</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                type="text"
                placeholder="Ingrese NE a recuperar"
                value={neToRecover}
                onChange={(e) => setNeToRecover(e.target.value)}
                className="flex-grow"
                aria-label="NE a recuperar"
                onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
              />
              <Button onClick={handleRecover} className="btn-primary w-full sm:w-auto" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isLoading ? 'Buscando...' : 'Recuperar'}
              </Button>
            </div>
            {error && <p className="text-destructive text-sm mt-2 text-center">{error}</p>}
            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => setIsRecovering(false)}>
                O empezar un examen nuevo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
