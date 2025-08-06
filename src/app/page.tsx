
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
        // User is logged in, redirect them based on their role/type.
        let targetPath = '/examiner'; // Default for 'gestor'
        if (user.isStaticUser || user.role === 'aforador') {
          targetPath = '/database';
        }
        router.push(targetPath);
    }
    // If no user and not loading, stay on this page to show the login button.
  }, [user, loading, router]);


  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // The useEffect hook above will now handle the redirection.
  };

  // While loading, or if user object exists (and redirection is in progress), show a spinner.
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center grid-bg text-white p-4">
      <main className="flex flex-col items-center text-center">
        <div
          id="appLogo"
          className="logo-pulse mb-8 cursor-pointer"
          onClick={() => setIsLoginModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsLoginModalOpen(true)}
          aria-label="Abrir inicio de sesión"
        >
          <FileText className="h-32 w-32 text-white" strokeWidth={1.5} />
        </div>
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold">CustomsEX-p</h1>
          <p className="text-blue-200 mt-1 text-sm md:text-base">Sistema de EXAMENES PREVIOS</p>
        </header>
        <Button 
          onClick={() => setIsLoginModalOpen(true)} 
          className="btn-primary text-lg px-8 py-4"
          size="lg"
        >
          Iniciar Sesión
        </Button>
      </main>

      <footer className="absolute bottom-8 text-center text-sm text-blue-300">
        CustomsEX-p © 2025 ACONIC. Diseñado por Jordy Stvaer.
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
