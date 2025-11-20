
"use client";
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, FileSpreadsheet, Edit, Eye, Printer, MoreHorizontal } from 'lucide-react';
import { WorksheetModal } from '@/components/executive/WorksheetModal';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Worksheet } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorksheetDetails } from '@/components/executive/WorksheetDetails';

export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState(true);
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ejecutivo')) {
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
      const fetchedWorksheets = querySnapshot.docs.map(doc => doc.data() as Worksheet);
      setWorksheets(fetchedWorksheets);
    } catch (error) {
      console.error("Error fetching worksheets: ", error);
    } finally {
      setIsLoadingWorksheets(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorksheets();
  }, [fetchWorksheets]);
  
  const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
    return format(d, "dd MMM, yyyy 'a las' h:mm a", { locale: es });
  };
  
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

        <Card className="w-full max-w-5xl mx-auto custom-shadow">
            <CardHeader>
                <CardTitle>Mis Hojas de Trabajo Creadas</CardTitle>
                <CardDescription>Un listado de los registros que ha generado.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingWorksheets ? (
                     <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : worksheets.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">No ha creado ninguna hoja de trabajo.</p>
                ) : (
                    <div className="overflow-x-auto table-container rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>NE</TableHead>
                                    <TableHead>Consignatario</TableHead>
                                    <TableHead>Fecha Creación</TableHead>
                                    <TableHead>Modo Transporte</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {worksheets.map(ws => (
                                    <TableRow key={ws.id}>
                                        <TableCell className="font-medium">{ws.ne}</TableCell>
                                        <TableCell>{ws.consignee}</TableCell>
                                        <TableCell>{formatDate(ws.createdAt)}</TableCell>
                                        <TableCell className="capitalize">{ws.transportMode}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedWorksheet(ws)}>
                                                <Eye className="mr-2 h-4 w-4" /> Ver
                                            </Button>
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
    <WorksheetModal isOpen={isWorksheetModalOpen} onClose={() => setIsWorksheetModalOpen(false)} onWorksheetCreated={fetchWorksheets} />
    </>
  );
}
