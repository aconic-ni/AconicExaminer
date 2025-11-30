
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import { DatePicker } from '@/components/reports/DatePicker';
import { Loader2, Search, Eye, Edit, Archive, History, Inbox, Trash2, FolderOpen, Megaphone } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ExamDocument, AdminAuditLogEntry, AuditLogEntry } from '@/types';
import type { DateRange } from 'react-day-picker';
import { EditableExamDetails } from '@/components/admin/EditableExamDetails';
import { AuditLogPreview } from '@/components/admin/AuditLogPreview';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppContext, ExamStep } from '@/context/AppContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';


type ViewMode = 'active' | 'archived';
type CombinedLog = (AdminAuditLogEntry | AuditLogEntry) & { sortDate: Date };


export default function AdminControlPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { setExamData, setProducts, setCurrentStep } = useAppContext();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [searchMode, setSearchMode] = useState<'range' | 'specific'>('range');
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  const [allExams, setAllExams] = useState<ExamDocument[]>([]);
  const [filteredExams, setFilteredExams] = useState<ExamDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedExam, setSelectedExam] = useState<ExamDocument | null>(null);
  const [auditLogs, setAuditLogs] = useState<CombinedLog[]>([]);
  const [isViewingLogs, setIsViewingLogs] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "examenesPrevios"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedExams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamDocument));
      setAllExams(fetchedExams);
      // Filter is now handled by useEffect
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("No se pudieron cargar los datos de los exámenes.");
      toast({ title: "Error de Carga", description: "No se pudieron cargar los datos iniciales. Verifique los índices de Firestore.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    } else if(user) {
        fetchInitialData();
    }
  }, [user, authLoading, router, fetchInitialData]);

  const applyFilters = useCallback(() => {
    let dateFiltered = allExams;
    
    // Date filtering logic
    if (searchMode === 'range' && dateRange?.from && dateRange.to) {
        const start = dateRange.from;
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        dateFiltered = allExams.filter(exam => {
            const examDate = exam.createdAt?.toDate();
            return examDate && examDate >= start && examDate <= end;
        });
    } else if (searchMode === 'specific' && specificDate) {
        const start = new Date(specificDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(specificDate);
        end.setHours(23, 59, 59, 999);
        dateFiltered = allExams.filter(exam => {
             const examDate = exam.createdAt?.toDate();
             return examDate && examDate >= start && examDate <= end;
        });
    }

    // View mode filtering logic
    const finalFiltered = dateFiltered.filter(e => viewMode === 'archived' ? e.isArchived === true : !e.isArchived);
    setFilteredExams(finalFiltered);
  }, [allExams, dateRange, searchMode, specificDate, viewMode]);
  
  useEffect(() => {
    applyFilters();
  }, [viewMode, allExams, applyFilters]);
  
  const handleSearch = () => {
    applyFilters();
  };
  
  const handleViewDetails = (exam: ExamDocument) => {
    setSelectedExam(exam);
    setIsViewingLogs(false);
    setAuditLogs([]);
  };

  const handleEditExam = (exam: ExamDocument) => {
    setExamData({
      ne: exam.ne,
      reference: exam.reference,
      consignee: exam.consignee,
      location: exam.location,
      manager: exam.manager
    }, true); // isRecovery = true to enable logging
    setProducts(exam.products || []);
    setCurrentStep(ExamStep.PRODUCT_LIST);
    router.push('/examiner');
  };

  const handleViewModifications = async (exam: ExamDocument) => {
    setSelectedExam(exam);
    setIsViewingLogs(true);
    setAuditLogs([]);
    try {
        const adminLogsQuery = query(
            collection(db, "adminAuditLog"),
            where("docId", "==", exam.id),
        );

        const gestorLogsQuery = query(
            collection(db, "examenesRecuperados"),
            where("examNe", "==", exam.ne),
        );

        const [adminSnapshot, gestorSnapshot] = await Promise.all([
            getDocs(adminLogsQuery),
            getDocs(gestorLogsQuery)
        ]);

        const combinedLogs: CombinedLog[] = [];

        adminSnapshot.forEach(doc => {
            const data = doc.data() as AdminAuditLogEntry;
            combinedLogs.push({ ...data, id: doc.id, sortDate: data.timestamp.toDate() });
        });

        gestorSnapshot.forEach(doc => {
            const data = doc.data() as AuditLogEntry;
            combinedLogs.push({ ...data, id: doc.id, sortDate: data.changedAt.toDate() });
        });
        
        combinedLogs.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

        setAuditLogs(combinedLogs);

    } catch (err) {
      console.error("Error fetching audit logs:", err);
      toast({ title: "Error", description: "No se pudieron cargar los registros de cambios.", variant: "destructive" });
    }
  };

  const handleArchiveAction = async (examId: string, archive: boolean) => {
     if (!user || !user.email) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }

    const examRef = doc(db, "examenesPrevios", examId);
    try {
      const oldExam = allExams.find(e => e.id === examId);
      const oldValue = oldExam?.isArchived ?? false;

      await updateDoc(examRef, { isArchived: archive });
      
      const logRef = collection(db, "adminAuditLog");
      await addDoc(logRef, {
          collection: 'examenesPrevios',
          docId: examId,
          adminId: user.uid,
          adminEmail: user.email,
          timestamp: serverTimestamp(),
          action: 'update',
          changes: [{
            field: 'isArchived',
            oldValue: oldValue,
            newValue: archive
          }]
      });

      toast({ title: `Examen ${archive ? 'archivado' : 'restaurado'} con éxito.` });
      // Refetch all data to ensure consistency
      fetchInitialData();
    } catch (error) {
      console.error("Error archiving document:", error);
      toast({ title: "Error", description: `No se pudo ${archive ? 'archivar' : 'restaurar'} el examen.`, variant: "destructive" });
    }
  };

  const handleCloseDetails = () => {
    setSelectedExam(null);
    setAuditLogs([]);
    setIsViewingLogs(false);
  };

  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return format(timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: es });
  };
  

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (selectedExam && !isViewingLogs) {
      return (
        <AppShell>
          <div className="py-2 md:py-5">
            <EditableExamDetails exam={selectedExam} onClose={handleCloseDetails} />
          </div>
        </AppShell>
      )
  }
  
  if (selectedExam && isViewingLogs) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 max-w-5xl mx-auto">
                 <div className="bg-card p-4 rounded-lg shadow-md">
                    <Button onClick={handleCloseDetails} variant="outline" className="mb-4 no-print">Volver al listado</Button>
                    <AuditLogPreview logs={auditLogs} exam={selectedExam} />
                 </div>
            </div>
        </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-7xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-semibold text-foreground">Control de Registros</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Busque, visualice, edite y archive exámenes previos.
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/admin/control/avisos">
                    <Megaphone className="mr-2 h-4 w-4" /> Gestionar Avisos
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant={searchMode === 'range' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('range')}>Rango de Fechas</Button>
                    <Button variant={searchMode === 'specific' ? 'default' : 'ghost'} size="sm" onClick={() => setSearchMode('specific')}>Fecha Específica</Button>
                </div>
                 <div className="flex flex-wrap items-center gap-4">
                    {searchMode === 'range' && <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />}
                    {searchMode === 'specific' && <DatePicker date={specificDate} onDateChange={setSpecificDate} />}
                    <Button onClick={handleSearch} disabled={isLoading} className="btn-primary"><Search className="mr-2 h-4 w-4"/>{isLoading ? 'Buscando...' : 'Buscar'}</Button>
                </div>
            </div>
            
            <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <Button size="sm" variant={viewMode === 'active' ? 'secondary' : 'ghost'} onClick={() => setViewMode('active')}>
                            <Inbox className="mr-2 h-4 w-4" /> Activos ({allExams.filter(e => !e.isArchived).length})
                        </Button>
                        <Button size="sm" variant={viewMode === 'archived' ? 'secondary' : 'ghost'} onClick={() => setViewMode('archived')}>
                            <Archive className="mr-2 h-4 w-4" /> Archivados ({allExams.filter(e => e.isArchived).length})
                        </Button>
                    </div>
                </div>

                {isLoading && (
                  <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/><p className="ml-3 text-muted-foreground">Cargando...</p></div>
                )}
                {error && !isLoading && (
                  <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>
                )}
                {!isLoading && filteredExams.length > 0 && (
                  <div className="overflow-x-auto table-container rounded-lg border">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead>NE</TableHead>
                          <TableHead>Consignatario</TableHead>
                          <TableHead>Asignado a</TableHead>
                          <TableHead>Fecha Creación</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExams.map((exam) => (
                          <TableRow key={exam.id}>
                            <TableCell className="font-medium">{exam.ne}</TableCell>
                            <TableCell>{exam.consignee}</TableCell>
                            <TableCell><Badge variant="secondary">{exam.assignedTo || exam.manager}</Badge></TableCell>
                            <TableCell>{formatTimestamp(exam.createdAt)}</TableCell>
                            <TableCell>
                                {exam.isArchived ? <Badge variant="destructive">Archivado</Badge> : (exam.status === 'complete' ? <Badge className="bg-green-500 text-white">Completo</Badge> : <Badge variant="outline">Incompleto</Badge>)}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="ghost" size="sm" onClick={() => handleViewDetails(exam)}><Eye className="h-4 w-4"/> <span className="sr-only">Ver</span></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleViewModifications(exam)}><History className="h-4 w-4"/> <span className="sr-only">Modificaciones</span></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEditExam(exam)}><Edit className="h-4 w-4"/> <span className="sr-only">Editar</span></Button>
                                
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className={exam.isArchived ? "text-green-600" : "text-destructive"}>
                                            {exam.isArchived ? <FolderOpen className="h-4 w-4"/> : <Trash2 className="h-4 w-4"/>}
                                            <span className="sr-only">{exam.isArchived ? 'Restaurar' : 'Archivar'}</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción {exam.isArchived ? 'restaurará' : 'archivará'} el examen previo. {exam.isArchived ? 'Los usuarios podrán verlo de nuevo.' : 'No será visible para los usuarios, pero se podrá recuperar.'}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleArchiveAction(exam.id!, !exam.isArchived)}>Sí, continuar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                 {!isLoading && !error && filteredExams.length === 0 && (
                    <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                        No se encontraron exámenes para los criterios de búsqueda actuales.
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

    