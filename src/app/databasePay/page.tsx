
"use client";
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, Download, Eye, Calendar as CalendarIcon, MessageSquare, Info as InfoIcon, AlertCircle, CheckCircle2, FileText as FileTextIcon, ListCollapse, ArrowLeft, CheckSquare as CheckSquareIcon, MessageSquareText, RotateCw, AlertTriangle, ShieldCheck, Trash2, FileSignature, Briefcase, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp as FirestoreTimestamp, doc, getDoc, orderBy, updateDoc, serverTimestamp, addDoc, getCountFromServer, writeBatch, deleteDoc, type QueryConstraint, setDoc, increment } from 'firebase/firestore';
import type { SolicitudRecord, CommentRecord, ValidacionRecord, DeletionAuditEvent, AppUser, InitialDataContext } from '@/types';
import { downloadExcelFileFromTable } from '@/lib/fileExporterdatabasePay';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import SolicitudDetailView from '@/components/shared/SolicitudDetailView';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileSolicitudCard } from '@/components/databasepay/MobileSolicitudCard';


type SearchType = "dateToday" | "dateSpecific" | "dateRange" | "dateCurrentMonth";

const URGENT_KEYWORDS_LOWER = ["urgente", "urgent", "urge", "apoyo", "apoyar"];


const formatCurrencyFetched = (amount?: number | string | null, currency?: string) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    const num = Number(amount);
    if (isNaN(num) && typeof amount === 'string' && amount.trim() === '') return 'N/A';
    if (isNaN(num)) return String(amount);

    let prefix = '';
    if (currency === 'cordoba') prefix = 'C$';
    else if (currency === 'dolar') prefix = 'US$';
    else if (currency === 'euro') prefix = '€';
    return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const renderSolicitudStatusBadges = (solicitud: SolicitudRecord) => {
  const badges = [];
  if (solicitud.isMemorandum) badges.push(<Badge key="memo" variant="destructive" className="whitespace-nowrap text-xs">Memorandum</Badge>);
  if (solicitud.documentosAdjuntos) badges.push(<Badge key="docs" variant="outline" className="bg-blue-100 text-blue-700 whitespace-nowrap text-xs">Docs Adjuntos</Badge>);
  if (solicitud.soporte) badges.push(<Badge key="soporte" variant="outline" className="bg-amber-100 text-amber-700 whitespace-nowrap text-xs">Soporte</Badge>);
  if (solicitud.impuestosPendientesCliente) badges.push(<Badge key="impuestos" variant="outline" className="bg-red-100 text-red-700 whitespace-nowrap text-xs">Imp. Pendientes</Badge>);
  if (solicitud.constanciasNoRetencion) badges.push(<Badge key="retencion" variant="outline" className="bg-purple-100 text-purple-700 whitespace-nowrap text-xs">Const. No Ret.</Badge>);
  if (solicitud.pagoServicios) badges.push(<Badge key="servicios" variant="outline" className="bg-teal-100 text-teal-700 whitespace-nowrap text-xs">Pago Serv.</Badge>);

  if (badges.length === 0) {
    return <Badge variant="secondary" className="text-xs">Sin Estados</Badge>;
  }
  return <div className="flex flex-wrap gap-1">{badges}</div>;
};


interface SearchResultsTableProps {
  solicitudes: SolicitudRecord[];
  searchType: SearchType;
  searchTerm?: string;
  currentUserRole?: string;
  isMinutaValidationEnabled: boolean;
  onUpdatePaymentStatus: (solicitudId: string, newPaymentStatus: string | null) => Promise<void>;
  onUpdateRecepcionDCStatus: (solicitudId: string, status: boolean) => Promise<void>;
  onUpdateEmailMinutaStatus: (solicitudId: string, status: boolean) => Promise<void>;
  onOpenMessageDialog: (solicitudId: string) => void;
  onOpenMinutaDialog: (solicitudId: string) => void;
  onSaveMinuta: (solicitudId: string, minutaNum?: string | null) => Promise<void>;
  onViewDetails: (solicitud: SolicitudRecord) => void;
  onOpenCommentsDialog: (solicitudId: string) => void;
  onDeleteSolicitud: (solicitudId: string) => void; 
  onRefreshSearch: () => void;
  onFilterByDuplicateSet: (ids: string[]) => void;
  filterRecpDocsInput: string;
  setFilterRecpDocsInput: (value: string) => void;
  filterNotMinutaInput: string;
  setFilterNotMinutaInput: (value: string) => void;
  filterSolicitudIdInput: string;
  setFilterSolicitudIdInput: (value: string) => void;
  filterNEInput: string;
  setFilterNEInput: (value: string) => void;
  filterEstadoPagoInput: string;
  setFilterEstadoPagoInput: (value: string) => void;
  filterFechaSolicitudInput: string;
  setFilterFechaSolicitudInput: (value: string) => void;
  filterMontoInput: string;
  setFilterMontoInput: (value: string) => void;
  filterConsignatarioInput: string;
  setFilterConsignatarioInput: (value: string) => void;
  filterDeclaracionInput: string;
  setFilterDeclaracionInput: (value: string) => void;
  filterReferenciaInput: string;
  setFilterReferenciaInput: (value: string) => void;
  filterGuardadoPorInput: string;
  setFilterGuardadoPorInput: (value: string) => void;
  filterEstadoSolicitudInput: string;
  setFilterEstadoSolicitudInput: (value: string) => void;
  duplicateWarning?: string | null;
  duplicateSets: Map<string, string[]>;
  onResolveDuplicate: (key: string, resolution: "validated_not_duplicate" | "deletion_requested") => void;
  resolvedDuplicateKeys: string[]; 
  permanentlyResolvedDuplicateKeys: string[]; 
  onOpenViewErrorDialog: (errorMessage: string) => void;
}

const SearchResultsTable: React.FC<SearchResultsTableProps> = ({
  solicitudes,
  searchType,
  searchTerm,
  currentUserRole,
  isMinutaValidationEnabled,
  onUpdatePaymentStatus,
  onUpdateRecepcionDCStatus,
  onUpdateEmailMinutaStatus,
  onOpenMessageDialog,
  onOpenMinutaDialog,
  onSaveMinuta,
  onViewDetails,
  onOpenCommentsDialog,
  onDeleteSolicitud, 
  onRefreshSearch,
  onFilterByDuplicateSet,
  filterRecpDocsInput,
  setFilterRecpDocsInput,
  filterNotMinutaInput,
  setFilterNotMinutaInput,
  filterSolicitudIdInput,
  setFilterSolicitudIdInput,
  filterNEInput,
  setFilterNEInput,
  filterEstadoPagoInput,
  setFilterEstadoPagoInput,
  filterFechaSolicitudInput,
  setFilterFechaSolicitudInput,
  filterMontoInput,
  setFilterMontoInput,
  filterConsignatarioInput,
  setFilterConsignatarioInput,
  filterDeclaracionInput,
  setFilterDeclaracionInput,
  filterReferenciaInput,
  setFilterReferenciaInput,
  filterGuardadoPorInput,
  setFilterGuardadoPorInput,
  filterEstadoSolicitudInput,
  setFilterEstadoSolicitudInput,
  duplicateSets,
  onResolveDuplicate,
  resolvedDuplicateKeys,
  permanentlyResolvedDuplicateKeys,
  onOpenViewErrorDialog,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const allDuplicateIdsFromSets = useMemo(() => {
    const ids = new Set<string>();
    duplicateSets.forEach(idArray => idArray.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [duplicateSets]);

  const combinedResolvedKeys = useMemo(() => {
    return new Set([...resolvedDuplicateKeys, ...permanentlyResolvedDuplicateKeys]);
  }, [resolvedDuplicateKeys, permanentlyResolvedDuplicateKeys]);

  if (!solicitudes || solicitudes.length === 0) {
    let message = "No se encontraron solicitudes para los criterios ingresados.";
    if (searchType === "dateToday") message = "No se encontraron solicitudes para hoy."
    else if (searchType === "dateCurrentMonth") message = "No se encontraron solicitudes para el mes actual."
    return <p className="text-muted-foreground text-center py-4">{message}</p>;
  }

  const getTitle = () => {
    if (searchType === "dateToday") return `Solicitudes de Hoy (${format(new Date(), "PPP", { locale: es })})`;
    if (searchType === "dateCurrentMonth") return `Solicitudes del Mes Actual (${format(new Date(), "MMMM yyyy", { locale: es })})`;
    if (searchType === "dateSpecific" && searchTerm) return `Solicitudes del ${searchTerm}`;
    if (searchType === "dateRange" && searchTerm) return `Solicitudes para ${searchTerm}`;
    return "Solicitudes Encontradas";
  };

  const isGuardadoPorFilterDisabled = currentUserRole === 'autorevisor' || currentUserRole === 'autorevisor_plus';
  const canUserValidateDuplicates = currentUserRole === 'calificador' || currentUserRole === 'admin';

  return (
    <Card className="mt-6 w-full custom-shadow">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">{getTitle()}</CardTitle>
        <CardDescription className="text-muted-foreground">Se encontraron {solicitudes.length} solicitud(es) asociadas.</CardDescription>
        {duplicateSets.size > 0 && (
          <div className="mt-4 space-y-3">
            {Array.from(duplicateSets.entries()).map(([key, ids]) => {
              if (combinedResolvedKeys.has(key)) { 
                return null;
              }
              const neFromKey = key.split('-')[0];
              return (
                <div key={key} className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md" role="alert">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                    <p className="font-semibold">Alerta de Duplicado Potencial (NE: {neFromKey})</p>
                  </div>
                  <p>Se encontraron múltiples solicitudes con el mismo NE, Monto y Moneda. IDs: {ids.join(', ')}.</p>
                  <p className="mt-1">Por favor, revise y valide esta situación.</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10 hover:text-primary-darker"
                      onClick={() => onFilterByDuplicateSet(ids)}
                    >
                      <Search className="mr-2 h-4 w-4" /> Ver solo este conjunto
                    </Button>
                    {canUserValidateDuplicates && (
                        <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-green-600 text-green-700 hover:bg-green-100 hover:text-green-800"
                            onClick={() => onResolveDuplicate(key, 'validated_not_duplicate')}
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" /> Validado (No Duplicado)
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-orange-600 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                            onClick={() => onResolveDuplicate(key, 'deletion_requested')}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Solicitar Eliminación
                        </Button>
                        </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto table-container rounded-lg border">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={onRefreshSearch} className="h-6 w-6 p-0 mr-1">
                        <RotateCw className="h-4 w-4 text-primary" />
                    </Button>
                    Acciones
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Estado de Pago
                  <Input
                    type="text"
                    placeholder="Filtrar Estado Pago..."
                    value={filterEstadoPagoInput}
                    onChange={(e) => setFilterEstadoPagoInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  RECP. DOCS
                  <Input
                    type="text"
                    placeholder="Filtrar (Recibido/Pendiente)..."
                    value={filterRecpDocsInput}
                    onChange={(e) => setFilterRecpDocsInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                {/*
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  NOT. MINUTA
                  <Input
                    type="text"
                    placeholder="Filtrar (Notificado/Pendiente)..."
                    value={filterNotMinutaInput}
                    onChange={(e) => setFilterNotMinutaInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                */}
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Estado Solicitud
                  <Input
                    type="text"
                    placeholder="Filtrar Estado Sol..."
                    value={filterEstadoSolicitudInput}
                    onChange={(e) => setFilterEstadoSolicitudInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Consignatario
                  <Input
                    type="text"
                    placeholder="Filtrar Consignatario..."
                    value={filterConsignatarioInput}
                    onChange={(e) => setFilterConsignatarioInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Declaracion
                  <Input
                    type="text"
                    placeholder="Filtrar Declaracion..."
                    value={filterDeclaracionInput}
                    onChange={(e) => setFilterDeclaracionInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Fecha
                  <Input
                    type="text"
                    placeholder="Filtrar Fecha (dd/MM/yy)..."
                    value={filterFechaSolicitudInput}
                    onChange={(e) => setFilterFechaSolicitudInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  NE
                  <Input
                    type="text"
                    placeholder="Filtrar NE..."
                    value={filterNEInput}
                    onChange={(e) => setFilterNEInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Monto
                  <Input
                    type="text"
                    placeholder="Filtrar Monto..."
                    value={filterMontoInput}
                    onChange={(e) => setFilterMontoInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Referencia
                  <Input
                    type="text"
                    placeholder="Filtrar Referencia..."
                    value={filterReferenciaInput}
                    onChange={(e) => setFilterReferenciaInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Guardado Por
                  <Input
                    type="text"
                    placeholder={isGuardadoPorFilterDisabled ? "Filtrado por rol" : "Filtrar Guardado Por..."}
                    value={filterGuardadoPorInput}
                    onChange={(e) => setFilterGuardadoPorInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    disabled={isGuardadoPorFilterDisabled}
                    readOnly={isGuardadoPorFilterDisabled}
                  />
                </TableHead>
                 <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  ID Solicitud
                  <Input
                    type="text"
                    placeholder="Filtrar ID..."
                    value={filterSolicitudIdInput}
                    onChange={(e) => setFilterSolicitudIdInput(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border">
              {solicitudes.map((solicitud) => {
                const isMarkedAsDuplicate = allDuplicateIdsFromSets.includes(solicitud.solicitudId);
                const duplicateKeyForThisRow = `${solicitud.examNe?.trim()}-${solicitud.monto}-${solicitud.montoMoneda?.trim()}`;
                const isResolvedInSession = resolvedDuplicateKeys.includes(duplicateKeyForThisRow);
                const isPermanentlyResolved = permanentlyResolvedDuplicateKeys.includes(duplicateKeyForThisRow);
                const isEffectivelyResolved = isResolvedInSession || isPermanentlyResolved;
                const isUrgent = solicitud.hasOpenUrgentComment;

                let rowClass = 'hover:bg-muted/50 dark:hover:bg-muted/80';
                if (isUrgent) {
                  rowClass = 'bg-red-200 hover:bg-red-300 dark:bg-red-600/40 dark:hover:bg-red-600/50';
                } else if (isMarkedAsDuplicate && !isEffectivelyResolved) {
                  rowClass = 'bg-rose-200 hover:bg-rose-300 dark:bg-rose-500/50 dark:hover:bg-rose-500/60';
                } else if (isMarkedAsDuplicate && isEffectivelyResolved) {
                  rowClass = 'bg-emerald-200 hover:bg-emerald-300 dark:bg-emerald-500/50 dark:hover:bg-emerald-500/60';
                } else if (solicitud.soporte) { 
                  rowClass = 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-700/30 dark:hover:bg-amber-700/40'; 
                }

                return (
                <TableRow
                  key={solicitud.solicitudId}
                  className={cn(rowClass)}
                >
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-1">
                        {currentUserRole === 'admin' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onDeleteSolicitud(solicitud.solicitudId)}
                                  className="px-2 py-1 h-auto text-destructive hover:bg-destructive/10"
                                  aria-label="Eliminar Solicitud"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar Solicitud</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetails(solicitud)}
                                className="px-2 py-1 h-auto"
                                aria-label="Ver Detalles"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ver Detalles</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenCommentsDialog(solicitud.solicitudId)}
                                className="px-2 py-1 h-auto"
                                aria-label="Comentarios"
                              >
                                <MessageSquareText className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Comentarios</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant="secondary" className="h-6 min-w-[1.5rem] flex items-center justify-center px-1.5 py-0.5 text-xs">
                          {solicitud.commentsCount ?? 0}
                        </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                    {currentUserRole === 'calificador' ? (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={solicitud.paymentStatus === 'Pagado'}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (isMinutaValidationEnabled) {
                                onOpenMinutaDialog(solicitud.solicitudId);
                              } else {
                                onSaveMinuta(solicitud.solicitudId, null); 
                              }
                            } else {
                              if (solicitud.paymentStatus === 'Pagado') {
                                onUpdatePaymentStatus(solicitud.solicitudId, null);
                              }
                            }
                          }}
                          disabled={solicitud.isMemorandum}
                          aria-label="Marcar como pagado / pendiente"
                        />
                        <Button variant="ghost" size="icon" onClick={() => onOpenMessageDialog(solicitud.solicitudId)} aria-label="Añadir mensaje de error" className="h-7 w-7 p-0" disabled={solicitud.isMemorandum}>
                          <MessageSquare className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        {solicitud.paymentStatus === 'Pagado' && (
                          <div className="flex items-center space-x-1">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Pagado</Badge>
                            {solicitud.minutaNumber && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                      <FileSignature className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p>Minuta No: {solicitud.minutaNumber}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                        {solicitud.paymentStatus && solicitud.paymentStatus.startsWith('Error:') ? (
                            <Button variant="link" className="p-0 h-auto" onClick={() => onOpenViewErrorDialog(solicitud.paymentStatus!.substring("Error: ".length))}>
                            <Badge variant="destructive" className="cursor-pointer flex items-center">
                                <AlertCircle className="h-3.5 w-3.5 mr-1"/> Error
                            </Badge>
                         </Button>
                        ) : null}
                        {(!solicitud.paymentStatus || (solicitud.paymentStatus && !solicitud.paymentStatus.startsWith('Error:') && solicitud.paymentStatus !== 'Pagado')) && (
                             <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.paymentStatusLastUpdatedAt || solicitud.paymentStatusLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Pago):</p>
                                {solicitud.paymentStatusLastUpdatedBy && <p>Por: {solicitud.paymentStatusLastUpdatedBy}</p>}
                                {solicitud.paymentStatusLastUpdatedAt && solicitud.paymentStatusLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.paymentStatusLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        {solicitud.paymentStatus === 'Pagado' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 flex items-center">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1"/> Pagado
                          </Badge>
                        ) : solicitud.paymentStatus && solicitud.paymentStatus.startsWith('Error:') ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="cursor-help flex items-center">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1"/> Error
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{solicitud.paymentStatus}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                        {solicitud.minutaNumber && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Minuta No: {solicitud.minutaNumber}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {(solicitud.paymentStatusLastUpdatedAt || solicitud.paymentStatusLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Pago):</p>
                                {solicitud.paymentStatusLastUpdatedBy && <p>Por: {solicitud.paymentStatusLastUpdatedBy}</p>}
                                {solicitud.paymentStatusLastUpdatedAt && solicitud.paymentStatusLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.paymentStatusLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                     {currentUserRole === 'calificador' ? (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={!!solicitud.recepcionDCStatus}
                                onCheckedChange={(checked) => {
                                    onUpdateRecepcionDCStatus(solicitud.solicitudId, !!checked);
                                }}
                                aria-label="Marcar como recibido / pendiente de documento"
                            />
                            {solicitud.recepcionDCStatus ? (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center">
                                    <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Recibido
                                </Badge>
                            ) : (
                                <Badge variant="outline">Pendiente</Badge>
                            )}
                            {(solicitud.recepcionDCLastUpdatedAt || solicitud.recepcionDCLastUpdatedBy) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p>Última actualización (Recep. Doc.):</p>
                                    {solicitud.recepcionDCLastUpdatedBy && <p>Por: {solicitud.recepcionDCLastUpdatedBy}</p>}
                                    {solicitud.recepcionDCLastUpdatedAt && solicitud.recepcionDCLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.recepcionDCLastUpdatedAt, "Pp", { locale: es })}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                        </div>
                     ) : (
                        <div className="flex items-center space-x-1">
                        {solicitud.recepcionDCStatus ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center">
                                <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Recibido
                            </Badge>
                        ) : (
                            <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.recepcionDCLastUpdatedAt || solicitud.recepcionDCLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Recep. Doc.):</p>
                                {solicitud.recepcionDCLastUpdatedBy && <p>Por: {solicitud.recepcionDCLastUpdatedBy}</p>}
                                {solicitud.recepcionDCLastUpdatedAt && solicitud.recepcionDCLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.recepcionDCLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        </div>
                     )}
                  </TableCell>
                  {/*
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                    {currentUserRole === 'calificador' ? (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={!!solicitud.emailMinutaStatus}
                          onCheckedChange={(checked) => {
                            onUpdateEmailMinutaStatus(solicitud.solicitudId, !!checked);
                          }}
                          aria-label="Marcar como notificado / pendiente de email minuta"
                        />
                        {solicitud.emailMinutaStatus ? (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center">
                            <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Notificado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.emailMinutaLastUpdatedAt || solicitud.emailMinutaLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Email Minuta):</p>
                                {solicitud.emailMinutaLastUpdatedBy && <p>Por: {solicitud.emailMinutaLastUpdatedBy}</p>}
                                {solicitud.emailMinutaLastUpdatedAt && solicitud.emailMinutaLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.emailMinutaLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1">
                        {solicitud.emailMinutaStatus ? (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center">
                             <CheckSquareIcon className="h-3.5 w-3.5 mr-1"/> Notificado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                        {(solicitud.emailMinutaLastUpdatedAt || solicitud.emailMinutaLastUpdatedBy) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Última actualización (Email Minuta):</p>
                                {solicitud.emailMinutaLastUpdatedBy && <p>Por: {solicitud.emailMinutaLastUpdatedBy}</p>}
                                {solicitud.emailMinutaLastUpdatedAt && solicitud.emailMinutaLastUpdatedAt instanceof Date && <p>Fecha: {format(solicitud.emailMinutaLastUpdatedAt, "Pp", { locale: es })}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </TableCell>
                  */}
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                    {renderSolicitudStatusBadges(solicitud)}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.consignatario && solicitud.consignatario.length > 21 ? (
                        <div className="flex items-center space-x-1">
                        <span>{`${solicitud.consignatario.substring(0, 21)}...`}</span>
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                <InfoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs break-words">
                                <p>{solicitud.consignatario}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        </div>
                    ) : (
                        solicitud.consignatario || 'N/A'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.declaracionNumero || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {solicitud.examDate instanceof Date
                      ? format(solicitud.examDate, "dd/MM/yy", { locale: es })
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.examNe}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{formatCurrencyFetched(solicitud.monto ?? undefined, solicitud.montoMoneda || undefined)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{solicitud.examReference || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                     <div className="flex items-center space-x-1">
                        <span>{solicitud.savedBy || 'N/A'}</span>
                        {solicitud.savedAt && solicitud.savedAt instanceof Date && (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                <InfoIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                                <p>Guardado el:</p>
                                <p>{format(solicitud.savedAt, "Pp", { locale: es })}</p>
                            </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{solicitud.solicitudId}</TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DatabasePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [searchType, setSearchType] = useState<SearchType>("dateToday");
  const [searchTermText, setSearchTermText] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePickerStartDate, setDatePickerStartDate] = useState<Date | undefined>(undefined);
  const [datePickerEndDate, setDatePickerEndDate] = useState<Date | undefined>(undefined);

  const [isSpecificDatePopoverOpen, setIsSpecificDatePopoverOpen] = useState(false);
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedSolicitudes, setFetchedSolicitudes] = useState<SolicitudRecord[] | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [currentSearchTermForDisplay, setCurrentSearchTermForDisplay] = useState('');

  const [duplicateSets, setDuplicateSets] = useState<Map<string, string[]>>(new Map());
  const [resolvedDuplicateKeys, setResolvedDuplicateKeys] = useState<string[]>([]);
  const [permanentlyResolvedDuplicateKeys, setPermanentlyResolvedDuplicateKeys] = useState<string[]>([]);
  const [isLoadingPermanentlyResolvedKeys, setIsLoadingPermanentlyResolvedKeys] = useState(true);
  const [duplicateFilterIds, setDuplicateFilterIds] = useState<string[] | null>(null);


  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [currentSolicitudIdForMessage, setCurrentSolicitudIdForMessage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');

  const [isViewErrorDialogOpen, setIsViewErrorDialogOpen] = useState(false);
  const [errorMessageToView, setErrorMessageToView] = useState('');

  const [isMinutaDialogOpen, setIsMinutaDialogOpen] = useState(false);
  const [currentSolicitudIdForMinuta, setCurrentSolicitudIdForMinuta] = useState<string | null>(null);
  const [minutaNumberInput, setMinutaNumberInput] = useState('');
  const IS_MINUTA_VALIDATION_ENABLED = false; 

  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [currentSolicitudIdForComments, setCurrentSolicitudIdForComments] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isNewCommentUrgent, setIsNewCommentUrgent] = useState(false);


  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [solicitudToDeleteId, setSolicitudToDeleteId] = useState<string | null>(null);


  const [filterSolicitudIdInput, setFilterSolicitudIdInput] = useState('');
  const [filterNEInput, setFilterNEInput] = useState('');
  const [filterEstadoPagoInput, setFilterEstadoPagoInput] = useState('');
  const [filterFechaSolicitudInput, setFilterFechaSolicitudInput] = useState('');
  const [filterMontoInput, setFilterMontoInput] = useState('');
  const [filterConsignatarioInput, setFilterConsignatarioInput] = useState('');
  const [filterDeclaracionInput, setFilterDeclaracionInput] = useState('');
  const [filterReferenciaInput, setFilterReferenciaInput] = useState('');
  const [filterGuardadoPorInput, setFilterGuardadoPorInput] = useState('');
  const [filterEstadoSolicitudInput, setFilterEstadoSolicitudInput] = useState('');
  const [filterRecpDocsInput, setFilterRecpDocsInput] = useState('');
  const [filterNotMinutaInput, setFilterNotMinutaInput] = useState('');


  const [solicitudToView, setSolicitudToView] = useState<SolicitudRecord | null>(null);
  const [isDetailViewVisible, setIsDetailViewVisible] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingRecpDocsCount, setPendingRecpDocsCount] = useState(0);
  const [pendingNotMinutaCount, setPendingNotMinutaCount] = useState(0);
  const [distinctPendingDocsCount, setDistinctPendingDocsCount] = useState(0);


  const fetchPermanentlyResolvedKeys = useCallback(async () => {
    const rolesThatNeedValidations = ['revisor', 'calificador', 'admin'];
    if (!user || !user.role || !rolesThatNeedValidations.includes(user.role)) {
      setIsLoadingPermanentlyResolvedKeys(false);
      return;
    }
    setIsLoadingPermanentlyResolvedKeys(true);
    try {
      const validacionesRef = collection(db, "Validaciones");
      const q = query(validacionesRef); 
      const snapshot = await getDocs(q);
      const keys = snapshot.docs.map(docSnap => docSnap.data().duplicateKey as string);
      setPermanentlyResolvedDuplicateKeys(keys);
    } catch (err) {
      console.error("Error fetching permanently resolved keys:", err);
      toast({ title: "Error", description: "No se pudieron cargar las validaciones previas de duplicados.", variant: "destructive" });
    } finally {
      setIsLoadingPermanentlyResolvedKeys(false);
    }
  }, [user, toast]);

  useEffect(() => {
    setIsClient(true);
    if (!authLoading && user) {
      const isAllowed = user.hasPaymentAccess || user.role === 'admin' || user.role === 'calificador';
      if (!isAllowed) {
        toast({
          title: "Acceso Denegado",
          description: "No tiene permisos para acceder a esta plataforma.",
          variant: "destructive",
          duration: 5000 
        });
        router.push('/');
      } else {
        fetchPermanentlyResolvedKeys();
      }
    }
  }, [authLoading, user, fetchPermanentlyResolvedKeys, router, toast]);


  const handleViewDetails = (solicitud: SolicitudRecord) => {
    setSolicitudToView(solicitud);
    setIsDetailViewVisible(true);
  };

  const handleBackToTable = () => {
    setIsDetailViewVisible(false);
    setSolicitudToView(null);
  };


  const displayedSolicitudes = useMemo(() => {
    if (!fetchedSolicitudes) return null;
    let accumulatedData = [...fetchedSolicitudes];

    const applyFilter = (
        data: SolicitudRecord[],
        filterValue: string,
        filterFn: (item: SolicitudRecord, searchTerm: string) => boolean
    ): SolicitudRecord[] => {
        if (!filterValue.trim()) return data;
        const searchTerm = filterValue.toLowerCase().trim();
        return data.filter(item => filterFn(item, searchTerm));
    };

    accumulatedData = applyFilter(accumulatedData, filterEstadoSolicitudInput, (s, term) => {
        const badgeTexts: string[] = [];
        if (s.isMemorandum) badgeTexts.push("Memorandum");
        if (s.documentosAdjuntos) badgeTexts.push("Docs Adjuntos");
        if (s.soporte) badgeTexts.push("Soporte");
        if (s.impuestosPendientesCliente) badgeTexts.push("Imp. Pendientes");
        if (s.constanciasNoRetencion) badgeTexts.push("Const. No Ret.");
        if (s.pagoServicios) badgeTexts.push("Pago Serv.");
        if (badgeTexts.length === 0) badgeTexts.push("Sin Estados");
        return badgeTexts.some(badgeText => badgeText.toLowerCase().includes(term));
    });

    accumulatedData = applyFilter(accumulatedData, filterEstadoPagoInput, (s, term) =>
        (s.paymentStatus ? s.paymentStatus.toLowerCase() : "pendiente").includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterRecpDocsInput, (s, term) => {
        const statusText = s.recepcionDCStatus ? "recibido" : "pendiente";
        return statusText.includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterNotMinutaInput, (s, term) => {
        const statusText = s.emailMinutaStatus ? "notificado" : "pendiente";
        return statusText.includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterSolicitudIdInput, (s, term) =>
        s.solicitudId.toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterFechaSolicitudInput, (s, term) => {
        const dateText = s.examDate && s.examDate instanceof Date ? format(s.examDate, "dd/MM/yy", { locale: es }) : 'N/A';
        return dateText.toLowerCase().includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterNEInput, (s, term) =>
        (s.examNe || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterMontoInput, (s, term) => {
        const montoText = formatCurrencyFetched(s.monto ?? undefined, s.montoMoneda || undefined);
        return montoText.toLowerCase().includes(term);
    });
    accumulatedData = applyFilter(accumulatedData, filterConsignatarioInput, (s, term) =>
        (s.consignatario || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterDeclaracionInput, (s, term) =>
        (s.declaracionNumero || '').toLowerCase().includes(term)
    );
    accumulatedData = applyFilter(accumulatedData, filterReferenciaInput, (s, term) =>
        (s.examReference || '').toLowerCase().includes(term)
    );

    if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
      accumulatedData = applyFilter(accumulatedData, filterGuardadoPorInput, (s, term) =>
        (s.savedBy || '').toLowerCase().includes(term)
      );
    }

    if (duplicateFilterIds && duplicateFilterIds.length > 0) {
        accumulatedData = accumulatedData.filter(s => duplicateFilterIds.includes(s.solicitudId));
    }

    const hasActiveFilters = 
      filterEstadoSolicitudInput.trim() ||
      filterEstadoPagoInput.trim() ||
      filterRecpDocsInput.trim() ||
      filterNotMinutaInput.trim() ||
      filterSolicitudIdInput.trim() ||
      filterFechaSolicitudInput.trim() ||
      filterNEInput.trim() ||
      filterMontoInput.trim() ||
      filterConsignatarioInput.trim() ||
      filterDeclaracionInput.trim() ||
      filterReferenciaInput.trim() ||
      (filterGuardadoPorInput.trim() && user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') ||
        (duplicateFilterIds && duplicateFilterIds.length > 0);

if (accumulatedData.length === 0 && hasActiveFilters) {
  return fetchedSolicitudes;
}

    return accumulatedData;
  }, [
    fetchedSolicitudes,
    filterEstadoSolicitudInput,
    filterEstadoPagoInput,
    filterRecpDocsInput,
    filterNotMinutaInput,
    filterSolicitudIdInput,
    filterFechaSolicitudInput,
    filterNEInput,
    filterMontoInput,
    filterConsignatarioInput,
    filterDeclaracionInput,
    filterReferenciaInput,
    filterGuardadoPorInput,
    user?.role,
    duplicateFilterIds, 
  ]);

  useEffect(() => {
    if (displayedSolicitudes && (user?.role === 'calificador' || user?.role === 'revisor' || user?.role === 'admin' || (user?.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0))) {
      let paymentPend = 0;
      let recpDocsPend = 0;
      let notMinutaPend = 0;

      displayedSolicitudes.forEach(s => {
        if (!s.isMemorandum && (!s.paymentStatus || (s.paymentStatus && !s.paymentStatus.startsWith('Error:') && s.paymentStatus !== 'Pagado'))) {
          paymentPend++;
        }
        if (!s.recepcionDCStatus) {
          recpDocsPend++;
        }
        if (!s.emailMinutaStatus) {
          notMinutaPend++;
        }
      });
      setPendingPaymentCount(paymentPend);
      setPendingRecpDocsCount(recpDocsPend);
      setPendingNotMinutaCount(notMinutaPend);

      const distinctPend = displayedSolicitudes.filter(s =>
          (!s.isMemorandum && (!s.paymentStatus || (s.paymentStatus && !s.paymentStatus.startsWith('Error:') && s.paymentStatus !== 'Pagado'))) ||
          !s.recepcionDCStatus ||
          !s.emailMinutaStatus
      ).length;
      setDistinctPendingDocsCount(distinctPend);

    } else {
      setPendingPaymentCount(0);
      setPendingRecpDocsCount(0);
      setPendingNotMinutaCount(0);
      setDistinctPendingDocsCount(0);
    }
  }, [displayedSolicitudes, user?.role, user?.canReviewUserEmails]);


  const handleUpdatePaymentStatus = useCallback(async (solicitudId: string, newPaymentStatus: string | null) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
      const batch = writeBatch(db);
      const updates: Record<string, any> = {
        paymentStatus: newPaymentStatus,
        paymentStatusLastUpdatedAt: serverTimestamp(),
        paymentStatusLastUpdatedBy: user.email,
      };

      if (newPaymentStatus === 'Pagado') {
        updates.hasOpenUrgentComment = false; 
        updates.emailMinutaStatus = true; 
        updates.emailMinutaLastUpdatedAt = serverTimestamp();
        updates.emailMinutaLastUpdatedBy = user.email;
      } else if (newPaymentStatus === null) {
        updates.minutaNumber = null;
      }

      batch.update(docRef, updates);
      await batch.commit();

      toast({ title: "Éxito", description: `Estado de pago${newPaymentStatus === 'Pagado' ? ' y minuta' : ''} actualizado para ${solicitudId}.` });

      setFetchedSolicitudes(prev =>
        prev?.map(s => {
          if (s.solicitudId === solicitudId) {
            const updatedSol: SolicitudRecord = {
              ...s,
              paymentStatus: newPaymentStatus === null ? null : newPaymentStatus,
              paymentStatusLastUpdatedAt: new Date(),
              paymentStatusLastUpdatedBy: user.email!,
            };
            if (newPaymentStatus === 'Pagado') {
              updatedSol.hasOpenUrgentComment = false;
              updatedSol.emailMinutaStatus = true;
              updatedSol.emailMinutaLastUpdatedAt = new Date();
              updatedSol.emailMinutaLastUpdatedBy = user.email!;
            } else if (newPaymentStatus === null) {
              updatedSol.minutaNumber = null;
            }
            return updatedSol;
          }
          return s;
        }) || null
      );
    } catch (err) {
      console.error("Error updating payment status: ", err);
      toast({ title: "Error", description: "No se pudo actualizar el estado de pago.", variant: "destructive" });
    }
  }, [user, toast]);


  const handleUpdateRecepcionDCStatus = useCallback(async (solicitudId: string, status: boolean) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
      await updateDoc(docRef, {
        recepcionDCStatus: status,
        recepcionDCLastUpdatedAt: serverTimestamp(),
        recepcionDCLastUpdatedBy: user.email,
      });
      toast({ title: "Éxito", description: `Estado de recepción de documento actualizado para ${solicitudId}.` });
      setFetchedSolicitudes(prev =>
        prev?.map(s =>
          s.solicitudId === solicitudId
            ? { ...s,
                recepcionDCStatus: status,
                recepcionDCLastUpdatedAt: new Date(),
                recepcionDCLastUpdatedBy: user.email!
              }
            : s
        ) || null
      );
    } catch (err) {
      console.error("Error updating recepcion DC status: ", err);
      toast({ title: "Error", description: "No se pudo actualizar el estado de recepción de documento.", variant: "destructive" });
    }
  }, [user, toast]);

  const handleUpdateEmailMinutaStatus = useCallback(async (solicitudId: string, status: boolean) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    const docRef = doc(db, "SolicitudCheques", solicitudId);
    try {
      await updateDoc(docRef, {
        emailMinutaStatus: status,
        emailMinutaLastUpdatedAt: serverTimestamp(),
        emailMinutaLastUpdatedBy: user.email,
      });
      toast({ title: "Éxito", description: `Estado de Email Minuta actualizado para ${solicitudId}.` });
      setFetchedSolicitudes(prev =>
        prev?.map(s =>
          s.solicitudId === solicitudId
            ? { ...s,
                emailMinutaStatus: status,
                emailMinutaLastUpdatedAt: new Date(),
                emailMinutaLastUpdatedBy: user.email!
              }
            : s
        ) || null
      );
    } catch (err) {
      console.error("Error updating email minuta status: ", err);
      toast({ title: "Error", description: "No se pudo actualizar el estado de Email Minuta.", variant: "destructive" });
    }
  }, [user, toast]);


  const openMessageDialog = (solicitudId: string) => {
    setCurrentSolicitudIdForMessage(solicitudId);
    const currentSolicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudId);
    if (currentSolicitud?.paymentStatus && currentSolicitud.paymentStatus.startsWith("Error: ")) {
      setMessageText(currentSolicitud.paymentStatus.substring("Error: ".length));
    } else {
      setMessageText('');
    }
    setIsMessageDialogOpen(true);
  };
  
  const openViewErrorDialog = (errorMessage: string) => {
    setErrorMessageToView(errorMessage);
    setIsViewErrorDialogOpen(true);
  };

  const handleSaveMessage = async () => {
    if (currentSolicitudIdForMessage) {
      let finalPaymentStatus: string | null = null;
      if (messageText.trim() !== '') {
        finalPaymentStatus = `Error: ${messageText.trim()}`;
      }
      await handleUpdatePaymentStatus(currentSolicitudIdForMessage, finalPaymentStatus);
    }
    setIsMessageDialogOpen(false);
    setMessageText('');
    setCurrentSolicitudIdForMessage(null);
  };

  const openMinutaDialog = (solicitudId: string) => {
    const solicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudId);
    setCurrentSolicitudIdForMinuta(solicitudId);
    setMinutaNumberInput(solicitud?.minutaNumber || '');
    setIsMinutaDialogOpen(true);
  };

  const handleSaveMinuta = useCallback(async (solicitudId: string, minutaNum?: string | null) => {
    const targetSolicitudId = solicitudId;
    const targetMinutaNum = IS_MINUTA_VALIDATION_ENABLED ? minutaNum : `PAGADO-${new Date().toISOString()}`;

    if (!targetSolicitudId || !user?.email) {
      toast({ title: "Error", description: "Falta ID de solicitud o usuario.", variant: "destructive" });
      return;
    }
    if (IS_MINUTA_VALIDATION_ENABLED && !targetMinutaNum?.trim()) {
      toast({ title: "Error", description: "El número de minuta es requerido.", variant: "destructive" });
      return;
    }

    const docRef = doc(db, "SolicitudCheques", targetSolicitudId);
    try {
      const batch = writeBatch(db);
      const updates = {
        paymentStatus: 'Pagado',
        minutaNumber: targetMinutaNum?.trim() || null,
        paymentStatusLastUpdatedAt: serverTimestamp(),
        paymentStatusLastUpdatedBy: user.email,
        hasOpenUrgentComment: false,
        emailMinutaStatus: true,
        emailMinutaLastUpdatedAt: serverTimestamp(),
        emailMinutaLastUpdatedBy: user.email,
      };

      batch.update(docRef, updates);
      await batch.commit();

      toast({ title: "Éxito", description: `Solicitud marcada como pagada con minuta ${targetMinutaNum?.trim()}.` });

      setFetchedSolicitudes(prev =>
        prev?.map(s => {
          if (s.solicitudId === targetSolicitudId) {
            return {
              ...s,
              paymentStatus: 'Pagado',
              minutaNumber: targetMinutaNum?.trim() || null,
              paymentStatusLastUpdatedAt: new Date(),
              paymentStatusLastUpdatedBy: user.email!,
              hasOpenUrgentComment: false,
              emailMinutaStatus: true,
              emailMinutaLastUpdatedAt: new Date(),
              emailMinutaLastUpdatedBy: user.email!,
            };
          }
          return s;
        }) || null
      );
    } catch (err) {
      console.error("Error saving minuta and updating status: ", err);
      toast({ title: "Error", description: "No se pudo guardar la minuta y actualizar el estado.", variant: "destructive" });
    } finally {
      setIsMinutaDialogOpen(false);
      setMinutaNumberInput('');
      setCurrentSolicitudIdForMinuta(null);
    }
  }, [user, toast, IS_MINUTA_VALIDATION_ENABLED]);


  const openCommentsDialog = async (solicitudId: string) => {
    setCurrentSolicitudIdForComments(solicitudId);
    setIsNewCommentUrgent(false); 
    setComments([]);
    setIsLoadingComments(true);
    setIsCommentsDialogOpen(true);

    const solicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudId);
    const collectionName = solicitud?.isMemorandum ? "Memorandum" : "SolicitudCheques";

    try {
      const commentsCollectionRef = collection(db, collectionName, solicitudId, "comments");
      const q = query(commentsCollectionRef, orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedComments = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof FirestoreTimestamp ? data.createdAt.toDate() : new Date(),
        } as CommentRecord;
      });
      setComments(fetchedComments);
    } catch (err) {
      console.error("Error fetching comments: ", err);
      toast({ title: "Error", description: "No se pudieron cargar los comentarios.", variant: "destructive" });
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const closeCommentsDialog = () => {
    setIsCommentsDialogOpen(false);
    setCurrentSolicitudIdForComments(null);
    setNewCommentText('');
    setIsNewCommentUrgent(false);
    setComments([]);
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() || !currentSolicitudIdForComments || !user || !user.email) {
      toast({
        title: "Error",
        description: "El comentario no puede estar vacío o falta información del usuario/solicitud.",
        variant: "destructive",
      });
      return;
    }
    setIsPostingComment(true);

    const solicitud = fetchedSolicitudes?.find(s => s.solicitudId === currentSolicitudIdForComments);
    if (!solicitud) {
        toast({ title: "Error", description: "No se encontró la solicitud.", variant: "destructive" });
        setIsPostingComment(false);
        return;
    }
    const collectionName = solicitud.isMemorandum ? "Memorandum" : "SolicitudCheques";
    const solicitudDocRef = doc(db, collectionName, currentSolicitudIdForComments);

    try {
        const batch = writeBatch(db);
        const commentsCollectionRef = collection(solicitudDocRef, "comments");
        const newCommentDocRef = doc(commentsCollectionRef);
        const newCommentData = {
            solicitudId: currentSolicitudIdForComments,
            text: newCommentText.trim(),
            userId: user.uid,
            userEmail: user.email,
            createdAt: serverTimestamp(),
        };
        batch.set(newCommentDocRef, newCommentData);
        
        const updatePayload: { [key: string]: any } = {
            commentsCount: increment(1)
        };

        if (isNewCommentUrgent) { 
            updatePayload.hasOpenUrgentComment = true;
        }

        batch.update(solicitudDocRef, updatePayload);

        await batch.commit();
        
        // Optimistic UI update
        setComments(prev => [...prev, { ...newCommentData, id: newCommentDocRef.id, createdAt: new Date() } as CommentRecord]);
        setNewCommentText('');
        setIsNewCommentUrgent(false); 
        toast({ title: "Éxito", description: "Comentario publicado." });

        setFetchedSolicitudes(prevSolicitudes =>
            prevSolicitudes?.map(s => {
            if (s.solicitudId === currentSolicitudIdForComments) {
                const updatedSol: SolicitudRecord = { 
                    ...s, 
                    commentsCount: (s.commentsCount ?? 0) + 1,
                    ...(isNewCommentUrgent && { hasOpenUrgentComment: true }) 
                };
                return updatedSol;
            }
            return s;
            }) || null
        );

    } catch (err) {
        console.error("Error posting comment: ", err);
        toast({ title: "Error", description: "No se pudo publicar el comentario.", variant: "destructive" });
    } finally {
        setIsPostingComment(false);
    }
  };


  const handleResolveDuplicate = useCallback(async (duplicateKey: string, resolutionStatus: "validated_not_duplicate" | "deletion_requested") => {
    const allowedRoles = ['calificador', 'admin'];
    if (!user || !user.email || !user.role || !allowedRoles.includes(user.role)) {
      toast({ title: "Error", description: "Acción no autorizada.", variant: "destructive" });
      return;
    }
    if (permanentlyResolvedDuplicateKeys.includes(duplicateKey)) {
        toast({ title: "Información", description: `La alerta para ${duplicateKey.split('-')[0]} ya ha sido resuelta permanentemente.`, variant: "default" });
        setResolvedDuplicateKeys(prev => [...new Set([...prev, duplicateKey])]); 
        return;
    }

    const neFromKey = duplicateKey.split('-')[0];
    const idsInvolved = duplicateSets.get(duplicateKey) || [];

    const validationData: Omit<ValidacionRecord, 'id' | 'resolvedAt'> & { resolvedAt: any } = {
      resolvedBy: user.email,
      resolvedAt: serverTimestamp(),
      duplicateKey,
      duplicateIds: idsInvolved,
      resolutionStatus,
      ne: neFromKey,
    };

    try {
      const validacionesCollectionRef = collection(db, "Validaciones");
      await addDoc(validacionesCollectionRef, validationData);

      setResolvedDuplicateKeys(prev => [...new Set([...prev, duplicateKey])]); 
      setPermanentlyResolvedDuplicateKeys(prev => [...new Set([...prev, duplicateKey])]); 
      toast({ title: "Alerta de Duplicado Resuelta", description: `La alerta para ${neFromKey} ha sido marcada como "${resolutionStatus === 'validated_not_duplicate' ? 'Validado (No Duplicado)' : 'Solicitud de Eliminación'}".` });
    } catch (err) {
      console.error("Error resolving duplicate: ", err);
      toast({ title: "Error", description: "No se pudo resolver la alerta de duplicado.", variant: "destructive" });
    }
  }, [user, toast, duplicateSets, permanentlyResolvedDuplicateKeys]);


  const handleDeleteSolicitudRequest = (id: string) => {
    if (user?.role !== 'admin') {
      toast({ title: "Error", description: "No tiene permisos para eliminar solicitudes.", variant: "destructive" });
      return;
    }
    setSolicitudToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSolicitud = async () => {
    if (!solicitudToDeleteId || user?.role !== 'admin' || !user.email) {
      toast({ title: "Error", description: "No se pudo eliminar la solicitud o acción no autorizada.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      return;
    }

    const solicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudToDeleteId);
    const collectionName = solicitud?.isMemorandum ? "Memorandum" : "SolicitudCheques";

    const originalDocRef = doc(db, collectionName, solicitudToDeleteId);

    try {
      const originalDocSnap = await getDoc(originalDocRef);
      if (!originalDocSnap.exists()) {
        toast({ title: "Error", description: `La solicitud ${solicitudToDeleteId} no existe en ${collectionName}.`, variant: "destructive" });
        setIsDeleteDialogOpen(false);
        return;
      }

      const originalData = originalDocSnap.data();

      // Prepare data for Eliminaciones collection (direct copy of original data)
      const eliminacionDocRef = doc(db, "Eliminaciones", solicitudToDeleteId);

      // Prepare data for AuditTrail subcollection
      const auditEventRef = doc(collection(db, "Eliminaciones", solicitudToDeleteId, "AuditTrail"));
      const auditEventData: Omit<DeletionAuditEvent, 'id' | 'deletedAt'> & { deletedAt: any } = {
        action: 'deleted',
        deletedBy: user.email,
        deletedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(eliminacionDocRef, originalData); // Store the full original document
      batch.set(auditEventRef, auditEventData);   // Store the audit event in subcollection
      batch.delete(originalDocRef);               // Delete original document

      await batch.commit();

      toast({ title: "Éxito", description: `Solicitud ${solicitudToDeleteId} eliminada y archivada.` });
      setFetchedSolicitudes(prev => prev ? prev.filter(s => s.solicitudId !== solicitudToDeleteId) : null);

    } catch (err) {
      console.error("Error deleting and archiving solicitud:", err);
      toast({ title: "Error", description: "No se pudo completar la eliminación y archivado.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setSolicitudToDeleteId(null);
    }
  };


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authLoading && user?.email) {
      if (user.role === 'autorevisor') {
        setFilterGuardadoPorInput(user.email);
      } else if (user.role === 'autorevisor_plus') {
        const colleagueEmails = user.canReviewUserEmails && user.canReviewUserEmails.length > 0 
          ? `, ${user.canReviewUserEmails.join(', ')}` 
          : '';
        setFilterGuardadoPorInput(`${user.email}${colleagueEmails}`);
      }
    }
  }, [isClient, authLoading, user]);

  const handleSearch = async (actionConfig?: { event?: FormEvent, preserveFilters?: boolean }) => {
    const event = actionConfig?.event;
    const preserveFilters = actionConfig?.preserveFilters ?? false;

    if (event) {
      event.preventDefault();
    }

    if (!user) {
      toast({ title: "No autenticado", description: "Debe iniciar sesión para buscar.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setFetchedSolicitudes(null);
    setDuplicateSets(new Map());
    setDuplicateFilterIds(null); 
    if (!preserveFilters) {
      setResolvedDuplicateKeys([]);
    }
    setCurrentSearchTermForDisplay('');
    setIsDetailViewVisible(false);
    setSolicitudToView(null);

    if (!preserveFilters) {
      setFilterEstadoSolicitudInput('');
      setFilterEstadoPagoInput('');
      setFilterRecpDocsInput('');
      setFilterNotMinutaInput('');
      setFilterSolicitudIdInput('');
      setFilterFechaSolicitudInput('');
      setFilterNEInput('');
      setFilterMontoInput('');
      setFilterConsignatarioInput('');
      setFilterDeclaracionInput('');
      setFilterReferenciaInput('');
      if (user?.role !== 'autorevisor' && user?.role !== 'autorevisor_plus') {
        setFilterGuardadoPorInput('');
      }
    }


    const solicitudsCollectionRef = collection(db, "SolicitudCheques");
    let termForDisplay = searchTermText.trim();
    const queryConstraints: QueryConstraint[] = [];

    // --- Visibility Logic ---
    const globalRoles = ['admin', 'coordinadora', 'revisor', 'calificador'];
    const canSeeAll = user.role && globalRoles.includes(user.role);
    
    if (!canSeeAll && user.email) {
        if (user.visibilityGroup && user.visibilityGroup.length > 0) {
            try {
                const usersQuery = query(collection(db, "users"), where('uid', 'in', user.visibilityGroup));
                const userDocs = await getDocs(usersQuery);
                const groupEmails = userDocs.docs.map(d => d.data().email).filter(Boolean);
                if (groupEmails.length > 0) {
                    queryConstraints.push(where("savedBy", "in", groupEmails));
                } else {
                    queryConstraints.push(where("savedBy", "==", user.email));
                }
            } catch (e) {
                console.error("Error fetching group member emails", e);
                queryConstraints.push(where("savedBy", "==", user.email));
            }
        } else if (user.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0) {
            const emailsToQuery = [user.email, ...user.canReviewUserEmails];
            queryConstraints.push(where("savedBy", "in", emailsToQuery));
        } else {
            // Default to seeing only their own if not global and not in a group
            queryConstraints.push(where("savedBy", "==", user.email));
        }
    }
    // --- End Visibility Logic ---


    try {
      switch (searchType) {
        case "dateToday":
          const todayStart = startOfDay(new Date());
          const todayEnd = endOfDay(new Date());
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(todayStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(todayEnd)));
          termForDisplay = format(new Date(), "PPP", { locale: es });
          break;
        case "dateCurrentMonth":
          const monthStart = startOfMonth(new Date());
          const monthEnd = endOfMonth(new Date());
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(monthStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(monthEnd)));
          termForDisplay = format(new Date(), "MMMM yyyy", { locale: es });
          break;
        case "dateSpecific":
          if (!selectedDate) { setError("Por favor, seleccione una fecha específica."); setIsLoading(false); return; }
          const specificDayStart = startOfDay(selectedDate);
          const specificDayEnd = endOfDay(selectedDate);
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(specificDayStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(specificDayEnd)));
          termForDisplay = format(selectedDate, "PPP", { locale: es });
          break;
        case "dateRange":
          if (!datePickerStartDate || !datePickerEndDate) { setError("Por favor, seleccione un rango de fechas (inicio y fin)."); setIsLoading(false); return; }
          if (datePickerStartDate > datePickerEndDate) { setError("La fecha de inicio no puede ser posterior a la fecha de fin."); setIsLoading(false); return; }
          const rangeStart = startOfDay(datePickerStartDate);
          const rangeEnd = endOfDay(datePickerEndDate);
          queryConstraints.push(where("examDate", ">=", FirestoreTimestamp.fromDate(rangeStart)));
          queryConstraints.push(where("examDate", "<=", FirestoreTimestamp.fromDate(rangeEnd)));
          termForDisplay = `Rango: ${format(datePickerStartDate, "dd/MM/yy", { locale: es })} - ${format(datePickerEndDate, "dd/MM/yy", { locale: es })}`;
          break;
        default:
          setError("Tipo de búsqueda no válido."); setIsLoading(false); return;
      }
      
      queryConstraints.push(orderBy("examDate", "desc"));

      setCurrentSearchTermForDisplay(termForDisplay);

      const q = query(solicitudsCollectionRef, ...queryConstraints);

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs.map(docSnap => {
          const docData = docSnap.data();
          const examDateValue = docData.examDate instanceof FirestoreTimestamp ? docData.examDate.toDate() : (docData.examDate instanceof Date ? docData.examDate : undefined);
          const savedAtValue = docData.savedAt instanceof FirestoreTimestamp ? docData.savedAt.toDate() : (docData.savedAt instanceof Date ? docData.savedAt : undefined);
          const paymentStatusLastUpdatedAt = docData.paymentStatusLastUpdatedAt instanceof FirestoreTimestamp ? docData.paymentStatusLastUpdatedAt.toDate() : (docData.paymentStatusLastUpdatedAt instanceof Date ? docData.paymentStatusLastUpdatedAt : undefined);
          const recepcionDCLastUpdatedAt = docData.recepcionDCLastUpdatedAt instanceof FirestoreTimestamp ? docData.recepcionDCLastUpdatedAt.toDate() : (docData.recepcionDCLastUpdatedAt instanceof Date ? docData.recepcionDCLastUpdatedAt : undefined);
          const emailMinutaLastUpdatedAt = docData.emailMinutaLastUpdatedAt instanceof FirestoreTimestamp ? docData.emailMinutaLastUpdatedAt.toDate() : (docData.emailMinutaLastUpdatedAt instanceof Date ? docData.emailMinutaLastUpdatedAt : undefined);
          const rhPaymentDate = docData.rhPaymentDate instanceof FirestoreTimestamp ? docData.rhPaymentDate.toDate() : (docData.rhPaymentDate instanceof Date ? docData.rhPaymentDate : undefined);
          const rhPaymentStartDate = docData.rhPaymentStartDate instanceof FirestoreTimestamp ? docData.rhPaymentStartDate.toDate() : (docData.rhPaymentStartDate instanceof Date ? docData.rhPaymentStartDate : undefined);
          const rhPaymentEndDate = docData.rhPaymentEndDate instanceof FirestoreTimestamp ? docData.rhPaymentEndDate.toDate() : (docData.rhPaymentEndDate instanceof Date ? docData.rhPaymentEndDate : undefined);

          return {
            ...docData,
            solicitudId: docSnap.id,
            examDate: examDateValue,
            savedAt: savedAtValue,
            paymentStatusLastUpdatedAt: paymentStatusLastUpdatedAt,
            recepcionDCLastUpdatedAt: recepcionDCLastUpdatedAt,
            emailMinutaLastUpdatedAt: emailMinutaLastUpdatedAt,
            rhPaymentDate: rhPaymentDate,
            rhPaymentStartDate: rhPaymentStartDate,
            rhPaymentEndDate: rhPaymentEndDate,
          } as SolicitudRecord;
        });

        setFetchedSolicitudes(data);

        if (data && data.length > 1) {
          const potentialDuplicatesMap = new Map<string, string[]>();
          data.forEach(solicitud => {
            if (solicitud.examNe && solicitud.examNe.trim() !== '' &&
                solicitud.monto !== null &&
                solicitud.montoMoneda && solicitud.montoMoneda.trim() !== '') {
              const key = `${solicitud.examNe.trim()}-${solicitud.monto}-${solicitud.montoMoneda.trim()}`;
              if (!potentialDuplicatesMap.has(key)) {
                potentialDuplicatesMap.set(key, []);
              }
              potentialDuplicatesMap.get(key)!.push(solicitud.solicitudId);
            }
          });

          const newDuplicateSets = new Map<string, string[]>();
          potentialDuplicatesMap.forEach((ids, key) => {
            if (ids.length > 1) {
              newDuplicateSets.set(key, ids);
            }
          });
          setDuplicateSets(newDuplicateSets);

        } else {
           setDuplicateSets(new Map());
        }

      } else { setError("No se encontraron solicitudes para los criterios ingresados."); }

    } catch (err: any) {
      console.error("Error fetching documents from Firestore: ", err);
      let userFriendlyError = "Error al buscar las solicitudes. Intente de nuevo.";
      if (err.code === 'permission-denied') {
        userFriendlyError = "No tiene permisos para acceder a esta información.";
      } else if (err.code === 'failed-precondition' || (err.message && err.message.toLowerCase().includes('index'))) {
            userFriendlyError = "Error de consulta: Es posible que se requiera un índice compuesto en Firestore que no existe. Por favor, revise la consola del navegador para ver un enlace que permita crear el índice necesario. La creación de índices puede tardar unos minutos.";
            toast({ title: "Índice Requerido", description: "Es posible que necesite crear un índice compuesto en Firestore. Revise la consola del navegador (F12) para más detalles.", variant: "destructive", duration: 10000 });
      }
      setError(userFriendlyError);
    } finally { setIsLoading(false); }
  };

  const handleFilterByDuplicateSet = useCallback((ids: string[]) => {
    setDuplicateFilterIds(ids);
    toast({ title: "Filtro Aplicado", description: `Mostrando ${ids.length} solicitudes del conjunto de duplicados.` });
  }, [toast]);

  const handleExport = async () => {
    const dataToUse = displayedSolicitudes || [];
    if (dataToUse.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar. Realice una búsqueda primero.", variant: "default" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Preparando datos para Excel, esto puede tardar unos segundos...", duration: 10000 });

    const headers = [
      "Estado de Pago", "No. Minuta", "Recepción Doc.", "Recepción Doc. Por", "Recepción Doc. Fecha", "Email Minuta", "Email Minuta Por", "Email Minuta Fecha", "ID Solicitud", "Tipo", "Fecha", "NE", "Monto", "Moneda Monto", "Consignatario", "Declaracion", "Referencia", "Guardado Por",
      "Cantidad en Letras", "Destinatario Solicitud",
      "Unidad Recaudadora", "Código 1", "Codigo MUR", "Banco", "Otro Banco", "Número de Cuenta", "Moneda de la Cuenta", "Otra Moneda Cuenta",
      "Elaborar Cheque A", "Elaborar Transferencia A",
      "Impuestos Pagados Cliente", "R/C (Imp. Pagados)", "T/B (Imp. Pagados)", "Cheque (Imp. Pagados)",
      "Impuestos Pendientes Cliente", "Soporte", "Documentos Adjuntos",
      "Constancias de No Retención", "Constancia 1%", "Constancia 2%",
      "Pago de Servicios", "Tipo de Servicio", "Otro Tipo de Servicio", "Factura Servicio", "Institución Servicio",
      "Correo Notificación", "Observación", "Usuario (De)",
      "Fecha de Guardado", "Actualizado Por (Pago)", "Fecha Actualización (Pago)", "Comentarios", "Comentario Urgente Abierto"
    ];

    const dataToExportPromises = dataToUse.map(async (s) => {
      let commentsString = 'N/A';
      if (s.commentsCount && s.commentsCount > 0) {
        try {
            const collectionName = s.isMemorandum ? "Memorandum" : "SolicitudCheques";
            const commentsCollectionRef = collection(db, collectionName, s.solicitudId, "comments");
            const q = query(commentsCollectionRef, orderBy("createdAt", "asc"));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
            commentsString = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                const createdAt = data.createdAt instanceof FirestoreTimestamp ? data.createdAt.toDate() : new Date();
                return `${data.userEmail} - ${format(createdAt, "dd/MM/yy HH:mm", { locale: es })}: ${data.text}`;
            }).join("\n");
            }
        } catch (err) {
            console.error(`Error fetching comments for ${s.solicitudId}: `, err);
            commentsString = 'Error al cargar comentarios';
        }
      } else if (s.commentsCount === 0) {
        commentsString = 'Sin comentarios';
      }

      return {
        "Estado de Pago": s.paymentStatus || 'Pendiente',
        "No. Minuta": s.minutaNumber || 'N/A',
        "Recepción Doc.": s.recepcionDCStatus ? 'Recibido' : 'Pendiente',
        "Recepción Doc. Por": s.recepcionDCLastUpdatedBy || 'N/A',
        "Recepción Doc. Fecha": s.recepcionDCLastUpdatedAt && s.recepcionDCLastUpdatedAt instanceof Date ? format(s.recepcionDCLastUpdatedAt, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "Email Minuta": s.emailMinutaStatus ? 'Notificado' : 'Pendiente',
        "Email Minuta Por": s.emailMinutaLastUpdatedBy || 'N/A',
        "Email Minuta Fecha": s.emailMinutaLastUpdatedAt && s.emailMinutaLastUpdatedAt instanceof Date ? format(s.emailMinutaLastUpdatedAt, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "ID Solicitud": s.solicitudId,
        "Tipo": s.isMemorandum ? 'Memorandum' : 'Solicitud Cheque',
        "Fecha": s.examDate instanceof Date ? format(s.examDate, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "NE": s.examNe,
        "Monto": s.monto,
        "Moneda Monto": s.montoMoneda,
        "Consignatario": s.consignatario || 'N/A',
        "Declaracion": s.declaracionNumero || 'N/A',
        "Referencia": s.examReference || 'N/A',
        "Guardado Por": s.savedBy || 'N/A',

        "Cantidad en Letras": s.cantidadEnLetras || 'N/A',
        "Destinatario Solicitud": s.examRecipient,
        "Unidad Recaudadora": s.unidadRecaudadora || 'N/A',
        "Código 1": s.codigo1 || 'N/A',
        "Codigo MUR": s.codigo2 || 'N/A',
        "Banco": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'Acción por Cheque / No Aplica Banco' : s.banco || 'N/A',
        "Otro Banco": s.banco === 'Otros' ? (s.bancoOtros || 'N/A') : 'N/A',
        "Número de Cuenta": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'N/A' : s.numeroCuenta || 'N/A',
        "Moneda de la Cuenta": s.banco === 'ACCION POR CHEQUE/NO APLICA BANCO' ? 'N/A' : (s.monedaCuenta === 'Otros' ? (s.monedaCuentaOtros || 'N/A') : s.monedaCuenta || 'N/A'),
        "Otra Moneda Cuenta": s.monedaCuenta === 'Otros' ? (s.monedaCuentaOtros || 'N/A') : 'N/A',
        "Elaborar Cheque A": s.elaborarChequeA || 'N/A',
        "Elaborar Transferencia A": s.elaborarTransferenciaA || 'N/A',
        "Impuestos Pagados Cliente": s.impuestosPagadosCliente ? 'Sí' : 'No',
        "R/C (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosRC || 'N/A') : 'N/A',
        "T/B (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosTB || 'N/A') : 'N/A',
        "Cheque (Imp. Pagados)": s.impuestosPagadosCliente ? (s.impuestosPagadosCheque || 'N/A') : 'N/A',
        "Impuestos Pendientes Cliente": s.impuestosPendientesCliente ? 'Sí' : 'No',
        "Soporte": s.soporte ? 'Sí' : 'No',
        "Documentos Adjuntos": s.documentosAdjuntos ? 'Sí' : 'No',
        "Constancias de No Retención": s.constanciasNoRetencion ? 'Sí' : 'No',
        "Constancia 1%": s.constanciasNoRetencion ? (s.constanciasNoRetencion1 ? 'Sí' : 'No') : 'N/A',
        "Constancia 2%": s.constanciasNoRetencion ? (s.constanciasNoRetencion2 ? 'Sí' : 'No') : 'N/A',
        "Pago de Servicios": s.pagoServicios ? 'Sí' : 'No',
        "Tipo de Servicio": s.pagoServicios ? (s.tipoServicio === 'OTROS' ? s.otrosTipoServicio : s.tipoServicio) || 'N/A' : 'N/A',
        "Otro Tipo de Servicio": s.pagoServicios && s.tipoServicio === 'OTROS' ? s.otrosTipoServicio || 'N/A' : 'N/A',
        "Factura Servicio": s.pagoServicios ? s.facturaServicio || 'N/A' : 'N/A',
        "Institución Servicio": s.pagoServicios ? s.institucionServicio || 'N/A' : 'N/A',
        "Correo Notificación": s.correo || 'N/A',
        "Observación": s.observation || 'N/A',
        "Usuario (De)": s.examManager,
        "Fecha de Guardado": s.savedAt instanceof Date ? format(s.savedAt, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "Actualizado Por (Pago)": s.paymentStatusLastUpdatedBy || 'N/A',
        "Fecha Actualización (Pago)": s.paymentStatusLastUpdatedAt && s.paymentStatusLastUpdatedAt instanceof Date ? format(s.paymentStatusLastUpdatedAt, "yyyy-MM-dd HH:mm", { locale: es }) : 'N/A',
        "Comentarios": commentsString,
        "Comentario Urgente Abierto": s.hasOpenUrgentComment ? 'Sí' : 'No',
      };
    });

    try {
      const dataToExport = await Promise.all(dataToExportPromises);
      downloadExcelFileFromTable(dataToExport, headers, `Reporte_Solicitudes_${searchType}_${currentSearchTermForDisplay.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Exportación Completa", description: "El archivo Excel se ha descargado." });
    } catch (err) {
      console.error("Error during data export preparation: ", err);
      toast({ title: "Error de Exportación", description: "No se pudo preparar los datos para exportar.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const renderSearchInputs = () => {
    switch (searchType) {
      case "dateToday": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán las solicitudes de hoy.</p>;
      case "dateCurrentMonth": return <p className="text-sm text-muted-foreground flex-grow items-center flex h-10">Se buscarán las solicitudes del mes actual.</p>;
      case "dateSpecific":
        return (
          <Popover open={isSpecificDatePopoverOpen} onOpenChange={setIsSpecificDatePopoverOpen}>
            <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal flex-grow", !selectedDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsSpecificDatePopoverOpen(false);
                  }}
                  initialFocus
                  locale={es}
                />
            </PopoverContent>
          </Popover>
        );
      case "dateRange":
        return (
          <div className="flex flex-col sm:flex-row gap-2 flex-grow">
            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !datePickerStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{datePickerStartDate ? format(datePickerStartDate, "dd/MM/yy", { locale: es }) : <span>Fecha Inicio</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={datePickerStartDate} onSelect={(date) => {setDatePickerStartDate(date); setIsStartDatePopoverOpen(false);}} initialFocus locale={es}/>
              </PopoverContent>
            </Popover>
            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !datePickerEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{datePickerEndDate ? format(datePickerEndDate, "dd/MM/yy", { locale: es }) : <span>Fecha Fin</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={datePickerEndDate} onSelect={(date) => {setDatePickerEndDate(date); setIsEndDatePopoverOpen(false);}} initialFocus locale={es}/>
              </PopoverContent>
            </Popover>
          </div>
        );
      default: return null;
    }
  };

  if (!isClient || ((authLoading || isLoadingPermanentlyResolvedKeys) && !fetchedSolicitudes && !isDetailViewVisible)) {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
  }

  if (isDetailViewVisible && solicitudToView) {
    return (
      <AppShell>
         <div className="py-2 md:py-5">
            <SolicitudDetailView 
              solicitud={solicitudToView}
              isInlineView={true}
              onBackToList={handleBackToTable}
            />
        </div>
      </AppShell>
    );
  }

  const isUserAdminOrRevisor = user?.role === 'admin' || user?.role === 'revisor';
  const isUserCalificador = user?.role === 'calificador';
  const isUserAllowedToMarkUrgent = user?.role === 'autorevisor' || user?.role === 'autorevisor_plus' || user?.role === 'revisor';


  const searchResultsContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Cargando solicitudes...</p></div>;
    }
    if (error) {
      return <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">{error}</div>;
    }
    if (!displayedSolicitudes) {
      return <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">Seleccione un tipo de búsqueda e ingrese los criterios para ver resultados.</div>;
    }
    if (displayedSolicitudes.length === 0) {
      return <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-700 border border-yellow-500/30 rounded-md text-center">No se encontraron solicitudes para los criterios de búsqueda ingresados.</div>;
    }

    if (isMobile) {
      return (
        <div className="space-y-4 mt-6">
          {displayedSolicitudes.map(solicitud => (
            <MobileSolicitudCard
              key={solicitud.solicitudId}
              solicitud={solicitud}
              cardActions={{ onViewDetails: handleViewDetails, onOpenCommentsDialog: openCommentsDialog, onDeleteSolicitud: handleDeleteSolicitudRequest }}
              currentUserRole={user?.role}
            />
          ))}
        </div>
      );
    }
    
    return (
      <SearchResultsTable
        solicitudes={displayedSolicitudes}
        searchType={searchType}
        searchTerm={currentSearchTermForDisplay}
        currentUserRole={user?.role}
        isMinutaValidationEnabled={IS_MINUTA_VALIDATION_ENABLED}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
        onUpdateRecepcionDCStatus={handleUpdateRecepcionDCStatus}
        onUpdateEmailMinutaStatus={handleUpdateEmailMinutaStatus}
        onOpenMessageDialog={openMessageDialog}
        onOpenMinutaDialog={openMinutaDialog}
        onSaveMinuta={handleSaveMinuta}
        onViewDetails={handleViewDetails}
        onOpenCommentsDialog={openCommentsDialog}
        onDeleteSolicitud={handleDeleteSolicitudRequest} 
        onRefreshSearch={() => handleSearch({ preserveFilters: true })}
        onFilterByDuplicateSet={handleFilterByDuplicateSet}
        filterRecpDocsInput={filterRecpDocsInput}
        setFilterRecpDocsInput={setFilterRecpDocsInput}
        filterNotMinutaInput={filterNotMinutaInput}
        setFilterNotMinutaInput={setFilterNotMinutaInput}
        filterSolicitudIdInput={filterSolicitudIdInput}
        setFilterSolicitudIdInput={setFilterSolicitudIdInput}
        filterNEInput={filterNEInput}
        setFilterNEInput={setFilterNEInput}
        filterEstadoPagoInput={filterEstadoPagoInput}
        setFilterEstadoPagoInput={setFilterEstadoPagoInput}
        filterFechaSolicitudInput={filterFechaSolicitudInput}
        setFilterFechaSolicitudInput={setFilterFechaSolicitudInput}
        filterMontoInput={filterMontoInput}
        setFilterMontoInput={setFilterMontoInput}
        filterConsignatarioInput={filterConsignatarioInput}
        setFilterConsignatarioInput={setFilterConsignatarioInput}
        filterDeclaracionInput={filterDeclaracionInput}
        setFilterDeclaracionInput={setFilterDeclaracionInput}
        filterReferenciaInput={filterReferenciaInput}
        setFilterReferenciaInput={setFilterReferenciaInput}
        filterGuardadoPorInput={filterGuardadoPorInput}
        setFilterGuardadoPorInput={setFilterGuardadoPorInput}
        filterEstadoSolicitudInput={filterEstadoSolicitudInput}
        setFilterEstadoSolicitudInput={setFilterEstadoSolicitudInput}
        duplicateSets={duplicateSets}
        onResolveDuplicate={handleResolveDuplicate}
        resolvedDuplicateKeys={resolvedDuplicateKeys}
        permanentlyResolvedDuplicateKeys={permanentlyResolvedDuplicateKeys}
        onOpenViewErrorDialog={openViewErrorDialog}
      />
    );
  }


  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Base de Datos de Solicitudes de Cheque</CardTitle>
            <CardDescription className="text-muted-foreground">Seleccione un tipo de búsqueda e ingrese los criterios.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSearch({ event: e })} className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select value={searchType} onValueChange={(value) => { setSearchType(value as SearchType); setSearchTermText(''); setSelectedDate(undefined); setDatePickerStartDate(undefined); setDatePickerEndDate(undefined); setFetchedSolicitudes(null); setError(null); setDuplicateSets(new Map()); setResolvedDuplicateKeys([]); setCurrentSearchTermForDisplay(''); }}>
                  <SelectTrigger className="w-full sm:w-[200px] shrink-0"><SelectValue placeholder="Tipo de búsqueda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dateToday">Por Fecha (Hoy)</SelectItem>
                    <SelectItem value="dateSpecific">Por Fecha (Específica)</SelectItem>
                    {isUserAdminOrRevisor && (
                        <SelectItem value="dateCurrentMonth">Por Mes (Actual)</SelectItem>
                    )}
                    {isUserCalificador && (
                       <SelectItem value="dateRange">Por Rango de Fechas</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {renderSearchInputs()}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button type="submit" className="btn-primary w-full sm:w-auto" disabled={isLoading || isLoadingPermanentlyResolvedKeys}><Search className="mr-2 h-4 w-4" /> {isLoading ? 'Buscando...' : 'Ejecutar Búsqueda'}</Button>
                <Button type="button" onClick={handleExport} variant="outline" className="w-full sm:w-auto" disabled={!displayedSolicitudes || isLoading || isLoadingPermanentlyResolvedKeys || (displayedSolicitudes && displayedSolicitudes.length === 0) || isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isExporting ? 'Exportando...' : 'Exportar'}
                </Button>
              </div>
            </form>

            {duplicateFilterIds && (
              <div className="my-4 text-center p-3 bg-primary/10 border border-primary/30 rounded-md">
                <Button 
                  variant="outline" 
                  onClick={() => setDuplicateFilterIds(null)} 
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <ListCollapse className="mr-2 h-4 w-4" /> Mostrar todos los resultados de la búsqueda ({fetchedSolicitudes?.length || 0})
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Actualmente viendo un conjunto específico de {duplicateFilterIds.length} solicitudes duplicadas.
                </p>
              </div>
            )}

            {displayedSolicitudes && distinctPendingDocsCount > 5 && (
              ((user?.role === 'calificador' || user?.role === 'admin') && ( 
                <Card className="mt-4 mb-6 bg-amber-50 border border-amber-300 custom-shadow">
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg text-amber-800 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                      Alerta de Seguimiento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-amber-700 pb-4">
                    <p>
                      Usted cuenta con un total de pendientes para: 
                      ESTADO DE PAGO ({pendingPaymentCount}), RECP. DOCS ({pendingRecpDocsCount}) Y NOT. MINUTA ({pendingNotMinutaCount}).
                    </p>
                    {distinctPendingDocsCount > 0 &&
                      <p className="mt-1">
                          Total de documentos con estados pendientes: {distinctPendingDocsCount}.
                      </p>
                    }
                    <p className="font-semibold mt-2">Por favor, revisar y calificar estados a las solicitudes pendientes.</p>
                  </CardContent>
                </Card>
              )) ||
              (((user?.role === 'revisor') || (user?.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0)) && ( 
                <Card className="mt-4 mb-6 bg-sky-50 border border-sky-300 custom-shadow">
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg text-sky-800 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-sky-600" />
                      Alerta de Seguimiento (Revisores / Supervisores)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-sky-700 pb-4">
                    <p>
                      Se identificó que los calificadores cuentan con un total de pendientes para: 
                      ESTADO DE PAGO ({pendingPaymentCount}), RECP. DOCS ({pendingRecpDocsCount}) Y NOT. MINUTA ({pendingNotMinutaCount}).
                    </p>
                    {distinctPendingDocsCount > 0 &&
                      <p className="mt-1">
                          Con un Total de documentos con estados pendientes: {distinctPendingDocsCount}.
                      </p>
                    }
                    <p className="font-semibold mt-2">Se solicita apoyo con el seguimiento.</p>
                  </CardContent>
                </Card>
              ))
            )}

            {searchResultsContent()}
            
          </CardContent>
        </Card>
      </div>
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Mensaje de Error para Solicitud</DialogTitle>
            <DialogDescription>
              Solicitud ID: {currentSolicitudIdForMessage}. Si guarda un mensaje, el estado se marcará como &quot;Error&quot;.
              Si guarda un mensaje vacío y el estado actual es un error o pagado, se limpiará el estado de error/pago (pasará a pendiente).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Escriba el mensaje de error aquí..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsMessageDialogOpen(false); setMessageText(''); setCurrentSolicitudIdForMessage(null);}}>Salir</Button>
            <Button onClick={handleSaveMessage}>Guardar Mensaje</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isViewErrorDialogOpen} onOpenChange={setIsViewErrorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensaje de Error de la Solicitud</DialogTitle>
            <DialogDescription>
              El siguiente error fue registrado para esta solicitud.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={errorMessageToView}
            readOnly
            className="mt-2 bg-muted/50 cursor-not-allowed"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewErrorDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Minuta Dialog */}
      <Dialog open={isMinutaDialogOpen} onOpenChange={setIsMinutaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pago y Registrar Minuta</DialogTitle>
            <DialogDescription>
              Solicitud ID: {currentSolicitudIdForMinuta}. Ingrese el número de minuta para marcar como pagada.
            </DialogDescription>
          </DialogHeader>
           <div className="py-4">
              <Label htmlFor="minutaNumber" className="text-sm font-medium text-foreground">Número de Minuta</Label>
              <Input
                id="minutaNumber"
                value={minutaNumberInput}
                onChange={(e) => setMinutaNumberInput(e.target.value)}
                placeholder="Ej: MIN-12345"
                className="mt-1"
              />
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsMinutaDialogOpen(false); setMinutaNumberInput(''); setCurrentSolicitudIdForMinuta(null); }}>Salir</Button>
            <Button onClick={() => {
              if (currentSolicitudIdForMinuta) {
                handleSaveMinuta(currentSolicitudIdForMinuta, minutaNumberInput);
              }
            }}>Guardar Minuta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={isCommentsDialogOpen} onOpenChange={closeCommentsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comentarios para Solicitud ID: {currentSolicitudIdForComments}</DialogTitle>
            <DialogDescription>
              Ver y añadir comentarios para esta solicitud.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="h-60 overflow-y-auto border p-2 rounded-md bg-muted/20 space-y-2">
              {isLoadingComments ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="ml-2 text-sm text-muted-foreground">Cargando comentarios...</p>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay comentarios aún.</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="p-2 my-1 border-b bg-card shadow-sm rounded">
                    <div className="flex justify-between items-center mb-1">
                        <p className="font-semibold text-primary text-xs">{comment.userEmail}</p>
                        <p className="text-muted-foreground text-xs">
                            {format(comment.createdAt, "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
            <div>
              <Label htmlFor="newCommentTextarea" className="text-sm font-medium text-foreground">Nuevo Comentario:</Label>
              <Textarea
                id="newCommentTextarea"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escriba su comentario aquí..."
                rows={3}
                className="mt-1"
                disabled={isPostingComment}
              />
            </div>
            {isUserAllowedToMarkUrgent && (
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="urgentCommentCheckbox"
                  checked={isNewCommentUrgent}
                  onCheckedChange={(checked) => setIsNewCommentUrgent(!!checked)}
                  disabled={isPostingComment}
                />
                <Label htmlFor="urgentCommentCheckbox" className="text-sm font-medium text-amber-700 dark:text-amber-500 cursor-pointer">
                  Indicar que la operación requiere atención especial
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCommentsDialog} disabled={isPostingComment}>Salir</Button>
            <Button onClick={handlePostComment} disabled={isPostingComment || !newCommentText.trim()}>
                {isPostingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPostingComment ? 'Publicando...' : 'Publicar Comentario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <DialogDescription>
           Estas seguro de realizar esta opción. Operacion de borrar es permanente. La solicitud será archivada.
          </DialogDescription>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setSolicitudToDeleteId(null); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteSolicitud}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
