"use client";
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, Download, Eye, Calendar as CalendarIcon, MessageSquare, Info as InfoIcon, AlertCircle, CheckCircle2, FileText as FileTextIcon, ListCollapse, ArrowLeft, CheckSquare as CheckSquareIcon, MessageSquareText, RotateCw, AlertTriangle, ShieldCheck, Trash2, FileSignature, Briefcase, User as UserIcon, X, FilePlus, Banknote } from 'lucide-react';
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
import { SearchResultsTable } from '@/components/databasepay/SearchResultsTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { PaymentRequestModal } from '@/components/executive/PaymentRequestModal';
import { useAppContext } from '@/context/AppContext';


type SearchType = "dateToday" | "dateSpecific" | "dateRange" | "dateCurrentMonth";

const URGENT_KEYWORDS_LOWER = ["urgente", "urgent", "urge", "apoyo", "apoyar"];


export default function DatabasePage() {
  const { user, loading: authLoading } = useAuth();
  const { setInitialContextData } = useAppContext();
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

  // const [isMinutaDialogOpen, setIsMinutaDialogOpen] = useState(false);
  // const [currentSolicitudIdForMinuta, setCurrentSolicitudIdForMinuta] = useState<string | null>(null);
  // const [minutaNumberInput, setMinutaNumberInput] = useState('');
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

  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);


  const handleOpenPaymentRequest = () => {
    const initialData: InitialDataContext = {
        ne: `SOL-${format(new Date(), 'ddMMyy-HHmmss')}`,
        manager: user?.displayName || 'Usuario Desconocido',
        date: new Date(),
        recipient: '',
        isMemorandum: false,
    };
    setInitialContextData(initialData);
    setIsRequestPaymentModalOpen(true);
  };


  const fetchPermanentlyResolvedKeys = useCallback(async () => {
    const rolesThatNeedValidations = ['revisor', 'calificador', 'admin', 'supervisor'];
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
      const isAllowed = user.hasPaymentAccess || user.role === 'admin' || user.role === 'calificador' || user.role === 'supervisor';
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
        const formatCurrencyFetched = (amount?: number | string | null, currency?: string) => {
            if (amount === undefined || amount === null || amount === '') return 'N/A';
            const num = Number(amount);
            if (isNaN(num)) return String(amount);
            let prefix = '';
            if (currency === 'cordoba') prefix = 'C$';
            else if (currency === 'dolar') prefix = 'US$';
            else if (currency === 'euro') prefix = '€';
            return `${prefix}${num.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
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
    if (displayedSolicitudes && (user?.role === 'calificador' || user?.role === 'revisor' || user?.role === 'admin' || user?.role === 'supervisor' ||(user?.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0))) {
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
      const now = serverTimestamp();
      const updates: Record<string, any> = {
        paymentStatus: newPaymentStatus,
        paymentStatusLastUpdatedAt: now,
        paymentStatusLastUpdatedBy: user.email,
      };

      if (newPaymentStatus === 'Pagado') {
        updates.hasOpenUrgentComment = false; 
        updates.emailMinutaStatus = true; 
        updates.emailMinutaLastUpdatedAt = now;
        updates.emailMinutaLastUpdatedBy = user.email;
        updates.recepcionDCStatus = true;
        updates.recepcionDCLastUpdatedAt = now;
        updates.recepcionDCLastUpdatedBy = user.email;
      } else if (newPaymentStatus === null) {
        updates.minutaNumber = null;
      }

      batch.update(docRef, updates);
      await batch.commit();

      toast({ title: "Éxito", description: `Estado de pago y notificaciones actualizados para ${solicitudId}.` });

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
              updatedSol.recepcionDCStatus = true;
              updatedSol.recepcionDCLastUpdatedAt = new Date();
              updatedSol.recepcionDCLastUpdatedBy = user.email!;
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

  // const openMinutaDialog = (solicitudId: string) => {
  //   const solicitud = fetchedSolicitudes?.find(s => s.solicitudId === solicitudId);
  //   setCurrentSolicitudIdForMinuta(solicitudId);
  //   setMinutaNumberInput(solicitud?.minutaNumber || '');
  //   setIsMinutaDialogOpen(true);
  // };

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
      const now = serverTimestamp();
      const updates = {
        paymentStatus: 'Pagado',
        minutaNumber: targetMinutaNum?.trim() || null,
        paymentStatusLastUpdatedAt: now,
        paymentStatusLastUpdatedBy: user.email,
        hasOpenUrgentComment: false,
        emailMinutaStatus: true,
        emailMinutaLastUpdatedAt: now,
        emailMinutaLastUpdatedBy: user.email,
        recepcionDCStatus: true, // Auto-check
        recepcionDCLastUpdatedAt: now,
        recepcionDCLastUpdatedBy: user.email
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
              recepcionDCStatus: true,
              recepcionDCLastUpdatedAt: new Date(),
              recepcionDCLastUpdatedBy: user.email!
            };
          }
          return s;
        }) || null
      );
    } catch (err) {
      console.error("Error saving minuta and updating status: ", err);
      toast({ title: "Error", description: "No se pudo guardar la minuta y actualizar el estado.", variant: "destructive" });
    } finally {
      // setIsMinutaDialogOpen(false);
      // setMinutaNumberInput('');
      // setCurrentSolicitudIdForMinuta(null);
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
    const allowedRoles = ['calificador', 'admin', 'supervisor'];
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
    const globalRoles = ['admin', 'coordinadora', 'revisor', 'calificador', 'supervisor'];
    const canSeeAll = user.role && globalRoles.includes(user.role);

    if (!canSeeAll && user.email) {
      const visibilityEmails: string[] = [user.email];
      
      if (user.role === 'ejecutivo' && user.visibilityGroup && user.visibilityGroup.length > 0) {
          try {
              const usersQuery = query(collection(db, "users"), where('__name__', 'in', user.visibilityGroup));
              const userDocs = await getDocs(usersQuery);
              const groupEmails = userDocs.docs.map(d => d.data().email).filter(Boolean);
              visibilityEmails.push(...groupEmails);
          } catch (e) {
              console.error("Error fetching group member emails", e);
          }
      } else if (user.role === 'autorevisor_plus' && user.canReviewUserEmails && user.canReviewUserEmails.length > 0) {
          visibilityEmails.push(...user.canReviewUserEmails);
      }
      
      const uniqueEmails = [...new Set(visibilityEmails)];
      if (uniqueEmails.length > 0) {
          queryConstraints.push(where("savedBy", "in", uniqueEmails));
      } else {
           queryConstraints.push(where("savedBy", "==", "no_user_found_should_return_empty"));
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

  const searchResultsContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Cargando solicitudes...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center">
          {error}
        </div>
      );
    }
    if (displayedSolicitudes && displayedSolicitudes.length > 0) {
      if (isMobile) {
        return (
          <div className="space-y-4 mt-6">
            {displayedSolicitudes.map(solicitud => (
              <MobileSolicitudCard
                key={solicitud.solicitudId}
                solicitud={solicitud}
                cardActions={{ onViewDetails: handleViewDetails, onOpenCommentsDialog: openCommentsDialog, onDeleteSolicitud: handleDeleteSolicitudRequest, onOpenViewErrorDialog: openViewErrorDialog }}
                currentUserRole={user?.role}
              />
            ))}
          </div>
        )
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
    if (!fetchedSolicitudes && !isLoading && !error && !currentSearchTermForDisplay) {
        return (
            <div className="mt-4 p-4 bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-md text-center">
                Seleccione un tipo de búsqueda e ingrese los criterios para ver resultados.
            </div>
        );
    }
    return null;
  };

  if (!isClient || ((authLoading || isLoadingPermanentlyResolvedKeys) && !fetchedSolicitudes && !isDetailViewVisible)) {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
  }

  if (isDetailViewVisible && solicitudToView) {
    return (
      <AppShell>
         <div className="py-2 md:py-5">
            <SolicitudDetailView 
              id={solicitudToView.solicitudId}
              isInlineView={true}
              onBackToList={handleBackToTable}
            />
        </div>
      </AppShell>
    );
  }

  const isUserAdminOrRevisor = user?.role === 'admin' || user?.role === 'revisor';
  const isUserCalificadorOrSupervisor = user?.role === 'calificador' || user?.role === 'supervisor';
  const isUserAllowedToMarkUrgent = user?.role === 'autorevisor' || user?.role === 'autorevisor_plus' || user?.role === 'revisor';


  return (
    <>
      <AppShell>
        <div className="py-2 md:py-5">
          <Card className="w-full custom-shadow">
            <CardHeader>
              <div className="flex justify-between items-start flex-wrap gap-4">
                  <div>
                      <CardTitle className="text-2xl font-semibold text-foreground">Base de Datos de Solicitudes de Cheque</CardTitle>
                      <CardDescription className="text-muted-foreground">Seleccione un tipo de búsqueda e ingrese los criterios.</CardDescription>
                  </div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button size="lg" variant="secondary" className="h-12 text-md">
                              <Banknote className="mr-2 h-5 w-5" /> Realizar Solicitud de Cheque
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Esta acción iniciará una solicitud de pago no vinculada a un Número de Entrada (NE) específico. Se generará un ID único en su lugar.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleOpenPaymentRequest}>Sí, continuar</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSearch({ event: e })} className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Select value={searchType} onValueChange={(value) => { setSearchType(value as SearchType); setSearchTermText(''); setSelectedDate(undefined); setDatePickerStartDate(undefined); setDatePickerEndDate(undefined); setFetchedSolicitudes(null); setError(null); setDuplicateSets(new Map()); setResolvedDuplicateKeys([]); setCurrentSearchTermForDisplay(''); }}>
                    <SelectTrigger className="w-full sm:w-[200px] shrink-0"><SelectValue placeholder="Tipo de búsqueda" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dateToday">Por Fecha (Hoy)</SelectItem>
                      <SelectItem value="dateSpecific">Por Fecha (Específica)</SelectItem>
                      {(isUserAdminOrRevisor || isUserCalificadorOrSupervisor) && (
                          <>
                            <SelectItem value="dateCurrentMonth">Por Mes (Actual)</SelectItem>
                            <SelectItem value="dateRange">Por Rango de Fechas</SelectItem>
                          </>
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
                ((user?.role === 'calificador' || user?.role === 'admin' || user?.role === 'supervisor') && ( 
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
        {/*
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
        */}

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
       <PaymentRequestModal
        isOpen={isRequestPaymentModalOpen}
        onClose={() => setIsRequestPaymentModalOpen(false)}
        caseData={null}
      />
    </>
  );
}
