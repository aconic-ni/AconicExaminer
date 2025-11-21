
"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { FileSpreadsheet, LogOut, UserCircle, Camera, ListTodo, Database, Home, Menu, X, Shield, PieChart, Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import type { UserRole } from '@/types';
import { IncidentNotificationPanel } from '../reporter/IncidentNotificationPanel';


interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: (UserRole | 'all')[];
  isExternal?: boolean;
  requiresReportsAccess?: boolean;
  isAgentSpecific?: boolean;
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Admin', icon: Shield, roles: ['admin'] },
  { href: '/assignments', label: 'Asignaciones', icon: ListTodo, roles: ['coordinadora', 'admin'] },
  { href: '/dashboard', label: 'Dashboard', icon: PieChart, roles: ['aforador', 'coordinadora', 'admin'] },
  { href: '/database', label: 'Base de datos', icon: Database, roles: ['all'] },
  { href: 'https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=tkoEC0', label: 'Fotos', icon: Camera, roles: ['all'], isExternal: true },
];

const renderAppIdentity = () => (
  <div className="flex items-center gap-2">
    <FileSpreadsheet className="h-8 w-8 text-primary" />
    <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
  </div>
);


export function AppHeader() {
  const { user, logout, loading } = useAuth();
  
  const accessibleNavItems = navItems.filter(item => {
      if (!user) return false;
      if (user.role === 'admin') return !item.isAgentSpecific;
      return item.roles.includes('all') || (user.role && item.roles.includes(user.role));
  });

  const NavLink: React.FC<{item: NavItem, isMobile?: boolean}> = ({ item, isMobile = false }) => {
    const commonProps = {
      variant: "ghost" as const,
      className: isMobile ? "w-full justify-start text-base gap-4" : "text-primary hover:bg-accent hover:text-accent-foreground transition-all duration-300"
    };

    const content = (
      <>
        <item.icon className="h-5 w-5" />
        {isMobile && <span>{item.label}</span>}
      </>
    );
    
    const buttonContent = (
       item.isExternal ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
          <Button {...commonProps} size={isMobile ? "default" as const : "icon" as const} asChild={false}>
            {content}
          </Button>
        </a>
       ) : (
        <Link href={item.href} passHref>
           <Button {...commonProps} size={isMobile ? "default" as const : "icon" as const} asChild={false}>
             {content}
          </Button>
        </Link>
       )
    );
    
     const mobileButton = (
        <SheetClose asChild>
            {buttonContent}
        </SheetClose>
    );


    if (isMobile) {
      return mobileButton;
    }
    
    // Desktop Version with Tooltip
    return (
       <Tooltip>
        <TooltipTrigger asChild>
           {buttonContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };


  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex justify-between items-center">
           <Link href="/">{renderAppIdentity()}</Link>
          
          <TooltipProvider>
            <div className="hidden md:flex items-center gap-1">
              {loading ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : user ? (
                <>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                        {(user.roleTitle || user.role) && <Badge variant="secondary">{user.roleTitle || user.role}</Badge>}
                        <UserCircle className="h-5 w-5" />
                        <span>{user.email}</span>
                   </div>
                  {((user.role === 'agente' || user.roleTitle === 'agente aduanero') || user.role === 'admin') && <IncidentNotificationPanel />}
                  {accessibleNavItems.map(item => (
                    <NavLink key={item.href} item={item} />
                  ))}

                  {/* Reports Dropdown */}
                  <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-primary hover:bg-accent hover:text-accent-foreground transition-all duration-300">
                                <FileSpreadsheet className="h-5 w-5" />
                              </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Reportes</p></TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                           <Link href="/reports"><PieChart className="mr-2 h-4 w-4"/> Reportes de Previos</Link>
                        </DropdownMenuItem>
                        {user.hasReportsAccess && (
                          <DropdownMenuItem asChild>
                            <Link href="/thereporter"><Search className="mr-2 h-4 w-4"/> Reportes de Aforo</Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                  </DropdownMenu>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        className="text-primary hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Salir"
                      >
                        <LogOut className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Salir</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No autenticado</div>
              )}
            </div>
          </TooltipProvider>

          <div className="md:hidden">
             {user && (
                 <Sheet>
                   <SheetTrigger asChild>
                      <Button variant="default" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Abrir menú</span>
                      </Button>
                   </SheetTrigger>
                   <SheetContent side="right" className="w-[250px] p-0 flex flex-col">
                        <div className="p-2 flex justify-end">
                            <SheetClose asChild>
                                <Button variant="destructive" size="icon">
                                <X className="h-6 w-6" />
                                <span className="sr-only">Close</span>
                                </Button>
                            </SheetClose>
                        </div>
                        <SheetHeader>
                           <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                        </SheetHeader>

                      {/* User Info and Nav */}
                       <div className="flex flex-col items-center gap-4 p-4 pt-0 border-b">
                         <div className="flex items-center justify-center gap-2">
                            <FileSpreadsheet className="h-8 w-8 text-primary" />
                            <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
                          </div>
                          {(user.roleTitle || user.role) && <Badge variant="secondary" className="mx-auto">{user.roleTitle || user.role}</Badge>}
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <UserCircle className="h-5 w-5" />
                              <span className="truncate">{user.email}</span>
                          </div>
                          {((user.role === 'agente' || user.roleTitle === 'agente aduanero') || user.role === 'admin') && (
                            <div className="mt-2 w-full">
                              <IncidentNotificationPanel isMobile={true} />
                            </div>
                           )}
                      </div>

                      <nav className="flex flex-col gap-2 p-4 flex-1">
                        {accessibleNavItems.map(item => (
                          <NavLink key={item.href} item={item} isMobile />
                        ))}
                        {/* Mobile Reports Links */}
                        <SheetClose asChild>
                           <Link href="/reports">
                             <Button variant="ghost" className="w-full justify-start text-base gap-4"><PieChart className="h-5 w-5" />Reportes de Previos</Button>
                           </Link>
                        </SheetClose>
                        {user.hasReportsAccess && (
                           <SheetClose asChild>
                             <Link href="/thereporter">
                                <Button variant="ghost" className="w-full justify-start text-base gap-4"><Search className="h-5 w-5" />Reportes de Aforo</Button>
                             </Link>
                           </SheetClose>
                        )}

                         <Button onClick={logout} variant="ghost" className="w-full justify-start text-base gap-4 text-destructive hover:text-destructive mt-auto">
                           <LogOut className="h-5 w-5" />
                           <span>Salir</span>
                         </Button>
                      </nav>
                   </SheetContent>
                 </Sheet>
             )}
          </div>
        </div>
      </div>
    </header>
  );
}
