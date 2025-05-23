import type React from 'react';
import { AppHeader } from './AppHeader';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        CustomsEX-p © {new Date().getFullYear()} ACONIC. Diseñado por Jordy Stvaer.
      </footer>
    </div>
  );
}
