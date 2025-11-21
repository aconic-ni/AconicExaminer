
"use client";
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, Edit, Eye, History, MoreHorizontal, User, UserCheck, Inbox, AlertTriangle, Download, ChevronsUpDown, Info } from 'lucide-react';
import { WorksheetModal } from '@/components/executive/WorksheetModal';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc, updateDoc, writeBatch, addDoc, getDocs } from 'firebase/firestore';
import type { Worksheet, AforoCase, AforadorStatus, AforoCaseStatus, DigitacionStatus, WorksheetWithCase, AforoCaseUpdate } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { AforoCaseHistoryModal } from '@/components/reporter/AforoCaseHistoryModal';
import { IncidentReportModal } from '@/components/reporter/IncidentReportModal';
import { Badge } from '@/components/ui/badge';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { ManageDocumentsModal } from '@/components/executive/ManageDocumentsModal';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { Checkbox } from '@/components/ui/checkbox';
import { downloadExecutiveReportAsExcel } from '@/lib/fileExporter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [allCases, setAllCases] = useState<AforoCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<AforoCase | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<AforoCase | null>(null);
  const [selectedCaseForDocs, setSelectedCaseForDocs] = useState<AforoCase | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [filters, setFilters] = useState({ facturado: false, noFacturado: true });

  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    facturado: false,
    noFacturado: true,
  });

  useEffect(() => {
    if (!authLoading && (!user || !['ejecutivo', 'coordinadora', 'admin'].includes(user.role || ''))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchCases = useCallback(() => {
    if (!user) return;
  
    setIsLoading(true);

    let q;
    // Admin and Coordinadora see all, Ejecutivo only sees their own.
    if (user.role === 'admin' || user.role === 'coordinadora') {
      q = query(collection(db, 'AforoCases'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'AforoCases'), where('executive', '==', user.displayName), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const casesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        setAllCases(casesData);
        setIsLoading(false);
    }, (error) => {
      console.error("Error fetching aforo cases: ", error);
      setIsLoading(false);
    });
  
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = fetchCases();
    return () => unsubscribe && unsubscribe();
  }, [fetchCases]);

  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any) => {
    if (!user || !user.displayName) { toast({ title: "No autenticado", variant: 'destructive' }); return; }
    
    const originalCase = allCases.find(c => c.id === caseId);
    if (!originalCase) return;

    if (JSON.stringify(originalCase[field as keyof AforoCase]) === JSON.stringify(value)) return;
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData: { [key: string]: any } = { [field]: value };
        // Special logic for 'facturado' checkbox
        if (field === 'facturado' && value === true) {
            updateData.facturadoAt = Timestamp.now();
        }

        batch.update(caseDocRef, updateData);

        const updateLog = {
            updatedAt: Timestamp.now(), updatedBy: user.displayName, field,
            oldValue: originalCase[field as keyof AforoCase] ?? null,
            newValue: value,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);

        await batch.commit();
        toast({ title: "Guardado", description: `El campo ${String(field)} ha sido actualizado.` });
    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: "No se pudo guardar el cambio.", variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
}, [user, allCases, toast]);

 const handleSearch = () => {
    setAppliedFilters({
      searchTerm,
      ...filters,
    });
  };
  
   const handleExport = async () => {
    if (filteredCases.length === 0) return;
    setIsExporting(true);
    
    try {
        const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];

        for (const caseItem of filteredCases) {
            const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'));
            const logSnapshot = await getDocs(logsQuery);
            logSnapshot.forEach(doc => {
                auditLogs.push({
                    ...(doc.data() as AforoCaseUpdate),
                    caseNe: caseItem.ne
                });
            });
        }
        
        downloadExecutiveReportAsExcel(filteredCases, auditLogs);
    } catch (e) {
        console.error("Error exporting data with audit logs: ", e);
    } finally {
        setIsExporting(false);
    }
};

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ facturado: false, noFacturado: true });
    setAppliedFilters({ searchTerm: '', facturado: false, noFacturado: true });
  };


  const filteredCases = useMemo(() => {
    let filtered = allCases;
    if (appliedFilters.searchTerm) {
        filtered = filtered.filter(c =>
          c.ne.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase()) ||
          c.consignee.toLowerCase().includes(appliedFilters.searchTerm.toLowerCase())
        );
    }
    
    if (appliedFilters.noFacturado && !appliedFilters.facturado) {
        filtered = filtered.filter(c => !c.facturado);
    } else if (appliedFilters.facturado && !appliedFilters.noFacturado) {
        filtered = filtered.filter(c => c.facturado === true);
    } // If both are true or both are false, show all (no filtering)

    return filtered;
  }, [allCases, appliedFilters]);
  
  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    return format(d, "dd MMM, yyyy 'a las' h:mm a", { locale: es });
  };
  
  const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
  };
  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'Listo para revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente por completar': return 'destructive'; default: return 'outline'; }
  };
  const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') { return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge> }
    if (status) { return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>; }
    return <Badge variant="outline">Pendiente</Badge>;
  }
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Usuario';

  if (authLoading || !user || !['ejecutivo', 'coordinadora', 'admin'].includes(user.role || '')) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (selectedIncidentForDetails) {
    return (<AppShell><div className="py-2 md:py-5"><IncidentReportDetails caseData={selectedIncidentForDetails} onClose={() => setSelectedIncidentForDetails(null)} /></div></AppShell>);
  }

  return (
    <>
    <AppShell>
      <div className="py-2 md:py-5 space-y-6">
        <Card className="w-full mx-auto custom-shadow">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl"><Inbox/> Panel Ejecutivo</CardTitle>
                        <CardDescription>Seguimiento de operaciones, desde la hoja de trabajo hasta la facturación.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Button asChild size="lg" className="h-12 text-md">
                           <Link href="/executive/request"><FilePlus className="mr-2 h-5 w-5" />Solicitar Previo</Link>
                        </Button>
                        <Button size="lg" variant="default" className="h-12 text-md" onClick={() => setIsWorksheetModalOpen(true)}>
                           <Edit className="mr-2 h-5 w-5" />Hojas de Trabajo
                       </Button>
                    </div>
                </div>
                <div className="border-t pt-4 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                     <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Buscar por NE o Consignatario..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                     <div className="flex items-center flex-wrap gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[200px] justify-start"><ChevronsUpDown className="mr-2 h-4 w-4"/> Filtrar Visibilidad</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="end">
                                <div className="grid gap-2">
                                  <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={filters.noFacturado} onCheckedChange={(checked) => setFilters(f => ({...f, noFacturado: !!checked}))}/>No Facturados</label>
                                  <label className="flex items-center gap-2 text-sm font-normal"><Checkbox checked={filters.facturado} onCheckedChange={(checked) => setFilters(f => ({...f, facturado: !!checked}))}/>Facturados</label>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                        <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                        <Button onClick={handleExport} disabled={filteredCases.length === 0 || isExporting}>
                           {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                           {isExporting ? 'Exportando...' : 'Exportar a Excel'}
                        </Button>
                     </div>
                  </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                : filteredCases.length === 0 ? <p className="text-muted-foreground text-center py-10">No se encontraron casos con los filtros actuales.</p>
                : (
                    <div className="overflow-x-auto table-container rounded-lg border">
                        <TooltipProvider>
                        <Table><TableHeader><TableRow>
                            <TableHead>NE</TableHead>
                            <TableHead>Consignatario</TableHead>
                            <TableHead>Estado Aforador</TableHead>
                            <TableHead>Estado Revisor</TableHead>
                            <TableHead>Estado Digitación</TableHead>
                            <TableHead>Selectividad</TableHead>
                            <TableHead>Fecha Despacho</TableHead>
                            <TableHead>Facturado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {filteredCases.map(c => (
                                <TableRow key={c.id} className={savingState[c.id] ? "bg-amber-100" : ""}>
                                    <TableCell className="font-medium">{c.ne}</TableCell>
                                    <TableCell>{c.consignee}</TableCell>
                                    <TableCell><Badge variant={getAforadorStatusBadgeVariant(c.aforadorStatus)}>{c.aforadorStatus || 'Pendiente'}</Badge></TableCell>
                                    <TableCell><Badge variant={getRevisorStatusBadgeVariant(c.revisorStatus)}>{c.revisorStatus || 'Pendiente'}</Badge></TableCell>
                                    <TableCell>{getDigitacionBadge(c.digitacionStatus, c.declaracionAduanera)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={c.selectividad || ''}
                                                onValueChange={(value) => handleAutoSave(c.id, 'selectividad', value)}
                                                disabled={!c.declaracionAduanera || savingState[c.id]}
                                            >
                                                <SelectTrigger className="w-[120px]">
                                                    <SelectValue placeholder="Seleccionar..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="VERDE">VERDE</SelectItem>
                                                    <SelectItem value="AMARILLO">AMARILLO</SelectItem>
                                                    <SelectItem value="ROJO">ROJO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {c.selectividad === 'AMARILLO' && (
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Badge variant="secondary" className="cursor-help"><Info className="h-4 w-4" /></Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>CONSULTA DE VALORES</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell><DatePickerWithTime date={(c.fechaDespacho as Timestamp)?.toDate()} onDateChange={(d) => handleAutoSave(c.id, 'fechaDespacho', d ? Timestamp.fromDate(d) : null)} disabled={savingState[c.id] || !c.selectividad} /></TableCell>
                                    <TableCell><Checkbox checked={!!c.facturado} onCheckedChange={(checked) => handleAutoSave(c.id, 'facturado', !!checked)} disabled={savingState[c.id]} /></TableCell>
                                    <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => setSelectedCaseForDocs(c)} disabled={!c}><FilePlus className="mr-2 h-4 w-4" /> Docs y Permisos</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setSelectedCaseForHistory(c)} disabled={!c}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setSelectedCaseForIncident(c)} disabled={!c}><AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia</DropdownMenuItem>
                                            {c.incidentReported && (<DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>)}
                                        </DropdownMenuContent>
                                    </DropdownMenu></TableCell>
                                </TableRow>
                            ))}
                        </TableBody></Table>
                        </TooltipProvider>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </AppShell>
    <WorksheetModal isOpen={isWorksheetModalOpen} onClose={() => setIsWorksheetModalOpen(false)} onWorksheetCreated={fetchCases} />
    {selectedCaseForDocs && (<ManageDocumentsModal isOpen={!!selectedCaseForDocs} onClose={() => setSelectedCaseForDocs(null)} caseData={selectedCaseForDocs} />)}
    {selectedCaseForHistory && (<AforoCaseHistoryModal isOpen={!!selectedCaseForHistory} onClose={() => setSelectedCaseForHistory(null)} caseData={selectedCaseForHistory} />)}
    {selectedCaseForIncident && (<IncidentReportModal isOpen={!!selectedCaseForIncident} onClose={() => setSelectedCaseForIncident(null)} caseData={selectedCaseForIncident} />)}
    </>
  );
}
