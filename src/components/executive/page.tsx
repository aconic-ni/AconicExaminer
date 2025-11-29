
"use client";
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, FileSpreadsheet, Edit } from 'lucide-react';
import { WorksheetModal } from '@/components/executive/WorksheetModal';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, getDoc } from 'firebase/firestore';
import type { Worksheet, AforoCase, AppUser } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorksheetDetails } from '@/components/executive/WorksheetDetails';
import { useAppContext } from '@/context/AppContext';
import { AssignUserModal } from '../reporter/AssignUserModal';
import { useToast } from '../ui/use-toast';

export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { caseToAssignAforador, setCaseToAssignAforador } = useAppContext();

  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState(true);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);

  const [assignableUsers, setAssignableUsers] = useState<AppUser[]>([]);
  
  useEffect(() => {
    if (caseToAssignAforador) {
      // The modal will be triggered by this state change
    }
  }, [caseToAssignAforador]);

  useEffect(() => {
    if (!authLoading && (!user || !['ejecutivo', 'coordinadora', 'admin'].includes(user.role || ''))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchWorksheets = useCallback(async () => {
    if (!user) return;
    setIsLoadingWorksheets(true);
    try {
      const q = query(
        collection(db, 'worksheets'),
        where('createdBy', '==', user.email),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedWorksheets = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Worksheet);
      setWorksheets(fetchedWorksheets);
    } catch (error) {
      console.error("Error fetching worksheets: ", error);
    } finally {
      setIsLoadingWorksheets(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorksheets();
    
    const fetchAssignableUsers = async () => {
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'aforador'));
        const querySnapshot = await getDocs(usersQuery);
        const users = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        setAssignableUsers(users);
    };

    fetchAssignableUsers();
  }, [fetchWorksheets]);

  const handleAssignAforador = async (caseId: string, aforadorName: string) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    const caseDocRef = doc(db, 'AforoCases', caseId);
    try {
        await updateDoc(caseDocRef, { 
            aforador: aforadorName,
            assignmentDate: Timestamp.now(),
            aforadorStatusLastUpdate: { by: user.displayName, at: Timestamp.now() }
        });
        toast({ title: 'Aforador Asignado', description: `${aforadorName} ha sido asignado al caso.` });
        setCaseToAssignAforador(null);
    } catch (error) {
        console.error('Error assigning aforador:', error);
        toast({ title: 'Error', description: 'No se pudo asignar el aforador.', variant: 'destructive' });
    }
  };
  
  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    return format(d, 'dd/MM/yy HH:mm', { locale: es });
  };
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Ejecutivo';

  if (authLoading || !user || !['ejecutivo', 'coordinadora', 'admin'].includes(user.role || '')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedWorksheet) {
    return (
        <AppShell>
            <div className="py-2 md:py-5 w-full max-w-5xl mx-auto">
                 <WorksheetDetails worksheet={selectedWorksheet} onClose={() => setSelectedWorksheet(null)} />
            </div>
        </AppShell>
    )
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
                <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
                     <Button asChild size="lg" className="h-16 text-lg">
                        <Link href="/executive/request">
                            <FilePlus className="mr-3 h-6 w-6" />
                            Solicitar Examen Previo
                        </Link>
                    </Button>
                     <Button size="lg" variant="default" className="h-16 text-lg" onClick={() => setIsWorksheetModalOpen(true)}>
                        <Edit className="mr-3 h-6 w-6" />
                        Hojas de Trabajo
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-16 text-lg">
                        <Link href="/database">
                           <Search className="mr-3 h-6 w-6" />
                           Buscar en Base de Datos
                        </Link>
                    </Button>
                     <Button asChild size="lg" variant="outline" className="h-16 text-lg">
                        <Link href="/reports">
                            <FileSpreadsheet className="mr-3 h-6 w-6" />
                            Revisar Reportes
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

      </div>
    </AppShell>
    <WorksheetModal isOpen={isWorksheetModalOpen} onClose={() => setIsWorksheetModalOpen(false)} onWorksheetCreated={fetchWorksheets} />
     {caseToAssignAforador && (
        <AssignUserModal
            isOpen={!!caseToAssignAforador}
            onClose={() => setCaseToAssignAforador(null)}
            caseData={caseToAssignAforador}
            assignableUsers={assignableUsers}
            onAssign={handleAssignAforador}
            title="Asignar Aforador (PSMT)"
            description={`Como el consignatario es PSMT, debe asignar un aforador para el caso NE: ${caseToAssignAforador.ne}.`}
        />
     )}
    </>
  );
}
