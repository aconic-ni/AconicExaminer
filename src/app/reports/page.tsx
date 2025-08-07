
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import { Loader2, Download, Search, Eye, Calendar, CalendarRange, Sparkles, MessageSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { ExamDocument } from '@/types';
import type { DateRange } from 'react-day-picker';
import { downloadReportAsExcel } from '@/lib/fileExporter';
import { FetchedExamDetails } from '@/components/database/FetchedExamDetails';
import { Badge } from '@/components/ui/badge';

type SearchMode = 'range' | 'specific';

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [searchMode, setSearchMode] = useState<SearchMode>('range');
  
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamDocument | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/');
    }
  }, [user, authLoading, router]);

  const executeSearch = async (start: Date, end: Date) => {
    setIsLoading(true);
    setError(null);
    setExams([]);
    setSelectedExam(null);

    try {
      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);
      
      const q = query(
        collection(db, "examenesPrevios"),
        where("lastUpdated", ">=", startTimestamp),
        where("lastUpdated", "<=", endTimestamp)
      );

      const querySnapshot = await getDocs(q);
      
      const examPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const examData = { id: docSnapshot.id, ...docSnapshot.data() } as ExamDocument;
        
        const commentsRef = collection(db, "examenesPrevios", docSnapshot.id, "comments");
        const commentsSnapshot = await getDocs(commentsRef);
        
        return {
          ...examData,
          commentCount: commentsSnapshot.size,
        };
      });

      const fetchedExamsWithCounts = await Promise.all(examPromises);
      
      fetchedExamsWithCounts.sort((a, b) => (b.lastUpdated?.toMillis() ?? 0) - (a.lastUpdated?.toMillis() ?? 0));


      setExams(fetchedExamsWithCounts);
      if (fetchedExamsWithCounts.length === 0) {
        setError("No se encontraron exámenes en el periodo seleccionado.");
      }

    } catch (err: any) {
      console.error("Error fetching reports from Firestore: ", err);
      setError("Ocurrió un error al buscar los reportes. Inténtelo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchMode === 'range') {
      if (!dateRange || !dateRange.from || !dateRange.to) {
        setError("Por favor, seleccione un rango de fechas completo.");
        return;
      }
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      executeSearch(dateRange.from, endOfDay);

    } else if (searchMode === 'specific') {
      if (!specificDate) {
        setError("Por favor, seleccione una fecha.");
        return;
      }
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);
      executeSearch(startOfDay, endOfDay);
    }
  };

  const handleSearchToday = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    setDateRange(undefined);
    setSpecificDate(undefined);
    
    executeSearch(todayStart, todayEnd);
  }
  
  const handleExport = () => {
      if (exams.length > 0) {
          downloadReportAsExcel(exams);
      } else {
          alert("No hay datos para exportar. Realice una búsqueda primero.")
      }
  }

  const handleViewDetails = (exam: ExamDocument) => {
    setSelectedExam(exam);
  };

  const handleCloseDetails = () => {
    setSelectedExam(null);
  };
  
  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });
  };


  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedExam) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 w-full max-w-5xl mx-auto">
                 <FetchedExamDetails exam={selectedExam} onClose={handleCloseDetails} />
            </div>
        </AppShell>
    )
  }

  const isSearchDisabled = isLoading || (searchMode === 'range' && (!dateRange?.from || !dateRange?.to)) || (searchMode === 'specific' && !specificDate);


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Reportes de Exámenes Previos</CardTitle>
            <CardDescription className="text-muted-foreground">
              Filtre los exámenes por rango de fechas, fecha específica o consulte los de hoy. La búsqueda se basa en la última actualización del examen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
                    <Button variant={searchMode === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('range')} className="h-8">
                       <CalendarRange className="mr-2 h-4 w-4"/> Rango
                    </Button>
                    <Button variant={searchMode === 'specific' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('specific')} className="h-8">
                       <Calendar className="mr-2 h-4 w-4"/> Fecha Específica
                    </Button>
                </div>
              
              {searchMode === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
              {searchMode === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
              
              <Button onClick={handleSearch} disabled={isSearchDisabled} className="btn-primary w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button onClick={handleSearchToday} disabled={isLoading} variant="outline" className="btn-secondary w-full sm:w-auto">
                 <Sparkles className="mr-2 h-4 w-4" />
                 Buscar Hoy
              </Button>
              <Button onClick={handleExport} disabled={isLoading || exams.length === 0} variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Exportar a Excel
              </Button>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Cargando reportes...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">
                {error}
              </div>
            )}

            {!isLoading && exams.length > 0 && (
              <div className="overflow-x-auto table-container rounded-lg border mt-4">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>NE</TableHead>
                      <TableHead>Consignatario</TableHead>
                      <TableHead>Solicitado Por</TableHead>
                      <TableHead>Fecha Asignación</TableHead>
                      <TableHead>Asignado a</TableHead>
                      <TableHead>Inicio de Previo</TableHead>
                      <TableHead>Fin de Previo</TableHead>
                      <TableHead className="text-center">Productos</TableHead>
                      <TableHead className="text-center">Bitácora</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.ne}</TableCell>
                        <TableCell>{exam.consignee}</TableCell>
                        <TableCell>
                          {exam.requestedBy ? <Badge variant="outline">{exam.requestedBy}</Badge> : 'N/A'}
                        </TableCell>
                        <TableCell>{formatTimestamp(exam.assignedAt)}</TableCell>
                        <TableCell>
                           {exam.assignedTo ? <Badge variant="secondary">{exam.assignedTo}</Badge> : 'N/A'}
                        </TableCell>
                        <TableCell>{formatTimestamp(exam.createdAt)}</TableCell>
                        <TableCell>{formatTimestamp(exam.completedAt)}</TableCell>
                        <TableCell className="text-center">{exam.products?.length || 0}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                                <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                                {exam.commentCount ?? 0}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetails(exam)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver
                            </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
             {!isLoading && !error && exams.length === 0 && (
                <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                    Seleccione un modo de búsqueda y un criterio para generar un reporte.
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

