
"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import type { AppUser, ExamRequest, ExamDocument } from '@/types';
import { Badge } from '@/components/ui/badge';


export default function AssignmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [gestores, setGestores] = useState<AppUser[]>([]);
  const [selectedGestor, setSelectedGestor] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch pending requests
      const requestsQuery = query(collection(db, "solicitudesExamen"), where("status", "==", "pendiente"));
      const requestsSnapshot = await getDocs(requestsQuery);
      const pendingRequests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamRequest));
      pendingRequests.sort((a,b) => (a.requestedAt?.toMillis() ?? 0) - (b.requestedAt?.toMillis() ?? 0));
      setRequests(pendingRequests);

      // Fetch available gestores
      const gestoresQuery = query(collection(db, "users"), where("role", "==", "gestor"));
      const gestoresSnapshot = await getDocs(gestoresQuery);
      const availableGestores = gestoresSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setGestores(availableGestores);

    } catch (err) {
      console.error("Error fetching data: ", err);
      setError("No se pudieron cargar los datos. Por favor, intente de nuevo.");
      toast({ title: "Error de Carga", description: "Ocurrió un error al buscar solicitudes y gestores.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'coordinadora') {
        router.push('/');
      } else {
        fetchData();
      }
    }
  }, [user, authLoading, router]);

  const handleAssign = async (requestId: string, ne: string) => {
    const gestorId = selectedGestor[requestId];
    if (!gestorId) {
      toast({ title: "Error de Asignación", description: "Por favor, seleccione un gestor.", variant: "destructive" });
      return;
    }

    const gestor = gestores.find(g => g.uid === gestorId);
    if (!gestor) {
      toast({ title: "Error de Asignación", description: "El gestor seleccionado no es válido.", variant: "destructive" });
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Update the request status
      const requestRef = doc(db, "solicitudesExamen", requestId);
      batch.update(requestRef, {
        status: 'asignado',
        assignedTo: gestor.displayName || gestor.email,
        assignedAt: serverTimestamp()
      });

      // 2. Create the new exam document
      const originalRequest = requests.find(r => r.id === requestId);
      if (!originalRequest) throw new Error("Could not find original request data.");

      const newExamRef = doc(db, "examenesPrevios", ne.toUpperCase());
      const newExamData: Omit<ExamDocument, 'id'> = {
        ne: ne.toUpperCase(),
        reference: originalRequest.reference,
        consignee: originalRequest.consignee,
        manager: gestor.displayName || gestor.email || 'N/A', // Assigning manager as the gestor
        location: originalRequest.location,
        products: [],
        savedBy: user?.email || 'N/A', // Log who assigned it as initial save
        status: 'incomplete',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        completedAt: null,
        requestedBy: originalRequest.requestedBy,
        requestedAt: originalRequest.requestedAt,
        assignedTo: gestor.displayName || gestor.email,
        assignedAt: serverTimestamp()
      };
      batch.set(newExamRef, newExamData);

      await batch.commit();

      toast({ title: "Asignación Exitosa", description: `El examen NE: ${ne} fue asignado a ${gestor.displayName}.` });

      // Refresh data
      fetchData();

    } catch (err) {
      console.error("Error during assignment: ", err);
      toast({ title: "Error al Asignar", description: "No se pudo completar la asignación. Intente de nuevo.", variant: "destructive" });
    }
  };

  const handleSelectChange = (requestId: string, gestorId: string) => {
    setSelectedGestor(prev => ({ ...prev, [requestId]: gestorId }));
  };

  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });
  };
  

  if (authLoading || !user || user.role !== 'coordinadora' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-6xl mx-auto custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Panel de Asignaciones</CardTitle>
            <CardDescription>Asigne exámenes previos solicitados a los gestores disponibles.</CardDescription>
          </CardHeader>
          <CardContent>
             {error && (
              <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-center flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5"/> {error}
              </div>
            )}

            {!isLoading && requests.length === 0 && !error && (
               <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-medium text-foreground">Todo al día</h3>
                <p className="mt-1 text-muted-foreground">No hay solicitudes de exámenes pendientes por asignar.</p>
              </div>
            )}

            {!isLoading && requests.length > 0 && (
                <div className="overflow-x-auto table-container rounded-lg border mt-4">
                 <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead>NE</TableHead>
                            <TableHead>Consignatario</TableHead>
                            <TableHead>Solicitado Por</TableHead>
                            <TableHead>Fecha Solicitud</TableHead>
                            <TableHead>Asignar a Gestor</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => (
                           <TableRow key={req.id}>
                               <TableCell className="font-medium">{req.ne}</TableCell>
                               <TableCell>{req.consignee}</TableCell>
                               <TableCell><Badge variant="outline">{req.requestedBy}</Badge></TableCell>
                               <TableCell>{formatTimestamp(req.requestedAt)}</TableCell>
                               <TableCell>
                                 <Select onValueChange={(value) => handleSelectChange(req.id, value)}>
                                    <SelectTrigger className="w-[220px]">
                                        <SelectValue placeholder="Seleccionar gestor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {gestores.map(g => (
                                            <SelectItem key={g.uid} value={g.uid}>{g.displayName || g.email}</SelectItem>
                                        ))}
                                    </SelectContent>
                                 </Select>
                               </TableCell>
                               <TableCell className="text-right">
                                   <Button size="sm" onClick={() => handleAssign(req.id, req.ne)} disabled={!selectedGestor[req.id]}>
                                     Asignar
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
  );
}
