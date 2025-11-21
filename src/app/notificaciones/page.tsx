
"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Inbox, Search, Eye, Bell } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AforoCase } from '@/types';
import { Input } from '@/components/ui/input';
import { IncidentReportDetails } from '@/components/reporter/IncidentReportDetails';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NotificacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [incidents, setIncidents] = useState<AforoCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<AforoCase | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !(user.roleTitle === 'agente aduanero' || user.role === 'admin'))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    let q = query(
      collection(db, 'AforoCases'),
      where('incidentStatus', '==', 'Pendiente')
    );

    // If user is an agent but not admin, filter by their name
    if (user.roleTitle === 'agente aduanero' && user.role !== 'admin') {
      q = query(q, where('revisorAsignado', '==', user.displayName));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
      setIncidents(fetchedIncidents);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching incidents:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredIncidents = useMemo(() => {
    if (!searchTerm) {
      return incidents;
    }
    return incidents.filter(incident =>
      incident.ne.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.consignee.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [incidents, searchTerm]);

  const formatDate = (timestamp: Timestamp | Date | null | undefined): string => {
    if (!timestamp) return 'N/A';
    const d = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    return format(d, "dd MMM, yyyy 'a las' h:mm a", { locale: es });
  };
  
  if (authLoading || !user || !(user.roleTitle === 'agente aduanero' || user.role === 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedIncident) {
    return (
      <AppShell>
        <div className="py-2 md:py-5">
          <IncidentReportDetails
            caseData={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="py-2 md:py-5">
        <Card className="w-full max-w-5xl mx-auto custom-shadow">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2 text-2xl"><Bell /> Centro de Notificaciones de Incidencias</CardTitle>
                  <CardDescription>Aquí se listan todas las solicitudes de rectificación pendientes de revisión.</CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                      placeholder="Buscar por NE o Consignatario..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No hay incidencias pendientes</h3>
                <p className="mt-1 text-muted-foreground">
                  {searchTerm ? 'No se encontraron incidencias para su búsqueda.' : 'No tiene solicitudes de rectificación por revisar.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto table-container rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NE</TableHead>
                      <TableHead>Consignatario</TableHead>
                      <TableHead>Reportado Por</TableHead>
                      <TableHead>Fecha Reporte</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.map(incident => (
                      <TableRow key={incident.id}>
                        <TableCell className="font-medium">{incident.ne}</TableCell>
                        <TableCell>{incident.consignee}</TableCell>
                        <TableCell><Badge variant="outline">{incident.incidentReportedBy}</Badge></TableCell>
                        <TableCell>{formatDate(incident.incidentReportedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={incident.incidentStatus === 'Pendiente' ? 'secondary' : 'default'}>
                            {incident.incidentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="default" size="sm" onClick={() => setSelectedIncident(incident)}>
                                <Eye className="mr-2 h-4 w-4" /> Revisar Esquela
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
