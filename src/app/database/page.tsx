
"use client";
import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, Download, Printer, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { ExamDocument, Product } from '@/types';
import { downloadExcelFile } from '@/lib/fileExporter'; // Import the exporter

// Helper component for displaying product details in the fetched exam
const FetchedDetailItem: React.FC<{ label: string; value?: string | number | null | boolean | FirestoreTimestamp }> = ({ label, value }) => {
  let displayValue: string;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else if (value instanceof FirestoreTimestamp) {
    displayValue = value.toDate().toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{displayValue}</p>
    </div>
  );
};

const getProductStatusText = (product: Product): string => {
  const statuses: string[] = [];
  if (product.isConform) statuses.push("Conforme a factura");
  if (product.isExcess) statuses.push("Excedente");
  if (product.isMissing) statuses.push("Faltante");
  if (product.isFault) statuses.push("Avería");
  if (statuses.length === 0) return "Sin estado específico";
  return statuses.join(', ');
};


// Component to display the fetched exam
const FetchedExamDetails: React.FC<{ exam: ExamDocument; onClose: () => void }> = ({ exam, onClose }) => {
  return (
    <Card className="mt-6 w-full custom-shadow" id="printable-area">
      <CardHeader>
        <Image
            src="/HEADERSEXA.svg"
            alt="Examen Header"
            width={800}
            height={100}
            className="w-full h-auto mb-4"
            priority
        />
        <div className="relative">
            <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Detalles del Examen: {exam.ne}</CardTitle>
            <button onClick={onClose} className="absolute -top-2 -right-2 p-1 text-destructive hover:text-destructive/80 no-print">
                <X className="h-6 w-6" />
            </button>
        </div>
        <CardDescription className="text-muted-foreground">
          Información del examen recuperada de la base de datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 bg-secondary/30 p-4 rounded-md shadow-sm text-sm print:grid-cols-2 print:gap-x-8 print:gap-y-3">
            <FetchedDetailItem label="NE (Tracking NX1)" value={exam.ne} />
            <FetchedDetailItem label="Referencia" value={exam.reference} />
            <FetchedDetailItem label="Consignatario" value={exam.consignee} />
            <FetchedDetailItem label="Gestor del Examen" value={exam.manager} />
            <FetchedDetailItem label="Ubicación Mercancía" value={exam.location} />
            <FetchedDetailItem label="Guardado por (correo)" value={exam.savedBy} />
            <FetchedDetailItem label="Fecha y Hora de Guardado" value={exam.savedAt} />
        </div>

        <div>
          <h4 className="text-lg font-medium mb-3 text-foreground">Productos ({exam.products?.length || 0})</h4>
          {exam.products && exam.products.length > 0 ? (
            <div className="space-y-6 print:space-y-4">
              {exam.products.map((product, index) => (
                <div key={product.id || index} className="p-4 border border-border bg-card rounded-lg shadow print-product-container print:border print:border-gray-200 print:shadow-none print:bg-white">
                  <h5 className="text-md font-semibold mb-3 text-primary print:border-b print:pb-2 print:mb-4">
                    Producto {index + 1}
                    {product.itemNumber && <span className="text-sm font-normal text-muted-foreground"> (Item: {product.itemNumber})</span>}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-x-6 gap-y-4">
                    <FetchedDetailItem label="Número de Item" value={product.itemNumber} />
                    <FetchedDetailItem label="Peso" value={product.weight} />
                    <FetchedDetailItem label="Marca" value={product.brand} />
                    <FetchedDetailItem label="Modelo" value={product.model} />
                    <FetchedDetailItem label="Unidad de Medida" value={product.unitMeasure} />
                    <FetchedDetailItem label="Serie" value={product.serial} />
                    <FetchedDetailItem label="Origen" value={product.origin} />
                    <FetchedDetailItem label="Numeración de Bultos" value={product.numberPackages} />
                    <FetchedDetailItem label="Cantidad de Bultos" value={product.quantityPackages} />
                    <FetchedDetailItem label="Cantidad de Unidades" value={product.quantityUnits} />
                    <FetchedDetailItem label="Estado de Mercancía (Condición)" value={product.packagingCondition} />
                    <div className="md:col-span-2 lg:col-span-3 print:col-span-2">
                      <FetchedDetailItem label="Descripción" value={product.description} />
                    </div>
                     <div className="md:col-span-2 lg:col-span-3 print:col-span-2">
                      <FetchedDetailItem label="Observación" value={product.observation} />
                    </div>
                    <div className="md:col-span-full pt-2 mt-2 border-t border-border print:col-span-2">
                       <FetchedDetailItem label="Estado General del Producto" value={getProductStatusText(product)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay productos registrados en este examen.</p>
          )}
        </div>
        <Image
            src="/FOOTEREXA.svg"
            alt="Examen Footer"
            width={800}
            height={50}
            className="w-full h-auto mt-6"
        />
      </CardContent>
    </Card>
  );
};


export default function DatabasePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [searchTermNE, setSearchTermNE] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedExam, setFetchedExam] = useState<ExamDocument | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !user.isStaticUser)) {
      router.push('/');
    }
  }, [user, authLoading, router]);
  
  const handleCloseDetails = () => setFetchedExam(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchTermNE.trim()) {
      setError("Por favor, ingrese un NE para buscar.");
      setFetchedExam(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFetchedExam(null);

    try {
      // Normalize search term to uppercase for case-insensitive search
      const normalizedNE = searchTermNE.trim().toUpperCase();
      const examDocRef = doc(db, "examenesPrevios", normalizedNE);
      const docSnap = await getDoc(examDocRef);

      if (docSnap.exists()) {
        setFetchedExam(docSnap.data() as ExamDocument);
      } else {
        setError("Archivo erróneo o no ha sido creado por gestor para el NE: " + searchTermNE);
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

  const handleExport = () => {
    if (fetchedExam) {
      downloadExcelFile(fetchedExam);
    } else {
      alert("No hay datos de examen para exportar. Realice una búsqueda primero.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading || !user || (user && !user.isStaticUser) ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-4xl mx-auto custom-shadow no-print">
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
              <Button type="button" onClick={handleExport} variant="outline" className="w-full sm:w-auto" disabled={!fetchedExam || isLoading}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Button type="button" onClick={handlePrint} variant="outline" className="w-full sm:w-auto" disabled={!fetchedExam || isLoading}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
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
          <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center no-print">
            {error}
          </div>
        )}

        {fetchedExam && !isLoading && <FetchedExamDetails exam={fetchedExam} onClose={handleCloseDetails} />}

        {!fetchedExam && !isLoading && !error && (
             <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center no-print">
                Ingrese un NE para buscar un examen previo.
             </div>
        )}

      </div>
    </AppShell>
  );
}
