"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GitBranch,
  Banknote,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Briefcase,
  FileText,
  Shield,
  ShieldCheck
} from 'lucide-react';
import type { WorksheetWithCase, AforoCaseUpdate } from '@/types';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';


interface StatusBadgesProps {
  caseData: WorksheetWithCase;
  acuseLog?: AforoCaseUpdate | null;
}

const formatDate = (date: Date | Timestamp | null | undefined): string => {
    if (!date) return 'N/A';
    const d = (date as Timestamp)?.toDate ? (date as Timestamp).toDate() : (date as Date);
     if (d instanceof Date && !isNaN(d.getTime())) {
        return format(d, 'dd/MM/yy HH:mm', { locale: es });
    }
    return 'Fecha Inválida';
};

const BadgeIcon: React.FC<{
  Icon: React.ElementType;
  tooltipText: string;
  isComplete: boolean | null; // null means not applicable
  pulse?: boolean;
}> = ({ Icon, tooltipText, isComplete, pulse }) => {
  if (isComplete === null) {
    return null; // Don't render the badge if it's not applicable
  }

  const badgeClass = cn(
    "h-6 w-6 rounded-full flex items-center justify-center border",
    isComplete ? "bg-blue-500 text-white border-blue-600" : "bg-gray-300 text-gray-600 border-gray-400",
    pulse && "animate-pulse"
  );
  
  const iconClass = "h-4 w-4";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={badgeClass}>
          <Icon className={iconClass} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const AcuseBadge: React.FC<{ log: AforoCaseUpdate | null | undefined }> = ({ log }) => (
    <Tooltip>
        <TooltipTrigger asChild>
          <div>
            {log ? (
              <ShieldCheck className="h-5 w-5 text-blue-500" />
            ) : (
              <Shield className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {log ? (
            <p>Recibido por {log.updatedBy} el {formatDate(log.updatedAt)}</p>
          ) : (
            <p>Pendiente de acuse de recibo</p>
          )}
        </TooltipContent>
    </Tooltip>
);


const DocumentTypeBadge: React.FC<{ worksheetType: WorksheetWithCase['worksheet']['worksheetType'] }> = ({ worksheetType }) => {
    let Icon, text, tooltipText, bgColor, textColor;

    switch (worksheetType) {
        case 'anexo_5':
            Icon = null;
            text = '5';
            tooltipText = 'Anexo 5';
            bgColor = 'bg-cyan-500';
            textColor = 'text-white';
            break;
        case 'anexo_7':
            Icon = null;
            text = '7';
            tooltipText = 'Anexo 7';
            bgColor = 'bg-purple-500';
            textColor = 'text-white';
            break;
        case 'corporate_report':
            Icon = Briefcase;
            text = null;
            tooltipText = 'Reporte Corporativo';
            bgColor = 'bg-gray-700';
            textColor = 'text-white';
            break;
        case 'hoja_de_trabajo':
        default:
            Icon = BookOpen;
            text = null;
            tooltipText = 'Hoja de Trabajo';
            bgColor = 'bg-gray-300';
            textColor = 'text-gray-700';
            break;
    }

    const badgeClass = cn(
        "h-6 w-6 rounded-full flex items-center justify-center border",
        bgColor,
        textColor
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={badgeClass}>
                    {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">{text}</span>}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltipText}</p>
            </TooltipContent>
        </Tooltip>
    );
};


export function StatusBadges({ caseData, acuseLog }: StatusBadgesProps) {
  // Logic for each badge
  const hasPermits = caseData.worksheet?.requiredPermits && caseData.worksheet.requiredPermits.length > 0;
  const allPermitsDone = hasPermits ? caseData.worksheet.requiredPermits.every(p => p.status === 'Entregado') : false;

  const hasPayments = caseData.pagos && caseData.pagos.length > 0;
  const allPaymentsDone = hasPayments ? caseData.pagos.every(p => p.paymentStatus === 'Pagado') : false;

  const hasIncident = caseData.incidentType === 'Rectificacion';
  const incidentApproved = hasIncident ? caseData.incidentStatus === 'Aprobada' : false;

  const hasValueDoubt = caseData.hasValueDoubt;
  const valueDoubtProcessed = hasValueDoubt ? !!caseData.valueDoubtStatus : false;

  const hasPrevio = !!caseData.examenPrevio;
  const previoCompleted = hasPrevio ? caseData.examenPrevio?.status === 'complete' : false;

  return (
    <TooltipProvider>
        <div className="flex items-center gap-1.5">
            <AcuseBadge log={acuseLog} />
            <DocumentTypeBadge worksheetType={caseData.worksheet?.worksheetType} />
            <BadgeIcon Icon={GitBranch} tooltipText="Permisos" isComplete={hasPermits ? allPermitsDone : null} />
            <BadgeIcon Icon={Banknote} tooltipText="Pagos" isComplete={hasPayments ? allPaymentsDone : null} />
            <BadgeIcon Icon={AlertTriangle} tooltipText="Incidencia" isComplete={hasIncident ? incidentApproved : null} />
            <BadgeIcon Icon={ShieldAlert} tooltipText="Duda de Valor" isComplete={hasValueDoubt ? valueDoubtProcessed : null} />
            <BadgeIcon Icon={FileText} tooltipText="Previo" isComplete={hasPrevio ? previoCompleted : null} />
        </div>
    </TooltipProvider>
  );
}
