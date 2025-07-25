
"use client";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileText, LogOut, UserCircle, Camera, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export function AppHeader() {
  const { user, logout, loading } = useAuth();

  const renderAppIdentity = () => (
    <>
      <FileText className="h-8 w-8 text-primary" />
      <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
    </>
  );

  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex justify-between items-center">
          <div className="flex flex-col items-start">
            <Link href="/" className="flex items-center gap-2">
                {renderAppIdentity()}
            </Link>
            {user && !loading && (
              <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground mt-1 md:hidden">
                <UserCircle className="h-5 w-5" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : user ? (
              <>
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCircle className="h-5 w-5" />
                  <span>{user.email}</span>
                </div>
                {user.isStaticUser && (
                   <Button asChild variant="ghost" size="icon" className="text-primary hover:bg-chart-4 hover:text-primary-foreground transition-all duration-300">
                     <Link href="/reports" aria-label="Ir a la página de reportes">
                       <FileSpreadsheet className="h-5 w-5" />
                     </Link>
                   </Button>
                )}
                <Button asChild variant="ghost" size="icon" className="text-primary hover:bg-chart-2 hover:text-primary-foreground transition-all duration-300">
                  <a
                    href="https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=tkoEC0"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir carpeta de fotos en SharePoint"
                  >
                    <Camera className="h-5 w-5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-primary hover:bg-destructive hover:text-destructive-foreground"
                  aria-label="Salir"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            ) : (
               <div className="text-sm text-muted-foreground">No autenticado</div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
