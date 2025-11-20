
"use client";
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, FilePlus, Search, FileSpreadsheet, Edit, Eye, History, MoreHorizontal, User, UserCheck, Inbox, AlertTriangle } from 'lucide-react';
import { WorksheetModal } from '@/components/executive/WorksheetModal';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Worksheet, WorksheetWithCase, AforoCase, AforadorStatus, AforoCaseStatus, DigitacionStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorksheetDetails } from '@/components/executive/WorksheetDetails';
import { Input } from '@/components/ui/input';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';

export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [allWorksheets, setAllWorksheets] = useState<WorksheetWithCase[]>([]);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState(true);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<AforoCase | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<AforoCase | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ejecutivo')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchWorksheetsAndCases = useCallback(() => {
    if (!user?.email) return;
  
    setIsLoadingWorksheets(true);
    const q = query(
      collection(db, 'worksheets'),
      where('createdBy', '==', user.email),
      orderBy('createdAt', 'desc')
    );
  
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const worksheetsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worksheet));
        const worksheetsWithCases: WorksheetWithCase[] = await Promise.all(
            worksheetsData.map(async (ws) => {
                let aforoCase: AforoCase | undefined;
                if(ws.id) {
                    try {
                        const caseDocRef = doc(db, 'AforoCases', ws.id);
                        const caseSnap = await getDoc(caseDocRef);
                        if (caseSnap.exists()) {
                            aforoCase = { id: caseSnap.id, ...caseSnap.data() } as AforoCase;
                        }
                    } catch (e) {
                        console.error("Could not fetch aforo case for " + ws.id, e);
                    }
                }
                return { ...ws, aforoCase };
            })
        );
        
        setAllWorksheets(worksheetsWithCases);
        setIsLoadingWorksheets(false);
    }, (error) => {
      console.error("Error fetching worksheets: ", error);
      setIsLoadingWorksheets(false);
    });
  
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = fetchWorksheetsAndCases();
    return () => unsubscribe && unsubscribe();
  }, [fetchWorksheetsAndCases]);

  const filteredWorksheets = useMemo(() => {
    if (!searchTerm) {
      return allWorksheets;
    }
    return allWorksheets.filter(ws =>
      ws.ne.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allWorksheets, searchTerm]);
  
  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    return format(d, "dd MMM, yyyy 'a las' h:mm a", { locale: es });
  };
  
  const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) {
        case 'Aprobado': return 'default';
        case 'Rechazado': return 'destructive';
        case 'Revalidación Solicitada': return 'secondary';
        case 'Pendiente':
        default:
            return 'outline';
    }
  };

  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) {
        case 'Listo para revisión': return 'default';
        case 'Incompleto': return 'destructive';
        case 'En proceso': return 'secondary';
        case 'Pendiente por completar': return 'destructive';
        default: return 'outline';
    }
  };

  const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Almacenado') {
        return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge>
    }
     if (status) {
        return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>
    }
    return <Badge variant="outline">Pendiente</Badge>;
  }
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Ejecutivo';

  if (authLoading || !user || user.role !== 'ejecutivo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedWorksheet) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 w-full">
                 <WorksheetDetails worksheet={selectedWorksheet} onClose={() => setSelectedWorksheet(null)} />
            </div>
        </AppShell>
    )
  }

  if (selectedIncidentForDetails) {
    return (
      <AppShell>
        <div className="py-2 md:py-5">
          <IncidentReportDetails
            caseData={selectedIncidentForDetails}
            onClose={() => setSelectedIncidentForDetails(null)}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5 space-y-6">
        <Card className="w-full max-w-2xl mx-auto custom-shadow">
            <CardHeader className="text-center pb-4">
                <CardTitle className="text-3xl font-bold">Bienvenido, {welcomeName}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">Panel de Control Ejecutivo</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pt-4">
                <p className="text-center text-foreground">Seleccione una opción para continuar:</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full">
                     <Button asChild size="lg" className="h-20 text-lg">
                        <Link href="/executive/request">
                            <FilePlus className="mr-3 h-6 w-6" />
                            Solicitar Examen Previo
                        </Link>
                    </Button>
                     <Button size="lg" variant="default" className="h-20 text-lg" onClick={() => setIsWorksheetModalOpen(true)}>
                        <Edit className="mr-3 h-6 w-6" />
                        Hojas de Trabajo
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/database">
                           <Search className="mr-3 h-6 w-6" />
                           Buscar en Base de Datos
                        </Link>
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-20 text-lg">
                        <Link href="/reports">
                            <FileSpreadsheet className="mr-3 h-6 w-6" />
                            Revisar Reportes
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="w-full mx-auto custom-shadow">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2"><Inbox/> Mis Hojas de Trabajo Creadas</CardTitle>
                    <CardDescription>Un listado de los registros que ha generado y su estado actual en el flujo de trabajo.</CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por NE..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
              </div>
            </CardHeader>
            <CardContent>
                {isLoadingWorksheets ? (
                     <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : filteredWorksheets.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">
                      {searchTerm ? `No se encontraron hojas de trabajo para "${searchTerm}".` : 'No ha creado ninguna hoja de trabajo.'}
                    </p>
                ) : (
                    <div className="overflow-x-auto table-container rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>NE</TableHead>
                                    <TableHead>Aforador</TableHead>
                                    <TableHead>Estatus Aforador</TableHead>
                                    <TableHead>Revisor</TableHead>
                                    <TableHead>Estatus Revisor</TableHead>
                                    <TableHead>Digitación</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredWorksheets.map(ws => (
                                    <TableRow key={ws.id} className={ws.aforoCase?.incidentStatus === 'Pendiente' ? "bg-gray-100" : ""}>
                                        <TableCell className="font-medium">{ws.ne}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {ws.aforoCase?.aforador || 'Sin asignar'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getAforadorStatusBadgeVariant(ws.aforoCase?.aforadorStatus)}>
                                                {ws.aforoCase?.aforadorStatus || 'Pendiente'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-muted-foreground" />
                                                {ws.aforoCase?.revisorAsignado || 'Sin asignar'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <Badge variant={getRevisorStatusBadgeVariant(ws.aforoCase?.revisorStatus)}>
                                                {ws.aforoCase?.revisorStatus || 'Pendiente'}
                                             </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {getDigitacionBadge(ws.aforoCase?.digitacionStatus, ws.aforoCase?.declaracionAduanera)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Abrir menú</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                     <DropdownMenuItem onSelect={() => setSelectedWorksheet(ws)}>
                                                        <Eye className="mr-2 h-4 w-4" /> Ver Hoja
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => setSelectedCaseForHistory(ws.aforoCase!)} disabled={!ws.aforoCase}>
                                                        <History className="mr-2 h-4 w-4" /> Ver Bitácora
                                                    </DropdownMenuItem>
                                                     <DropdownMenuItem onSelect={() => setSelectedCaseForIncident(ws.aforoCase!)} disabled={!ws.aforoCase}>
                                                        <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                                                    </DropdownMenuItem>
                                                    {ws.aforoCase?.incidentReported && (
                                                      <DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(ws.aforoCase!)}>
                                                          <Eye className="mr-2 h-4 w-4" /> Ver Incidencia
                                                      </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </AppShell>
    <WorksheetModal isOpen={isWorksheetModalOpen} onClose={() => setIsWorksheetModalOpen(false)} onWorksheetCreated={fetchWorksheetsAndCases} />
    {selectedCaseForHistory && (
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
    {selectedCaseForIncident && (
        <IncidentReportModal
            isOpen={!!selectedCaseForIncident}
            onClose={() => setSelectedCaseForIncident(null)}
            caseData={selectedCaseForIncident}
        />
    )}
    </>
  );
}
