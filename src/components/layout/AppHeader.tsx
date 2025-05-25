
"use client";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileText, LogOut, UserCircle } from 'lucide-react';
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
            {user?.isStaticUser ? (
              <div className="flex items-center gap-2 cursor-default">
                {renderAppIdentity()}
              </div>
            ) : (
              <Link href="/examiner" className="flex items-center gap-2">
                {renderAppIdentity()}
              </Link>
            )}
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
