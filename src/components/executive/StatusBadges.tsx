
"use client";

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GitBranch, Banknote, AlertTriangle, ShieldAlert, BookOpen } from 'lucide-react';
import type { WorksheetWithCase } from '@/types';
import { cn } from '@/lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface StatusBadgesProps {
  caseData: WorksheetWithCase;
}

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


export function StatusBadges({ caseData }: StatusBadgesProps) {
  const [examPrevioStatus, setExamPrevioStatus] = React.useState<'complete' | 'incomplete' | null>(null);

  React.useEffect(() => {
    const fetchExamPrevioStatus = async () => {
        if (caseData.worksheet?.id) {
            try {
                const examDocRef = doc(db, 'examenesPrevios', caseData.worksheet.id);
                const examDocSnap = await getDoc(examDocRef);
                if (examDocSnap.exists()) {
                    setExamPrevioStatus(examDocSnap.data()?.status || 'incomplete');
                } else {
                    setExamPrevioStatus(null); // No previo has been started from this worksheet
                }
            } catch (error) {
                console.error("Error fetching examenesPrevios status:", error);
                setExamPrevioStatus(null);
            }
        } else {
             setExamPrevioStatus(null);
        }
    };
    fetchExamPrevioStatus();
  }, [caseData.worksheet]);

  // Logic for each badge
  const hasPermits = caseData.worksheet?.requiredPermits && caseData.worksheet.requiredPermits.length > 0;
  const allPermitsDone = hasPermits ? caseData.worksheet.requiredPermits.every(p => p.status === 'Entregado') : false;

  const hasPayments = caseData.pagos && caseData.pagos.length > 0;
  const allPaymentsDone = hasPayments ? caseData.pagos.every(p => p.paymentStatus === 'Pagado') : false;

  const hasIncident = caseData.incidentType === 'Rectificacion';
  const incidentApproved = hasIncident ? caseData.incidentStatus === 'Aprobada' : false;

  const hasValueDoubt = caseData.hasValueDoubt;
  const valueDoubtProcessed = hasValueDoubt ? !!caseData.valueDoubtStatus : false;

  const hasPrevio = !!caseData.worksheetId;
  const previoCompleted = hasPrevio ? examPrevioStatus === 'complete' : false;

  return (
    <TooltipProvider>
        <div className="flex items-center gap-1.5">
            <BadgeIcon Icon={GitBranch} tooltipText="Permisos" isComplete={hasPermits ? allPermitsDone : null} />
            <BadgeIcon Icon={Banknote} tooltipText="Pagos" isComplete={hasPayments ? allPaymentsDone : null} />
            <BadgeIcon Icon={AlertTriangle} tooltipText="Incidencia" isComplete={hasIncident ? incidentApproved : null} />
            <BadgeIcon Icon={ShieldAlert} tooltipText="Duda de Valor" isComplete={hasValueDoubt ? valueDoubtProcessed : null} />
            <BadgeIcon Icon={BookOpen} tooltipText="Previo" isComplete={hasPrevio ? previoCompleted : null} />
        </div>
    </TooltipProvider>
  );
}
