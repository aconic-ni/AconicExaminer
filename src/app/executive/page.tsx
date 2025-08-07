
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FilePlus, Search, FileSpreadsheet } from 'lucide-react';

export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ejecutivo')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || user.role !== 'ejecutivo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Ejecutivo';

  return (
    <AppShell>
      <div className="py-2 md:py-5">
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
  );
}
