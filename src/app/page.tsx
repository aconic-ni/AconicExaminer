
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, BookCopy } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';

type LoginTarget = 'examiner' | 'reporter';

export default function HomePage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginTarget, setLoginTarget] = useState<LoginTarget>('examiner');
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (loginTarget === 'reporter') {
        if (user.hasReportsAccess) {
          router.push('/thereporter');
        } else {
          router.push('/thereporter/pending');
        }
      } else {
        // Default 'examiner' flow
        let targetPath = '/examiner'; // Default for 'gestor'
        if (user.role === 'admin') {
          targetPath = '/admin';
        } else if (user.role === 'aforador') {
          targetPath = '/database';
        } else if (user.role === 'ejecutivo') {
          targetPath = '/executive';
        } else if (user.role === 'coordinadora') {
          targetPath = '/executive';
        }
        router.push(targetPath);
      }
    }
  }, [user, loading, router, loginTarget]);

  const handleOpenLogin = (target: LoginTarget) => {
    setLoginTarget(target);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // The useEffect will handle redirection
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between md:justify-center grid-bg text-white p-4 gap-y-8">
      <main className="flex flex-col md:flex-row items-center gap-x-4 gap-y-8 mt-auto md:mt-0">
        <Card className="w-80 h-96 bg-card text-card-foreground rounded-xl custom-shadow flex flex-col justify-center">
            <CardContent className="flex flex-col items-center justify-center text-center gap-6 p-8">
                <FileText className="h-20 w-20 text-primary" strokeWidth={1.5} />
                <div className="space-y-1">
                    <CardTitle className="text-3xl font-bold">CustomsEX-p</CardTitle>
                    <CardDescription className="text-sm">Sistema de EXÁMENES PREVIOS</CardDescription>
                </div>
                <Button onClick={() => handleOpenLogin('examiner')} className="btn-primary w-40">
                Iniciar Sesión
                </Button>
            </CardContent>
        </Card>

        <Card className="w-80 h-96 bg-card text-card-foreground rounded-xl custom-shadow flex flex-col justify-center">
            <CardContent className="flex flex-col items-center justify-center text-center gap-6 p-8">
                <BookCopy className="h-20 w-20 text-primary" strokeWidth={1.5} />
                <div className="space-y-1">
                    <CardTitle className="text-3xl font-bold">Customs Reports</CardTitle>
                    <CardDescription className="text-sm">Sistema de Gestión de Reportes</CardDescription>
                </div>
                <Button onClick={() => handleOpenLogin('reporter')} className="btn-primary w-40">
                Iniciar Sesión
                </Button>
            </CardContent>
        </Card>
      </main>

      <footer className="text-center text-sm text-blue-300 mt-auto md:mt-0">
        Stvaer © 2025 for ACONIC
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        targetSystem={loginTarget}
      />
    </div>
  );
}
