
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button'; // Added import for Button

export default function HomePage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/examiner');
    }
  }, [user, loading, router]);

  const handleLoginSuccess = () => {
    router.push('/examiner');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <p className="text-white text-xl">Cargando...</p>
      </div>
    );
  }

  if (user) {
    // This case should ideally be handled by the useEffect redirect,
    // but as a fallback or for instantaneous UI update:
    return (
       <div className="min-h-screen flex items-center justify-center grid-bg">
        <p className="text-white text-xl">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center grid-bg text-white p-4">
      <main className="flex flex-col items-center">
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
        <header className="text-center mb-8">
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

      <footer className="absolute bottom-8 text-center text-xs text-blue-300">
        <p>Diseñado por Jordy Stvaer © 2025</p>
        <p>ACONIC</p>
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
