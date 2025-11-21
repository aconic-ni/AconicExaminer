
"use client";
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, PartyPopper, PlusCircle, ChevronDown, Search, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AforoCaseModal } from '@/components/reporter/AforoCaseModal';
import { DailyAforoCasesTable } from '@/components/reporter/DailyAforoCasesTable';
import { DigitizationCasesTable } from '@/components/reporter/DigitizationCasesTable';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/reports/DatePickerWithRange';
import type { DateRange } from 'react-day-picker';
import type { AforoCase, AppUser, AforoCaseUpdate } from '@/types';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadAforoCasesAsExcel } from '@/lib/fileExporter';

export default function TheReporterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAforoModalOpen, setIsAforoModalOpen] = useState(false);
  
  // State for filter inputs
  const [neInput, setNeInput] = useState('');
  const [consigneeInput, setConsigneeInput] = useState('');
  const [dateRangeInput, setDateRangeInput] = useState<DateRange | undefined>();
  
  // State for applied filters
  const [appliedFilters, setAppliedFilters] = useState({
    ne: '',
    consignee: '',
    dateRange: undefined as DateRange | undefined,
  });

  const [filteredCases, setFilteredCases] = useState<AforoCase[]>([]);
  const [isExporting, setIsExporting] = useState(false);


  const canCreateReport = user?.role === 'aforador' || user?.role === 'admin';


  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (!user.hasReportsAccess) {
        router.push('/thereporter/pending');
      }
    }
  }, [user, loading, router]);

  const handleSearch = () => {
    setAppliedFilters({
      ne: neInput,
      consignee: consigneeInput,
      dateRange: dateRangeInput,
    });
  };

  const handleExport = async () => {
    if (filteredCases.length === 0) return;
    setIsExporting(true);
    
    try {
        const auditLogs: (AforoCaseUpdate & { caseNe: string })[] = [];

        for (const caseItem of filteredCases) {
            const logsQuery = query(collection(db, 'AforoCases', caseItem.id, 'actualizaciones'));
            const logSnapshot = await getDocs(logsQuery);
            logSnapshot.forEach(doc => {
                auditLogs.push({
                    ...(doc.data() as AforoCaseUpdate),
                    caseNe: caseItem.ne
                });
            });
        }
        
        downloadAforoCasesAsExcel(filteredCases, auditLogs);
    } catch (e) {
        console.error("Error exporting data with audit logs: ", e);
    } finally {
        setIsExporting(false);
    }
};

  const clearFilters = () => {
    setNeInput('');
    setConsigneeInput('');
    setDateRangeInput(undefined);
    setAppliedFilters({ ne: '', consignee: '', dateRange: undefined });
  }

  if (loading || !user || !user.hasReportsAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const welcomeName = user?.displayName ? user.displayName.split(' ')[0] : 'Usuario';


  return (
    <AppShell>
      <div className="space-y-6">
        <Card className="w-full mx-auto custom-shadow text-center">
          <CardHeader>
            <div className="flex justify-center items-center gap-4">
              <PartyPopper className="h-12 w-12 text-primary" strokeWidth={1.5} />
              <CardTitle className="text-4xl font-bold">¡Bienvenido a Customs Reports, {welcomeName}!</CardTitle>
            </div>
            <CardDescription className="text-lg text-muted-foreground pt-2">
              Aquí encontrarás las funcionalidades para la gestión avanzada de reportes.
            </CardDescription>
          </CardHeader>
        </Card>
        
        <Tabs defaultValue="aforo" className="w-full">
            <Card>
                 <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <TabsList>
                                <TabsTrigger value="aforo">Aforo</TabsTrigger>
                                <TabsTrigger value="digitacion">Digitación</TabsTrigger>
                            </TabsList>
                             {canCreateReport && (
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button>
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Crear Registro
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuLabel>Tipo de Registro</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => setIsAforoModalOpen(true)}>
                                            Registro de Aforo
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>Registro de Incidencia (próximamente)</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <div className="border-t pt-4">
                            <p className="text-sm font-medium mb-2 text-muted-foreground">Filtros de Búsqueda</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Input placeholder="Buscar por NE..." value={neInput} onChange={(e) => setNeInput(e.target.value)} />
                                <Input placeholder="Buscar por Consignatario..." value={consigneeInput} onChange={(e) => setConsigneeInput(e.target.value)} />
                                <DatePickerWithRange date={dateRangeInput} onDateChange={setDateRangeInput} />
                                <div className="lg:col-span-3 flex justify-end gap-2">
                                    <Button variant="outline" onClick={clearFilters}>Limpiar Filtros</Button>
                                    <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                                     <Button onClick={handleExport} disabled={filteredCases.length === 0 || isExporting}>
                                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                        {isExporting ? 'Exportando...' : 'Exportar a Excel'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <TabsContent value="aforo">
                        <DailyAforoCasesTable 
                           filters={appliedFilters} 
                           setFilteredCases={setFilteredCases}
                        />
                    </TabsContent>
                    <TabsContent value="digitacion">
                        <DigitizationCasesTable searchTerm={neInput} />
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
      </div>

       {isAforoModalOpen && <AforoCaseModal isOpen={isAforoModalOpen} onClose={() => setIsAforoModalOpen(false)} />}
    </AppShell>
  );
}
