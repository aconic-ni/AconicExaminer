
"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, collectionGroup } from 'firebase/firestore';
import type { ExamDocument, AforoCase, Worksheet, SolicitudRecord } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PrevioDashboard } from '@/components/dashboard/PrevioDashboard';
import { AforoDashboard } from '@/components/dashboard/AforoDashboard';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allExams, setAllExams] = useState<ExamDocument[]>([]);
  const [allAforoCases, setAllAforoCases] = useState<AforoCase[]>([]);
  const [allWorksheets, setAllWorksheets] = useState<Worksheet[]>([]);
  const [allSolicitudes, setAllSolicitudes] = useState<SolicitudRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowedRoles = ['aforador', 'coordinadora', 'admin', 'ejecutivo'];

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [examsSnap, aforoSnap, worksheetsSnap, solicitudesSnap, memorandumSnap] = await Promise.all([
          getDocs(query(collection(db, "examenesPrevios"), orderBy("ne", "desc"))),
          getDocs(query(collection(db, "AforoCases"), orderBy("ne", "desc"))),
          getDocs(query(collection(db, "worksheets"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "SolicitudCheques"), orderBy("savedAt", "desc"))),
          getDocs(query(collection(db, "Memorandum"), orderBy("savedAt", "desc"))),
      ]);
      
      const fetchedExams = examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamDocument));
      setAllExams(fetchedExams.filter(exam => exam.isArchived !== true));
      
      const fetchedAforoCases = aforoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AforoCase));
      setAllAforoCases(fetchedAforoCases);
      
      const fetchedWorksheets = worksheetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worksheet));
      setAllWorksheets(fetchedWorksheets);

      const combinedSolicitudes: SolicitudRecord[] = [];
      solicitudesSnap.forEach(doc => combinedSolicitudes.push({ solicitudId: doc.id, ...doc.data() } as SolicitudRecord));
      memorandumSnap.forEach(doc => combinedSolicitudes.push({ solicitudId: doc.id, ...doc.data() } as SolicitudRecord));
      setAllSolicitudes(combinedSolicitudes);

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError("No se pudieron cargar los datos para el dashboard. Verifique los permisos y los índices de Firestore.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
        if (!user || !allowedRoles.includes(user.role as string)) {
            router.push('/');
        } else {
            fetchData();
        }
    }
  }, [user, authLoading, router]);


  if (authLoading || !user || !allowedRoles.includes(user.role as string)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4">Cargando datos de los dashboards...</p></div>;
  }
  
  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-700 p-4">{error}</div>;
  }
  
  const getDefaultTab = () => {
    if(user.role === 'ejecutivo') return 'ejecutivo';
    if(user.role === 'admin') return 'ejecutivo';
    if(user.role === 'coordinadora' || user.role === 'aforador') return 'previos';
    return 'ejecutivo';
  }

  return (
    <AppShell>
        <Tabs defaultValue={getDefaultTab()} className="space-y-4">
            <div className="flex items-center justify-between">
                <TabsList>
                    {(user.role === 'ejecutivo' || user.role === 'admin' || user.role === 'coordinadora') && <TabsTrigger value="ejecutivo">Dashboard Ejecutivo</TabsTrigger>}
                    {(user.role === 'coordinadora' || user.role === 'aforador' || user.role === 'admin') && <TabsTrigger value="previos">Dashboard de Previos</TabsTrigger>}
                    {(user.role === 'coordinadora' || user.role === 'aforador' || user.role === 'admin') && <TabsTrigger value="aforo">Dashboard de Aforo</TabsTrigger>}
                </TabsList>
            </div>
            {(user.role === 'ejecutivo' || user.role === 'admin' || user.role === 'coordinadora') && (
              <TabsContent value="ejecutivo">
                  <ExecutiveDashboard 
                    allCases={allAforoCases} 
                    allWorksheets={allWorksheets}
                    allSolicitudes={allSolicitudes}
                  />
              </TabsContent>
            )}
            {(user.role === 'coordinadora' || user.role === 'aforador' || user.role === 'admin') && (
              <>
                <TabsContent value="previos">
                    <PrevioDashboard allExams={allExams} />
                </TabsContent>
                <TabsContent value="aforo">
                    <AforoDashboard allCases={allAforoCases} />
                </TabsContent>
              </>
            )}
        </Tabs>
    </AppShell>
  );
}
