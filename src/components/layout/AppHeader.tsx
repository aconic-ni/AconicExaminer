
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
        {/* This div is now always a row, controlling alignment of left and right content */}
        <div className="flex justify-between items-center">
          {/* App Logo, Name, and Mobile User Info (stacked vertically) */}
          <div className="flex flex-col items-start">
            <Link href="/examiner" className="flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
            </Link>
            {/* User Info for Mobile View - stays below the app name */}
            {user && !loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 md:hidden">
                <UserCircle className="h-5 w-5" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          {/* Actions (logout, loading, unauthenticated) and Desktop User Info */}
          {/* This block is now directly a child of the main flex row, aligned to the right */}
          <div className="flex items-center gap-2 sm:gap-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : user ? (
              <>
                {/* User Info for Desktop View - hidden on mobile */}
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
