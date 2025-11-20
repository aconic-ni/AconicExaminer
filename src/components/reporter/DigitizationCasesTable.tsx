
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { AforoCase, DigitacionStatus, AforoCaseUpdate, AppUser } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, History, Edit, User, MoreHorizontal, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AforoCaseHistoryModal } from './AforoCaseHistoryModal';
import { DigitizationCommentModal } from './DigitizationCommentModal';
import { CompleteDigitizationModal } from './CompleteDigitizationModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

export function DigitizationCasesTable({ searchTerm }: { searchTerm: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<AforoCase[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingState, setSavingState] = useState<{ [key: string]: boolean }>({});
  
  const [selectedCaseForHistory, setSelectedCaseForHistory] = useState<AforoCase | null>(null);
  const [selectedCaseForComment, setSelectedCaseForComment] = useState<AforoCase | null>(null);
  const [selectedCaseForCompletion, setSelectedCaseForCompletion] = useState<AforoCase | null>(null);

  const handleAutoSave = useCallback(async (caseId: string, field: keyof AforoCase, value: any) => {
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

        toast({ title: "Guardado Automático", description: `El campo ${String(field)} se ha actualizado.` });

    } catch (error) {
        console.error("Error updating case:", error);
        toast({ title: "Error", description: `No se pudo guardar el cambio en ${String(field)}.`, variant: "destructive" });
    } finally {
        setSavingState(prev => ({ ...prev, [caseId]: false }));
    }
  }, [user, cases, toast]);


  useEffect(() => {
    setIsLoading(true);

    const fetchAssignableUsers = async () => {
        const usersMap = new Map<string, AppUser>();
        const rolesToFetch = ['aforador', 'digitador'];
        const roleQueries = rolesToFetch.map(role => query(collection(db, 'users'), where('role', '==', role)));
        const titleQuery = query(collection(db, 'users'), where('roleTitle', '==', 'agente aduanero'));
        const allQueries = [...roleQueries, titleQuery];

        try {
            const querySnapshots = await Promise.all(allQueries.map(q => getDocs(q)));
            querySnapshots.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const userData = { uid: doc.id, ...doc.data() } as AppUser;
                    if (!usersMap.has(userData.uid)) {
                        usersMap.set(userData.uid, userData);
                    }
                });
            });
            setAssignableUsers(Array.from(usersMap.values()));
        } catch(e) {
            console.error("Error fetching users for digitization table", e);
        }
    };

    fetchAssignableUsers();
    
    let unsubscribe: () => void;

    if (searchTerm.trim()) {
        const docRef = doc(db, 'AforoCases', searchTerm.trim().toUpperCase());
        unsubscribe = onSnapshot(docRef, (docSnap) => {
             if (docSnap.exists() && docSnap.data().digitacionStatus) {
                setCases([{ id: docSnap.id, ...docSnap.data() } as AforoCase]);
            } else {
                setCases([]);
            }
            setIsLoading(false);
        });
    } else {
        const qCases = query(
          collection(db, 'AforoCases'),
          where('digitacionStatus', 'in', ['Pendiente de Digitación', 'En Proceso', 'Almacenado']),
          orderBy('revisorStatus', 'desc'),
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(qCases, (snapshot) => {
            const fetchedCases: AforoCase[] = [];
            snapshot.forEach((doc) => {
                fetchedCases.push({ id: doc.id, ...doc.data() } as AforoCase);
            });
            setCases(fetchedCases);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching digitization cases: ", error);
            toast({ title: "Error", description: "No se pudieron cargar los casos para digitación.", variant: "destructive" });
            setIsLoading(false);
        });
    }
    
    return () => unsubscribe();
  }, [searchTerm, toast]);

  const handleAssignDigitador = (caseId: string, digitadorName: string) => {
     handleAutoSave(caseId, 'digitadorAsignado', digitadorName);
     handleAutoSave(caseId, 'digitadorAsignadoAt', Timestamp.now());
  };

  const handleStatusChange = (caseId: string, value: DigitacionStatus) => {
    if (value === 'Completar Trámite') {
        const caseToComplete = cases.find(c => c.id === caseId);
        if (caseToComplete) {
            setSelectedCaseForCompletion(caseToComplete);
        }
    } else {
        handleAutoSave(caseId, 'digitacionStatus', value);
    }
  }

  const openHistoryModal = (caseItem: AforoCase) => setSelectedCaseForHistory(caseItem);
  const openCommentModal = (caseItem: AforoCase) => setSelectedCaseForComment(caseItem);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Cargando registros para digitación...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No hay casos pendientes</h3>
        <p className="mt-1 text-muted-foreground">No hay casos de aforo aprobados esperando digitación.</p>
      </div>
    );
  }
  
  const canEdit = user?.role === 'admin' || user?.role === 'coordinadora';
  const isDigitador = user?.role === 'digitador';

  const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') {
      return <Badge variant="default" className="bg-green-600">{declaracion || 'Trámite Completo'}</Badge>
    }
    if (status) {
      return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>
    }
    return <Badge variant="outline">Pendiente</Badge>;
  }

  return (
    <>
    <div className="overflow-x-auto table-container rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>NE</TableHead>
            <TableHead>Consignatario</TableHead>
            <TableHead>Asignar Digitador</TableHead>
            <TableHead>Estado Digitación</TableHead>
            <TableHead>Declaración Aduanera</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => {
            const isCompleted = caseItem.digitacionStatus === 'Trámite Completo';
            return (
                <TableRow key={caseItem.id} className={savingState[caseItem.id] ? "bg-amber-100" : ""}>
                <TableCell className="font-medium">{caseItem.ne}</TableCell>
                <TableCell>{caseItem.consignee}</TableCell>
                <TableCell>
                    <Select
                        value={caseItem.digitadorAsignado ?? ''}
                        onValueChange={(value) => handleAssignDigitador(caseItem.id, value)}
                        disabled={!canEdit || isCompleted}
                    >
                        <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleccionar digitador..." />
                        </SelectTrigger>
                        <SelectContent>
                        {assignableUsers.map(d => (
                            <SelectItem key={d.uid} value={d.displayName ?? d.email ?? ''}>
                            {d.displayName ?? d.email}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell>
                    <Select
                        value={caseItem.digitacionStatus ?? ''}
                        onValueChange={(value: DigitacionStatus) => handleStatusChange(caseItem.id, value)}
                        disabled={(!isDigitador && !canEdit) || isCompleted}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendiente de Digitación">Pendiente de Digitación</SelectItem>
                            <SelectItem value="En Proceso">En Proceso</SelectItem>
                            <SelectItem value="Almacenado">Almacenado</SelectItem>
                            <SelectItem value="Completar Trámite">Completar Trámite</SelectItem>
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell>
                    {isCompleted ? (
                        <Badge variant="default">{caseItem.declaracionAduanera}</Badge>
                    ) : (
                        <Input
                            placeholder="Ingrese No. Declaración"
                            defaultValue={caseItem.declaracionAduanera ?? ''}
                            onBlur={(e) => handleAutoSave(caseItem.id, 'declaracionAduanera', e.target.value)}
                            disabled={!isDigitador && !canEdit}
                        />
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
                            <DropdownMenuItem onSelect={() => openCommentModal(caseItem)}>
                                <Edit className="mr-2 h-4 w-4" /> Ver/Editar Observación
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(caseItem)}>
                                <History className="mr-2 h-4 w-4" /> Ver Bitácora
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
                </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    {selectedCaseForHistory && (
        <AforoCaseHistoryModal
            isOpen={!!selectedCaseForHistory}
            onClose={() => setSelectedCaseForHistory(null)}
            caseData={selectedCaseForHistory}
        />
    )}
     {selectedCaseForComment && (
        <DigitizationCommentModal
            isOpen={!!selectedCaseForComment}
            onClose={() => setSelectedCaseForComment(null)}
            caseData={selectedCaseForComment}
        />
    )}
    {selectedCaseForCompletion && (
        <CompleteDigitizationModal
            isOpen={!!selectedCaseForCompletion}
            onClose={() => setSelectedCaseForCompletion(null)}
            caseData={selectedCaseForCompletion}
        />
    )}
    </>
  );
}
