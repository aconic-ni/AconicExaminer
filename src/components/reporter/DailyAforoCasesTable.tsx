
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, AforoCaseUpdate, AppUser, AforadorStatus, Worksheet, DigitacionStatus, IncidentStatus, PreliquidationStatus, LastUpdateInfo, WorksheetWithCase, SolicitudRecord } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, Eye, History, Repeat, PlusSquare, Edit, BookOpen, ChevronDown, ChevronRight, User, UserCheck, Send, AlertTriangle, CheckSquare, ChevronsUpDown, Check, Info, Users, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, endOfDay } from 'date-fns';
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
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { tiposDeclaracion } from '@/lib/formData';
import { AssignUserModal } from './AssignUserModal';
import { InvolvedUsersModal } from './InvolvedUsersModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileAforoCard } from './MobileAforoCard';
import { StatusBadges } from '../executive/StatusBadges';
import { useRouter } from 'next/navigation';

interface DailyAforoCasesTableProps {
    filters: {
        ne?: string;
        consignee?: string;
        dateRange?: DateRange;
        dateFilterType: 'range' | 'month' | 'today';
        showPendingOnly?: boolean;
    };
    setAllFetchedCases: (cases: WorksheetWithCase[]) => void;
    displayCases: WorksheetWithCase[];
}

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
  if (!date) return 'N/A';
  const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
  const formatString = includeTime ? "dd/MM/yy HH:mm" : "dd/MM/yy";
  return format(d, formatString, { locale: es });
};

const LastUpdateTooltip = ({ lastUpdate, caseCreation }: { lastUpdate?: LastUpdateInfo | null, caseCreation: Timestamp }) => {
  if (!lastUpdate || !lastUpdate.at) return null;

  const isInitialEntry = lastUpdate.at.isEqual(caseCreation);
  const label = isInitialEntry ? "Registro realizado por" : "Modificado por";

  return (
      <Tooltip>
          <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground ml-2 cursor-pointer"/>
          </TooltipTrigger>
          <TooltipContent>
              <p>{label}: {lastUpdate.by}</p>
              <p>Fecha: {formatDate(lastUpdate.at)}</p>
          </TooltipContent>
      </Tooltip>
  );
};


export function DailyAforoCasesTable({ filters, setAllFetchedCases, displayCases }: DailyAforoCasesTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();
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
  const [assignmentModal, setAssignmentModal] = useState<{ isOpen: boolean; case: AforoCase | null; type: 'aforador' | 'revisor' }>({ isOpen: false, case: null, type: 'aforador' });
  const [involvedUsersModal, setInvolvedUsersModal] = useState<{ isOpen: boolean; caseData: AforoCase | null }>({ isOpen: false, caseData: null });


  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate: boolean = false) => {
    if (!user || !user.displayName) {
        toast({ title: "No autenticado", description: "Debe iniciar sesión para guardar cambios." });
        return;
    }

    const originalCase = displayCases.find(c => c.id === caseId);
    if (!originalCase) return;

    const oldValue = originalCase[field as keyof AforoCase];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
        return;
    }
    
    setSavingState(prev => ({ ...prev, [caseId]: true }));
    
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const updateData: { [key: string]: any } = { [field]: value };
        const now = Timestamp.now();
        const userInfo = { by: user.displayName, at: now };

        const statusFieldMap: {[key: string]: keyof AforoCase} = {
            'aforadorStatus': 'aforadorStatusLastUpdate',
            'revisorStatus': 'revisorStatusLastUpdate',
            'digitacionStatus': 'digitacionStatusLastUpdate',
            'preliquidationStatus': 'preliquidationStatusLastUpdate',
            'incidentStatus': 'incidentStatusLastUpdate',
            'revisorAsignado': 'revisorAsignadoLastUpdate',
            'digitadorAsignado': 'digitadorAsignadoLastUpdate',
            'aforador': 'aforadorStatusLastUpdate',
        };

        if(statusFieldMap[field]) {
            updateData[statusFieldMap[field]] = userInfo;
        }

        batch.update(caseDocRef, updateData);

        const updateLog: AforoCaseUpdate = {
            updatedAt: now,
            updatedBy: user.displayName,
            field: field as keyof AforoCase,
            oldValue: oldValue ?? null,
            newValue: value,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);

        await batch.commit();
        if(!isTriggerFromFieldUpdate) {
            toast({ title: "Guardado Automático", description: `El campo se ha actualizado.` });
        }
    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, displayCases, toast]);
  
  const handleValidatePattern = useCallback(async (caseId: string) => {
    if (!user || !user.displayName) return;

    setSavingState(prev => ({ ...prev, [caseId]: true }));
    const caseDocRef = doc(db, 'AforoCases', caseId);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    
    try {
      const batch = writeBatch(db);
      
      batch.update(caseDocRef, { isPatternValidated: true });

      const validationLog: AforoCaseUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.displayName,
        field: 'isPatternValidated',
        oldValue: false,
        newValue: true,
        comment: `${user.displayName} validó el patrón de declaración.`
      };
      batch.set(doc(updatesSubcollectionRef), validationLog);

      await batch.commit();

      toast({
        title: "Patrón Validado",
        description: "Ahora puede asignar un aforador."
      });
    } catch (error) {
      console.error("Error validating pattern:", error);
      toast({ title: "Error", description: "No se pudo validar el patrón.", variant: "destructive" });
    } finally {
       setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, toast]);

  const handleAssignUser = useCallback((caseId: string, userName: string, type: 'aforador' | 'revisor') => {
      const field = type === 'aforador' ? 'aforador' : 'revisorAsignado';
      handleAutoSave(caseId, field, userName);
      if (type === 'aforador') {
        handleAutoSave(caseId, 'assignmentDate', Timestamp.now());
      }
  }, [handleAutoSave]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
  
    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'ejecutivo', 'coordinadora', 'supervisor'];
        const agentRoleTitle = 'agente aduanero';

        const roleQueries = rolesToFetch.map(role => query(collection(db, 'users'), where('role', '==', role)));
        roleQueries.push(query(collection(db, 'users'), where('roleTitle', '==', agentRoleTitle)));
        
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
    
    let q;
    const isPsmtSupervisor = user.role === 'supervisor' && user.roleTitle === 'PSMT';
    
    if (isPsmtSupervisor) {
      q = query(collection(db, "AforoCases"), where('consignee', '==', 'PSMT NICARAGUA, SOCIEDAD ANONIMA'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, "AforoCases"), orderBy('createdAt', 'desc'));
    }
    
    const unsubscribe = onSnapshot(q, async (aforoSnapshot) => {
        const aforoCasesData = aforoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
        
        // Fetch all related data in one go and create maps for efficient lookup
        const [worksheetsSnap, examenesSnap, solicitudesSnap, memorandumSnap] = await Promise.all([
            getDocs(collection(db, 'worksheets')),
            getDocs(collection(db, 'examenesPrevios')),
            getDocs(collection(db, "SolicitudCheques")),
            getDocs(collection(db, "Memorandum")),
        ]);

        const worksheetsMap = new Map(worksheetsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Worksheet]));
        const examenesMap = new Map(examenesSnap.docs.map(doc => [doc.id, doc.data() as any]));
        
        const allSolicitudes = new Map<string, SolicitudRecord[]>();
        [...solicitudesSnap.docs, ...memorandumSnap.docs].forEach(doc => {
            const data = doc.data() as SolicitudRecord;
            if(data.examNe) {
                const ne = data.examNe;
                if (!allSolicitudes.has(ne)) {
                    allSolicitudes.set(ne, []);
                }
                allSolicitudes.get(ne)!.push({ solicitudId: doc.id, ...data });
            }
        });

        const combinedData = aforoCasesData.map(caseItem => ({
            ...caseItem,
            worksheet: worksheetsMap.get(caseItem.worksheetId || '') || null,
            examenPrevio: examenesMap.get(caseItem.id) || null,
            pagos: allSolicitudes.get(caseItem.ne) || []
        }));

        let filtered = combinedData;
        if (filters.ne) {
          filtered = filtered.filter(c => c.ne.toUpperCase().includes(filters.ne!.toUpperCase()));
        }
        if (filters.consignee) {
          filtered = filtered.filter(c => c.consignee.toLowerCase().includes(filters.consignee!.toLowerCase()));
        }
        if (filters.dateRange?.from) {
          const start = filters.dateRange.from;
          const end = endOfDay(filters.dateRange.to || filters.dateRange.from);
          filtered = filtered.filter(c => {
            const caseDate = (c.createdAt as Timestamp)?.toDate();
            return caseDate && caseDate >= start && caseDate <= end;
          });
        }
      
        setAllFetchedCases(filtered);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching cases:", error);
        toast({ title: "Error de Carga", description: "No se pudieron cargar los casos. Verifique los índices de Firestore.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, filters, setAllFetchedCases, toast]);
  
  const handleRequestRevalidation = async (caseItem: AforoCase) => {
     if (!user || !user.displayName) return;
     
     const newStatus: AforoCaseStatus = 'Revalidación Solicitada';
     const caseDocRef = doc(db, 'AforoCases', caseItem.id);
     const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

     try {
        await updateDoc(caseDocRef, { 
            revisorStatus: newStatus,
            revisorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        
        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'status_change',
            oldValue: caseItem.revisorStatus || 'Pendiente',
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
        toast({ title: "Acción no permitida", description: "El caso debe estar aprobado por el revisor.", variant: "destructive" });
        return;
    }
     if (caseItem.preliquidationStatus !== 'Aprobada') {
        toast({ title: "Acción no permitida", description: "La preliquidación debe estar aprobada por el ejecutivo.", variant: "destructive" });
        return;
    }
    
    const newStatus: DigitacionStatus = 'Pendiente de Digitación';
    const caseDocRef = doc(db, 'AforoCases', caseItem.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, { 
            digitacionStatus: newStatus,
            digitacionStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        
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

  const handleSearchPrevio = (ne: string) => {
    router.push(`/database?ne=${ne}`);
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

  const collapseAllRows = () => {
    setExpandedRows(new Set());
  };


  const openObservationModal = (caseItem: AforoCase) => setSelectedCaseForObservation(caseItem);
  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openAforadorCommentModal = (caseItem: AforoCase) => setSelectedCaseForAforadorComment(caseItem);
  const openIncidentModal = (caseItem: AforoCase) => setSelectedCaseForIncident(caseItem);
  const openAssignmentModal = (caseItem: AforoCase, type: 'aforador' | 'revisor') => setAssignmentModal({ isOpen: true, case: caseItem, type });
  
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
        case 'En revisión': return 'default';
        case 'Incompleto': return 'destructive';
        case 'En proceso': return 'secondary';
        case 'Pendiente': return 'destructive';
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
  
  const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
  };
  
  const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') {
      return <Badge variant="default" className="bg-green-600">{declaracion || 'Trámite Completo'}</Badge>
    }
    if (status) {
      return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>
    }
    return <Badge variant="outline">Pendiente</Badge>;
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

  if (displayCases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No se encontraron casos</h3>
        <p className="mt-1 text-muted-foreground">Intente ajustar los filtros de búsqueda o cree un nuevo registro.</p>
      </div>
    );
  }
  
  const canEditFields = user?.role === 'admin' || user?.role === 'coordinadora' || user?.role === 'supervisor';
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        {displayCases.map(caseItem => (
          <MobileAforoCard 
            key={caseItem.id} 
            caseItem={caseItem} 
            savingState={savingState}
            canEditFields={canEditFields}
            handleAutoSave={handleAutoSave}
            handleValidatePattern={handleValidatePattern}
            openAssignmentModal={openAssignmentModal}
            openHistoryModal={openHistoryModal}
            openIncidentModal={openIncidentModal}
            openAforadorCommentModal={openAforadorCommentModal}
            openObservationModal={openObservationModal}
            handleRequestRevalidation={handleRequestRevalidation}
            handleAssignToDigitization={handleAssignToDigitization}
            handleViewWorksheet={handleViewWorksheet}
            setSelectedIncidentForDetails={setSelectedIncidentForDetails}
          />
        ))}
      </div>
    )
  }

  return (
    <>
    <TooltipProvider>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Button variant="ghost" size="icon" onClick={collapseAllRows} className="h-8 w-8">
                  <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Acciones</TableHead>
            <TableHead>NE</TableHead>
            <TableHead>Insignias</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Aforador</TableHead>
            <TableHead>Fecha Asignación</TableHead>
            <TableHead>Estatus Aforador</TableHead>
            <TableHead>Revisor Asignado</TableHead>
            <TableHead>Estatus Revisor</TableHead>
            <TableHead>Estatus Ejecutivo</TableHead>
            <TableHead>Estatus Digitador</TableHead>
            <TableHead>Estatus Incidencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayCases.map((caseItem) => {
            const isExpanded = expandedRows.has(caseItem.id);
            const rowClass = cn(
              savingState[caseItem.id] && "bg-amber-100",
              caseItem.incidentReported && "bg-red-200 hover:bg-red-200/80",
              !caseItem.incidentReported && caseItem.aforadorStatus === 'Pendiente ' && "bg-red-50 hover:bg-red-100/60"
            );
            
            const canEditThisRow = canEditFields || (user?.role === 'aforador' && user?.displayName === caseItem.aforador);
            const canExpandRow = user?.role === 'aforador' || canEditFields;
            const isPatternValidated = caseItem.isPatternValidated === true;
            const allowPatternEdit = caseItem.revisorStatus === 'Rechazado';

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
               <TableCell>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <PlusSquare className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {caseItem.worksheetId && (
                             <DropdownMenuItem onSelect={() => handleViewWorksheet(caseItem)}>
                                <BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => handleSearchPrevio(caseItem.ne)}>
                            <Search className="mr-2 h-4 w-4" /> Buscar Previo
                        </DropdownMenuItem>
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
                         { (canEditFields) && caseItem.revisorStatus === 'Aprobado' && (
                           <DropdownMenuItem onSelect={() => handleAssignToDigitization(caseItem)} disabled={caseItem.preliquidationStatus !== 'Aprobada'}>
                               <Send className="mr-2 h-4 w-4" /> Asignar a Digitación
                           </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                    <span className="font-medium">{caseItem.ne}</span>
                    {caseItem.incidentReported && canEditFields && (
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => setInvolvedUsersModal({ isOpen: true, caseData: caseItem })}>
                                    <Users className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Asignar Involucrados</p></TooltipContent>
                        </Tooltip>
                    )}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadges caseData={caseItem} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                    <span>{caseItem.executive}</span>
                       <LastUpdateTooltip lastUpdate={{by: caseItem.executive, at: caseItem.createdAt}} caseCreation={caseItem.createdAt} />
                  </div>
              </TableCell>
              <TableCell>{caseItem.consignee}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{caseItem.aforador || 'Sin asignar'}</span>
                  <LastUpdateTooltip lastUpdate={caseItem.aforadorStatusLastUpdate} caseCreation={caseItem.createdAt} />
                </div>
              </TableCell>
              <TableCell>
                {formatDate(caseItem.assignmentDate)}
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                                value={caseItem.aforadorStatus ?? ''}
                                onValueChange={(value: AforadorStatus) => handleAutoSave(caseItem.id, 'aforadorStatus', value)}
                                disabled={!canEditThisRow || !caseItem.aforador}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Seleccionar estado..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pendiente ">Pendiente </SelectItem>
                                    <SelectItem value="En proceso">En proceso</SelectItem>
                                    <SelectItem value="Incompleto">Incompleto</SelectItem>
                                    <SelectItem value="En revisión">En revisión</SelectItem>
                                </SelectContent>
                            </Select>
                           </div>
                          </TooltipTrigger>
                          {!caseItem.aforador &&
                              <TooltipContent>
                                  <p>Debe asignar un aforador primero.</p>
                              </TooltipContent>
                          }
                      </Tooltip>
                    </TooltipProvider>
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
                    <LastUpdateTooltip lastUpdate={caseItem.aforadorStatusLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                 <div className="flex items-center gap-2">
                   <span>{caseItem.revisorAsignado || 'Sin asignar'}</span>
                   <LastUpdateTooltip lastUpdate={caseItem.revisorAsignadoLastUpdate} caseCreation={caseItem.createdAt} />
                 </div>
              </TableCell>
               <TableCell>
                    <div className="flex items-center">
                        <Badge variant={getRevisorStatusBadgeVariant(caseItem.revisorStatus)}>{caseItem.revisorStatus || 'Pendiente'}</Badge>
                        <LastUpdateTooltip lastUpdate={caseItem.revisorStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                    </div>
              </TableCell>
              <TableCell>
                  <div className="flex items-center">
                    {getPreliquidationStatusBadge(caseItem.preliquidationStatus)}
                    <LastUpdateTooltip lastUpdate={caseItem.preliquidationStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                  </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  {getDigitacionBadge(caseItem.digitacionStatus, caseItem.declaracionAduanera)}
                  <LastUpdateTooltip lastUpdate={caseItem.digitacionStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                </div>
              </TableCell>
              <TableCell>
                  {caseItem.incidentReported && (
                    <div className="flex items-center">
                        <Badge variant={getIncidentStatusBadgeVariant(caseItem.incidentStatus)}>{caseItem.incidentStatus || 'N/A'}</Badge>
                        <LastUpdateTooltip lastUpdate={caseItem.incidentStatusLastUpdate} caseCreation={caseItem.createdAt}/>
                    </div>
                  )}
              </TableCell>
            </TableRow>
             {isExpanded && canExpandRow && (
                <TableRow className="bg-muted/30 hover:bg-muted/40">
                  <TableCell colSpan={14} className="p-0">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-end gap-2">
                          <div className="flex-grow">
                              <label className="text-xs font-medium text-muted-foreground">Modelo (Patrón)</label>
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn("w-full justify-between", !caseItem.declarationPattern && "text-muted-foreground")}
                                      disabled={!canEditThisRow || (isPatternValidated && !allowPatternEdit)}
                                      >
                                      {caseItem.declarationPattern
                                          ? tiposDeclaracion.find(
                                              (tipo) => tipo.value === caseItem.declarationPattern
                                          )?.value
                                          : "Seleccionar..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                      <Command>
                                          <CommandInput placeholder="Buscar por código..." />
                                          <CommandList>
                                              <CommandEmpty>No se encontró el modelo.</CommandEmpty>
                                              <CommandGroup>
                                                  {tiposDeclaracion.map((tipo) => (
                                                  <CommandItem
                                                      value={tipo.value}
                                                      key={tipo.value}
                                                      onSelect={() => {
                                                          handleAutoSave(caseItem.id, 'declarationPattern', tipo.value, true);
                                                          (document.activeElement as HTMLElement)?.blur();
                                                      }}
                                                  >
                                                      <Check className={cn("mr-2 h-4 w-4", tipo.value === caseItem.declarationPattern ? "opacity-100" : "opacity-0")} />
                                                      <div className="flex flex-col">
                                                        <span className="font-bold">{tipo.value}</span>
                                                        <span className="text-xs text-muted-foreground">{tipo.label}</span>
                                                      </div>
                                                  </CommandItem>
                                                  ))}
                                              </CommandGroup>
                                          </CommandList>
                                      </Command>
                                  </PopoverContent>
                              </Popover>
                          </div>
                          <Button 
                            onClick={() => handleValidatePattern(caseItem.id)}
                            disabled={!caseItem.declarationPattern || (isPatternValidated && !allowPatternEdit) || savingState[caseItem.id]}
                          >
                            <CheckSquare className="mr-2 h-4 w-4" /> Validar
                          </Button>
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
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <div className="w-full">
                                  <Button
                                      variant="outline"
                                      onClick={() => openAssignmentModal(caseItem, 'aforador')}
                                      disabled={!canEditFields || !isPatternValidated}
                                      className="w-full justify-between"
                                  >
                                      {caseItem.aforador || "Asignar..."}
                                      <User className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                  </Button>
                               </div>
                           </TooltipTrigger>
                           {!isPatternValidated &&
                            <TooltipContent>
                                <p>Debe validar el Modelo (Patrón) antes de asignar un aforador.</p>
                            </TooltipContent>
                           }
                        </Tooltip>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Asignar Revisor</label>
                        <Tooltip>
                           <TooltipTrigger asChild>
                               <div className="w-full">
                                <Button
                                    variant="outline"
                                    onClick={() => openAssignmentModal(caseItem, 'revisor')}
                                    disabled={!canEditFields || !caseItem.totalPosiciones}
                                    className="w-full justify-between"
                                >
                                    {caseItem.revisorAsignado || "Asignar..."}
                                    <UserCheck className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                </Button>
                                </div>
                           </TooltipTrigger>
                           {!caseItem.totalPosiciones &&
                                <TooltipContent>
                                    <p>Debe ingresar el Total de Posiciones para poder asignar un revisor.</p>
                                </TooltipContent>
                           }
                        </Tooltip>
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
    {assignmentModal.isOpen && assignmentModal.case && (
        <AssignUserModal
            isOpen={assignmentModal.isOpen}
            onClose={() => setAssignmentModal({ isOpen: false, case: null, type: 'aforador' })}
            caseData={assignmentModal.case}
            assignableUsers={
                assignmentModal.type === 'aforador'
                    ? assignableUsers.filter(u => u.role === 'aforador')
                    : assignableUsers.filter(u => u.roleTitle === 'agente aduanero')
            }
            onAssign={(caseId, userName) => handleAssignUser(caseId, userName, assignmentModal.type)}
            title={`Asignar ${assignmentModal.type === 'aforador' ? 'Aforador' : 'Revisor'}`}
            description={`Seleccione un usuario para asignar al caso NE: ${assignmentModal.case.ne}`}
        />
    )}
    {involvedUsersModal.isOpen && involvedUsersModal.caseData && (
        <InvolvedUsersModal
            isOpen={involvedUsersModal.isOpen}
            onClose={() => setInvolvedUsersModal({ isOpen: false, caseData: null })}
            caseData={involvedUsersModal.caseData}
            allUsers={assignableUsers}
        />
    )}
    </>
  );
}
