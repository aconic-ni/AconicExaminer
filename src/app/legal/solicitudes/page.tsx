"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function LegalSolicitudesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowedRoles = ['legal', 'admin'];

   useEffect(() => {
    if (!authLoading) {
      if (!user || !allowedRoles.includes(user.role as string)) {
        router.push('/');
      } else {
        // Fetch data here
        setIsLoading(false);
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !allowedRoles.includes(user.role as string) || isLoading) {
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
            <CardTitle className="text-2xl font-semibold">Panel de Solicitudes Legales</CardTitle>
            <CardDescription>Gestione las solicitudes de servicios legales pendientes.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-center py-10 px-6 bg-secondary/30 rounded-lg">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-medium text-foreground">Próximamente</h3>
                <p className="mt-1 text-muted-foreground">El panel de gestión de solicitudes legales está en construcción.</p>
              </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
