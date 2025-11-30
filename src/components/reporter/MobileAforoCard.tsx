
"use client"
import React from 'react';
import type { AforoCase, AforoCaseStatus, AforadorStatus, DigitacionStatus, PreliquidationStatus, LastUpdateInfo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Timestamp } from 'firebase/firestore';
import { format, toDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  FilePlus, BookOpen, AlertTriangle, ShieldAlert, History, Eye, MessageSquare, PlusSquare, Send, CheckCircle
} from 'lucide-react';
import { DatePickerWithTime } from '../reports/DatePickerWithTime';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Input } from '../ui/input';

interface MobileAforoCardProps {
  caseItem: AforoCase;
  savingState: { [key: string]: boolean };
  canEditFields: boolean;
  handleAutoSave: (caseId: string, field: keyof AforoCase, value: any, isTriggerFromFieldUpdate?: boolean) => void;
  handleValidatePattern: (caseId: string) => void;
  openAssignmentModal: (caseItem: AforoCase, type: 'aforador' | 'revisor') => void;
  openHistoryModal: (caseItem: AforoCase) => void;
  openIncidentModal: (caseItem: AforoCase) => void;
  openAforadorCommentModal: (caseItem: AforoCase) => void;
  openObservationModal: (caseItem: AforoCase) => void;
  handleRequestRevalidation: (caseItem: AforoCase) => void;
  handleAssignToDigitization: (caseItem: AforoCase) => void;
  handleViewWorksheet: (caseItem: AforoCase) => void;
  setSelectedIncidentForDetails: (caseItem: AforoCase) => void;
}

const formatDate = (date: Date | Timestamp | null | undefined, includeTime: boolean = true): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : toDate(date);
    const formatString = includeTime ? "dd/MM/yy HH:mm" : "dd/MM/yy";
    return format(d, formatString, { locale: es });
};

const getRevisorStatusBadgeVariant = (status?: AforoCaseStatus) => {
    switch (status) { case 'Aprobado': return 'default'; case 'Rechazado': return 'destructive'; case 'Revalidación Solicitada': return 'secondary'; default: return 'outline'; }
};
const getAforadorStatusBadgeVariant = (status?: AforadorStatus) => {
    switch(status) { case 'En revisión': return 'default'; case 'Incompleto': return 'destructive'; case 'En proceso': return 'secondary'; case 'Pendiente': return 'destructive'; default: return 'outline'; }
};
const getDigitacionBadge = (status?: DigitacionStatus, declaracion?: string | null) => {
    if (status === 'Trámite Completo') { return <Badge variant="default" className="bg-green-600">{declaracion || 'Finalizado'}</Badge>; }
    if (status) { return <Badge variant={status === 'En Proceso' ? 'secondary' : 'outline'}>{status}</Badge>; }
    return <Badge variant="outline">Pendiente</Badge>;
}
const getPreliquidationStatusBadge = (status?: PreliquidationStatus) => {
    switch(status) {
      case 'Aprobada': return <Badge variant="default" className="bg-green-600">Aprobada</Badge>;
      default: return <Badge variant="outline">Pendiente</Badge>;
    }
  };

const getIncidentTypeDisplay = (c: AforoCase) => {
    const types = [];
    if (c.incidentType === 'Rectificacion') types.push('Rectificación');
    if (c.hasValueDoubt) types.push('Duda de Valor');
    return types.length > 0 ? types.join(' / ') : 'N/A';
  };


const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-right text-foreground">{children}</div>
    </div>
);

export const MobileAforoCard: React.FC<MobileAforoCardProps> = ({
  caseItem: c,
  savingState,
  canEditFields,
  handleAutoSave,
  handleValidatePattern,
  openAssignmentModal,
  openHistoryModal,
  openIncidentModal,
  openAforadorCommentModal,
  openObservationModal,
  handleRequestRevalidation,
  handleAssignToDigitization,
  handleViewWorksheet,
  setSelectedIncidentForDetails
}) => {
    const canEditThisRow = canEditFields || (c.aforador && c.aforador === c.aforador); // Simplified logic
    const isPatternValidated = c.isPatternValidated === true;
    const allowPatternEdit = c.revisorStatus === 'Rechazado';
    
    return (
        <Card key={c.id} className="w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-bold text-lg text-primary">{c.ne}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{c.consignee}</p>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir</span><PlusSquare className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {c.worksheetId && <DropdownMenuItem onSelect={() => handleViewWorksheet(c)}><BookOpen className="mr-2 h-4 w-4" /> Ver Hoja de Trabajo</DropdownMenuItem>}
                            <DropdownMenuItem onSelect={() => openObservationModal(c)}><Eye className="mr-2 h-4 w-4" /> Ver/Editar Observación</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openHistoryModal(c)}><History className="mr-2 h-4 w-4" /> Ver Bitácora</DropdownMenuItem>
                            {canEditThisRow && <DropdownMenuItem onSelect={() => openIncidentModal(c)}><AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Reportar Incidencia</DropdownMenuItem>}
                            {c.incidentReported && <DropdownMenuItem onSelect={() => setSelectedIncidentForDetails(c)}><Eye className="mr-2 h-4 w-4" /> Ver Incidencia</DropdownMenuItem>}
                            {(c.aforador || canEditFields) && c.revisorStatus === 'Rechazado' && <DropdownMenuItem onSelect={() => handleRequestRevalidation(c)}><Repeat className="mr-2 h-4 w-4" /> Solicitar Revalidación</DropdownMenuItem>}
                            {canEditFields && c.revisorStatus === 'Aprobado' && <DropdownMenuItem onSelect={() => handleAssignToDigitization(c)} disabled={c.preliquidationStatus !== 'Aprobada'}><Send className="mr-2 h-4 w-4" /> Asignar a Digitación</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 mb-4">
                    <DetailRow label="Ejecutivo">{c.executive}</DetailRow>
                    <DetailRow label="Aforador">{c.aforador || 'Sin asignar'}</DetailRow>
                    <DetailRow label="Estado Aforador">
                         <Badge variant={getAforadorStatusBadgeVariant(c.aforadorStatus)}>{c.aforadorStatus || 'Pendiente'}</Badge>
                    </DetailRow>
                    <DetailRow label="Revisor">{c.revisorAsignado || 'Sin asignar'}</DetailRow>
                    <DetailRow label="Estado Revisor">
                        <Badge variant={getRevisorStatusBadgeVariant(c.revisorStatus)}>{c.revisorStatus || 'Pendiente'}</Badge>
                    </DetailRow>
                     <DetailRow label="Estado Preliquidación">
                         {getPreliquidationStatusBadge(c.preliquidationStatus)}
                    </DetailRow>
                </div>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Expandir Detalles</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-2 pt-2">
                                <DetailRow label="Estado Digitación">{getDigitacionBadge(c.digitacionStatus, c.declaracionAduanera)}</DetailRow>
                                <div className="py-2"><p className="text-sm font-medium text-muted-foreground mb-1">Mercancía</p><p className="text-sm">{c.merchandise}</p></div>
                                <div className="py-2"><p className="text-sm font-medium text-muted-foreground mb-1">Total Posiciones</p><Input type="number" defaultValue={c.totalPosiciones || ''} onBlur={(e) => handleAutoSave(c.id, 'totalPosiciones', e.target.valueAsNumber)} disabled={!canEditThisRow}/></div>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    );
};
