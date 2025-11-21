
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, getDoc, collectionGroup } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, AforoCaseStatus, AforoCaseUpdate, AppUser, AforadorStatus, Worksheet, DigitacionStatus, IncidentStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, Eye, History, Repeat, MoreHorizontal, Edit, BookOpen, ChevronDown, ChevronRight, User, UserCheck, Send, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePickerWithTime } from '../reports/DatePickerWithTime';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { ObservationModal } from './ObservationModal';
import { AforoCaseHistoryModal } from './AforoCaseHistoryModal';
import { AforadorCommentModal } from './AforadorCommentModal';
import { IncidentReportModal } from './IncidentReportModal';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { WorksheetDetails } from '../executive/WorksheetDetails';
import { Input } from '../ui/input';
import { IncidentReportDetails } from './IncidentReportDetails';
import type { DateRange } from 'react-day-picker';

interface DailyAforoCasesTableProps {
    filters: {
        ne?: string;
        consignee?: string;
        dateRange?: DateRange;
    };
    setFilteredCases: (cases: AforoCase[]) => void;
}


export function DailyAforoCasesTable({ filters, setFilteredCases }: DailyAforoCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<AforoCase[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [selectedCaseForObservation, setSelectedCaseForObservation] = useState<AforoCase | null>(null);
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForAforadorComment, setSelectedCaseForAforadorComment] = useState<AforoCase | null>(null);
  const [selectedCaseForIncident, setSelectedCaseForIncident] = useState<AforoCase | null>(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);
  const [selectedIncidentForDetails, setSelectedIncidentForDetails] = useState<AforoCase | null>(null);

  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    return format(d, "dd/MM/yy hh:mm a", { locale: es });
  };

  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = cases.find(c => c.id === caseId);
    if (!originalCase) return;

    const oldValue = originalCase[field as keyof AforoCase];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
        return;
    }
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, { [field]: value });

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: field as keyof AforoCase,
            oldValue: oldValue ?? null,
            newValue: value,
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        if(!isTriggerFromFieldUpdate) {
            toast({ title: "Guardado Automático", description: `El campo ${String(field)} se ha actualizado.` });
        }
    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio en ${String(field)}.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, cases, toast]);

  const handleAssignAforador = useCallback((caseId: string, aforadorName: string) => {
      handleAutoSave(caseId, 'aforador', aforadorName);
      handleAutoSave(caseId, 'assignmentDate', Timestamp.now());
  }, [handleAutoSave]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
  
    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const roleQueries = [
            query(collection(db, 'users'), where('role', '==', 'aforador')),
            query(collection(db, 'users'), where('roleTitle', '==', 'agente aduanero')),
            query(collection(db, 'users'), where('roleTitle', '==', 'Supervisor'))
        ];

        try {
            const querySnapshots = await Promise.all(roleQueries.map(q => getDocs(q)));
            querySnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const userData = { uid: doc.id, ...doc.data() } as AppUser;
                    if (!usersMap.has(userData.uid)) {
                        usersMap.set(userData.uid, userData);
                    }
                });
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch (e) {
            console.error("Failed to fetch assignable users: ", e);
        }
    };

    fetchAssignableUsers();

    let casesQuery: any;
    // If user is executive, only show cases they created.
    if (user.role === 'ejecutivo') {
        casesQuery = query(collection(db, "AforoCases"), where('executive', '==', user.displayName), orderBy("createdAt", "desc"));
    } else {
        // Admin and other roles see all cases
        casesQuery = query(collection(db, "AforoCases"), orderBy("createdAt", "desc"));
    }
    
    const unsubscribe = onSnapshot(casesQuery, (snapshot) => {
      let fetchedCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
      
      // Client-side filtering
      if (filters.ne) {
          fetchedCases = fetchedCases.filter(c => c.ne.toUpperCase().includes(filters.ne!.toUpperCase()));
      }
      if (filters.consignee) {
          fetchedCases = fetchedCases.filter(c => c.consignee.toLowerCase().includes(filters.consignee!.toLowerCase()));
      }
      if (filters.dateRange?.from) {
           const end = filters.dateRange.to ? new Date(filters.dateRange.to) : new Date();
           end.setHours(23, 59, 59, 999);
           fetchedCases = fetchedCases.filter(c => {
               const caseDate = (c.createdAt as Timestamp)?.toDate();
               return caseDate && caseDate >= filters.dateRange!.from! && caseDate <= end;
           })
      }

      setCases(fetchedCases);
      setFilteredCases(fetchedCases);
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los casos.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, filters, setFilteredCases, toast]);
  
  const handleRequestRevalidation = async (caseItem: AforoCase) => {
     if (!user || !user.displayName) return;
     
     const newStatus: AforoCaseStatus = 'Revalidación Solicitada';
     const caseDocRef = doc(db, 'AforoCases', caseItem.id);
     const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

     try {
        await updateDoc(caseDocRef, { revisorStatus: newStatus });
        
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseItem.revisorStatus,
            newValue: newStatus,
            comment: "El aforador/admin solicita revalidación del caso.",
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({ title: "Solicitud Enviada", description: "Se ha solicitado la revalidación al agente." });
     } catch(e) {
        console.error(e);
        toast({title: "Error", description: "No se pudo solicitar la revalidación", variant: "destructive"});
     }
  }

  const handleAssignToDigitization = async (caseItem: AforoCase) => {
    if (!user || !user.displayName) return;

    if (caseItem.revisorStatus !== 'Aprobado') {
        toast({ title: "Acción no permitida", description: "El caso debe estar aprobado para ser asignado a digitación.", variant: "destructive" });
        return;
    }
    
    const newStatus: DigitacionStatus = 'Pendiente de Digitación';
    const caseDocRef = doc(db, 'AforoCases', caseItem.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, { digitacionStatus: newStatus });
        
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'digitacionStatus',
            oldValue: caseItem.digitacionStatus || 'N/A',
            newValue: newStatus,
            comment: "Caso aprobado y asignado a digitación.",
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({ title: "Asignado a Digitación", description: `El caso NE ${caseItem.ne} está listo para ser digitado.` });
     } catch(e) {
        console.error(e);
        toast({title: "Error", description: "No se pudo asignar el caso a digitación.", variant: "destructive"});
     }
  };

  const toggleRowExpansion = (caseId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };
  
  const openObservationModal = (caseItem: AforoCase) => setSelectedCaseForObservation(caseItem);
  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openAforadorCommentModal = (caseItem: AforoCase) => setSelectedCaseForAforadorComment(caseItem);
  const openIncidentModal = (caseItem: AforoCase) => setSelectedCaseForIncident(caseItem);
  
  const handleViewWorksheet = async (caseItem: AforoCase) => {
    if (!caseItem.worksheetId) {
        toast({ title: "Error", description: "Este caso no tiene una hoja de trabajo asociada.", variant: "destructive" });
        return;
    }
    const worksheetDocRef = doc(db, 'worksheets', caseItem.worksheetId);
    const docSnap = await getDoc(worksheetDocRef);
    if (docSnap.exists()) {
        setSelectedWorksheet(docSnap.data() as Worksheet);
    } else {
        toast({ title: "Error", description: "No se pudo encontrar la hoja de trabajo.", variant: "destructive" });
    }
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
  }

  const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) {
        case 'Listo para revisión': return 'default';
        case 'Incompleto': return 'destructive';
        case 'En proceso': return 'secondary';
        case 'Pendiente por completar': return 'destructive';
        default: return 'outline';
    }
  }
  
  const getIncidentStatusBadgeVariant = (status?: IncidentStatus) => {
    switch(status) {
        case 'Aprobada': return 'default';
        case 'Rechazada': return 'destructive';
        case 'Pendiente': return 'secondary';
        default: return 'outline';
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros...</p>
      </div>
    );
  }
  
  if (selectedIncidentForDetails) {
    return (
      <div className="py-2 md:py-5">
          <IncidentReportDetails
            caseData={selectedIncidentForDetails}
            onClose={() => setSelectedIncidentForDetails(null)}
          />
        </div>
    );
  }

  if (selectedWorksheet) {
    return <WorksheetDetails worksheet={selectedWorksheet} onClose={() => setSelectedWorksheet(null)} />
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No se encontraron casos</h3>
        <p className="mt-1 text-muted-foreground">Intente ajustar los filtros de búsqueda o cree un nuevo registro.</p>
      </div>
    );
  }
  
  const canEditFields = user?.role === 'admin' || user?.role === 'coordinadora' || user?.roleTitle === 'supervisor';
  
  return (
    <>
    <TooltipProvider>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead className="text-center">Acciones</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Aforador</TableHead>
            <TableHead>Fecha Asignación</TableHead>
            <TableHead>Estatus Aforador</TableHead>
            <TableHead>Revisor Asignado</TableHead>
            <TableHead>Estatus Revisor</TableHead>
            <TableHead>Estatus Incidencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => {
            const isExpanded = expandedRows.has(caseItem.id);
            const rowClass = cn(
              savingState[caseItem.id] ? "bg-amber-100" : "",
              caseItem.incidentStatus === 'Pendiente' ? "bg-gray-200" : "",
              caseItem.aforadorStatus === 'Pendiente por completar' ? "bg-red-50 hover:bg-red-100/60" : ""
            );
            
            const canEditThisRow = canEditFields || (user?.role === 'aforador' && user?.displayName === caseItem.aforador);
            const canExpandRow = user?.role === 'aforador' || canEditFields;

            return (
            <React.Fragment key={caseItem.id}>
            <TableRow className={rowClass}>
              <TableCell>
                  {canExpandRow && (
                    <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(caseItem.id)} className="h-8 w-8">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  )}
              </TableCell>
               <TableCell className="text-center">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {caseItem.worksheetId && (
                             <DropdownMenuItem onSelect={() => handleViewWorksheet(caseItem)}>
                                <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => openObservationModal(caseItem)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver/Editar Observación
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}>
                            <History className="mr-2 h-4 w-4" /> Ver Bitácora
                        </DropdownMenuItem>
                        { (canEditThisRow) && (
                            <DropdownMenuItem onSelect={() => openIncidentModal(caseItem)}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia
                            </DropdownMenuItem>
                        )}
                        {caseItem.incidentReported && (
                            <DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(caseItem)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver Incidencia
                            </DropdownMenuItem>
                        )}
                        { (user?.role === 'aforador' || user?.role === 'admin') && caseItem.revisorStatus === 'Rechazado' && (
                           <DropdownMenuItem onSelect={() => handleRequestRevalidation(caseItem)}>
                               <Repeat className="mr-2 h-4 w-4" /> Solicitar Revalidación
                           </DropdownMenuItem>
                        )}
                         { (user?.role === 'admin' || user?.role === 'coordinadora' || user?.roleTitle === 'supervisor') && caseItem.revisorStatus === 'Aprobado' && (
                           <DropdownMenuItem onSelect={() => handleAssignToDigitization(caseItem)}>
                               <Send className="mr-2 h-4 w-4" /> Asignar a Digitación
                           </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </TableCell>
              <TableCell>{caseItem.executive}</TableCell>
              <TableCell className="font-medium">{caseItem.ne}</TableCell>
              <TableCell>{caseItem.consignee}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {caseItem.aforador || 'Sin asignar'}
                </div>
              </TableCell>
              <TableCell>
                {formatDate(caseItem.assignmentDate)}
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-1">
                    <Select
                        value={caseItem.aforadorStatus ?? ''}
                        onValueChange={(value: AforadorStatus) => handleAutoSave(caseItem.id, 'aforadorStatus', value)}
                        disabled={!canEditThisRow}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente por completar">Pendiente por completar</SelectItem>
                            <SelectItem value="En proceso">En proceso</SelectItem>
                            <SelectItem value="Incompleto">Incompleto</SelectItem>
                            <SelectItem value="Listo para revisión">Listo para revisión</SelectItem>
                        </SelectContent>
                    </Select>
                    {(caseItem.aforadorStatus === 'Incompleto') && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAforadorCommentModal(caseItem)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ver/Editar motivo</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                 </div>
              </TableCell>
               <TableCell>
                 <div className="flex items-center gap-2">
                   <UserCheck className="h-4 w-4 text-muted-foreground" />
                   {caseItem.revisorAsignado || 'Sin asignar'}
                 </div>
              </TableCell>
               <TableCell>
                  <Badge variant={getRevisorStatusBadgeVariant(caseItem.revisorStatus)}>
                    {caseItem.revisorStatus || 'Pendiente'}
                  </Badge>
              </TableCell>
              <TableCell>
                  {caseItem.incidentReported && (
                     <Badge variant={getIncidentStatusBadgeVariant(caseItem.incidentStatus)}>
                        {caseItem.incidentStatus || 'N/A'}
                     </Badge>
                  )}
              </TableCell>
            </TableRow>
             {isExpanded && canExpandRow && (
                <TableRow className="bg-muted/30 hover:bg-muted/40">
                  <TableCell colSpan={11} className="p-0">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Patrón de la Dec.</label>
                        <Input 
                          defaultValue={caseItem.declarationPattern} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'declarationPattern', e.target.value)}
                          disabled={!canEditThisRow}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Mercancía</label>
                        <Input 
                          defaultValue={caseItem.merchandise} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'merchandise', e.target.value)}
                          disabled={!canEditThisRow}
                        />
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Asignar Aforador</label>
                         <Select
                            value={caseItem.aforador ?? ''}
                            onValueChange={(value) => handleAssignAforador(caseItem.id, value)}
                            disabled={!canEditFields}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar usuario..." />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableUsers.map(u => (
                                <SelectItem key={u.uid} value={u.displayName ?? u.email ?? ''}>
                                  {u.displayName ?? u.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Asignar Revisor</label>
                         <Select
                            value={caseItem.revisorAsignado ?? ''}
                            onValueChange={(value) => handleAutoSave(caseItem.id, 'revisorAsignado', value)}
                            disabled={!canEditFields}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar agente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableUsers.filter(u => u.roleTitle === 'agente aduanero').map(agente => (
                                <SelectItem key={agente.uid} value={agente.displayName ?? agente.email ?? ''}>
                                  {agente.displayName ?? agente.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Total Posiciones</label>
                        <Input 
                          type="number"
                          defaultValue={caseItem.totalPosiciones} 
                          onBlur={(e) => handleAutoSave(caseItem.id, 'totalPosiciones', e.target.valueAsNumber)}
                           disabled={!canEditThisRow}
                        />
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Entregado a Aforo</label>
                         <DatePickerWithTime
                            date={(caseItem.entregadoAforoAt as Timestamp)?.toDate()}
                            onDateChange={() => {}} // This is now read-only
                            disabled={true}
                         />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
             )}
            </React.Fragment>
            )})}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
    {selectedCaseForObservation && (
        <ObservationModal
            isOpen={!!selectedCaseForObservation}
            onClose={() => setSelectedCaseForObservation(null)}
            caseData={selectedCaseForObservation}
        />
    )}
    {selectedCaseForHistory && (
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
    {selectedCaseForAforadorComment && (
        <AforadorCommentModal
            isOpen={!!selectedCaseForAforadorComment}
            onClose={() => setSelectedCaseForAforadorComment(null)}
            caseData={selectedCaseForAforadorComment}
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
