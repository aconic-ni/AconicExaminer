
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, ShieldCheck, Clock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { ReportAccessRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type ViewMode = 'pending' | 'processed';

export default function AuthorizePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ReportAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusQuery = viewMode === 'pending'
        ? where("status", "==", "pending")
        : where("status", "in", ["approved", "denied"]);

      const q = query(collection(db, 'reportAccessRequests'), statusQuery);
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReportAccessRequest));
      fetchedRequests.sort((a,b) => (b.requestedAt?.toMillis() ?? 0) - (a.requestedAt?.toMillis() ?? 0));
      setRequests(fetchedRequests);
    } catch (error) {
      console.error("Error fetching access requests:", error);
      toast({ title: 'Error', description: 'No se pudieron cargar las solicitudes.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, viewMode]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/');
      } else {
        fetchRequests();
      }
    }
  }, [user, authLoading, router, fetchRequests]);
  
  const handleRequest = async (userId: string, newStatus: 'approved' | 'denied') => {
    try {
      // Update the user document
      if (newStatus === 'approved') {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { hasReportsAccess: true });
      }

      // Update the request document
      const requestDocRef = doc(db, 'reportAccessRequests', userId);
      await updateDoc(requestDocRef, {
        status: newStatus,
        processedAt: serverTimestamp(),
      });

      toast({
        title: 'Solicitud Procesada',
        description: `El acceso ha sido ${newStatus === 'approved' ? 'aprobado' : 'denegado'}.`
      });

      // Refresh the list
      fetchRequests();

    } catch (error) {
      console.error('Error processing request:', error);
      toast({ title: 'Error', description: 'No se pudo procesar la solicitud.', variant: 'destructive' });
    }
  };
  
  const formatTimestamp = (timestamp: Timestamp | undefined) => {
      if (!timestamp) return 'N/A';
      return timestamp.toDate().toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });
  }

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-4xl mx-auto custom-shadow">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck /> Autorizar Acceso a CustomsReports
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Gestione las solicitudes de los usuarios para acceder al módulo de reportes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button variant={viewMode === 'pending' ? 'secondary' : 'ghost'} onClick={() => setViewMode('pending')}>
                <Clock className="mr-2 h-4 w-4" /> Pendientes
              </Button>
              <Button variant={viewMode === 'processed' ? 'secondary' : 'ghost'} onClick={() => setViewMode('processed')}>
                <CheckCircle className="mr-2 h-4 w-4" /> Procesadas
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">No hay solicitudes {viewMode === 'pending' ? 'pendientes' : 'procesadas'}.</div>
            ) : (
              <div className="overflow-x-auto table-container rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email del Usuario</TableHead>
                      <TableHead>Fecha de Solicitud</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.userEmail}</TableCell>
                        <TableCell>{formatTimestamp(req.requestedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            req.status === 'approved' ? 'default' : 
                            req.status === 'denied' ? 'destructive' : 'secondary'
                          }>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleRequest(req.userId, 'denied')}>
                                <XCircle className="mr-2 h-4 w-4" /> Rechazar
                              </Button>
                              <Button size="sm" onClick={() => handleRequest(req.userId, 'approved')}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Procesado el {formatTimestamp(req.processedAt)}</span>
                          )}
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
