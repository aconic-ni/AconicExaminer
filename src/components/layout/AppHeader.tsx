"use client";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileText, LogOut, UserCircle } from 'lucide-react';
import Link from 'next/link';

export function AppHeader() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex justify-between items-center">
          <Link href="/examiner" className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
          </Link>
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : user ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCircle className="h-5 w-5" />
                  <span>{user.email}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Salir
                </Button>
              </>
            ) : (
               <div className="text-sm text-muted-foreground">No autenticado</div>
            )}
             <div className="text-sm text-muted-foreground hidden md:block">ACONIC • 2025</div>
          </div>
        </div>
      </div>
    </header>
  );
}
