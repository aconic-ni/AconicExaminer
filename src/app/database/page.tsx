
"use client";
import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { ExamDocument } from '@/types';
import { FetchedExamDetails } from '@/components/database/FetchedExamDetails';

export default function DatabasePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [searchTermNE, setSearchTermNE] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedExam, setFetchedExam] = useState<ExamDocument | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (!user.isStaticUser && user.role !== 'aforador'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);
  
  const handleCloseDetails = () => setFetchedExam(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedSearchTerm = searchTermNE.trim();
    if (!trimmedSearchTerm) {
      setError("Por favor, ingrese un NE para buscar.");
      setFetchedExam(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFetchedExam(null);

    const potentialIds = [
      trimmedSearchTerm.toUpperCase(),
      trimmedSearchTerm.toLowerCase(),
      trimmedSearchTerm,
    ];
    const uniquePotentialIds = Array.from(new Set(potentialIds));

    let foundExam: ExamDocument | null = null;

    try {
      for (const id of uniquePotentialIds) {
        const examDocRef = doc(db, "examenesPrevios", id);
        const docSnap = await getDoc(examDocRef);
        if (docSnap.exists()) {
          foundExam = { id: docSnap.id, ...docSnap.data() } as ExamDocument;
          break; // Document found, exit loop
        }
      }

      if (foundExam) {
        setFetchedExam(foundExam);
      } else {
        setError("Archivo erróneo o no ha sido creado por gestor para el NE: " + trimmedSearchTerm);
      }
    } catch (err: any) {
      console.error("Error fetching document from Firestore: ", err);
      let userFriendlyError = "Error al buscar el examen. Intente de nuevo.";
      if (err.code === 'permission-denied') {
        userFriendlyError = "No tiene permisos para acceder a esta información.";
      }
      setError(userFriendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user || (!user.isStaticUser && user.role !== 'aforador')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-5xl mx-auto custom-shadow no-print">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Base de Datos de Exámenes Previos</CardTitle>
            <CardDescription className="text-muted-foreground">
              Busque exámenes previos guardados por su número NE (Seguimiento NX1).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3 mb-6">
              <Input
                type="text"
                placeholder="Ingrese NE (Ej: NX1-12345)"
                value={searchTermNE}
                onChange={(e) => setSearchTermNE(e.target.value)}
                className="flex-grow"
                aria-label="Buscar por NE"
              />
              <Button type="submit" className="btn-primary w-full sm:w-auto" disabled={isLoading}>
                <Search className="mr-2 h-4 w-4" /> {isLoading ? 'Buscando...' : 'Ejecutar Búsqueda'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex justify-center items-center py-6 no-print">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Cargando examen...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center no-print max-w-5xl mx-auto">
            {error}
          </div>
        )}
        
        <div className="w-full max-w-5xl mx-auto">
            {fetchedExam && !isLoading && <FetchedExamDetails exam={fetchedExam} onClose={handleCloseDetails} />}
        </div>


        {!fetchedExam && !isLoading && !error && (
             <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center no-print max-w-5xl mx-auto">
                Ingrese un NE para buscar un examen previo.
             </div>
        )}

      </div>
    </AppShell>
  );
}
