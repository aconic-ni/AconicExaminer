
"use client";
import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, FileText, User, Building, FileCheck, FileX, Calendar, Hash, Receipt, Banknote, PenSquare, MessageSquare } from 'lucide-react';
import type { AforoCase } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '../ui/badge';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
};

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => {
  let displayValue: React.ReactNode;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div>
      <div className="flex items-center">
        {Icon && <Icon className="mr-2 h-4 w-4 text-primary" />}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm text-foreground ml-6">{displayValue}</p>
    </div>
  );
};


export const IncidentReportDetails: React.FC<{ caseData: AforoCase; onClose: () => void; }> = ({ caseData, onClose }) => {

  const handlePrint = () => {
    window.print();
  };

  const isApproved = caseData.incidentStatus === 'Aprobada';
  
  const getStatusBadge = () => {
    if (caseData.incidentStatus === 'Aprobada') return <Badge variant="default" className="bg-green-600"><FileCheck className="mr-2 h-4 w-4"/> Aprobada</Badge>
    if (caseData.incidentStatus === 'Rechazada') return <Badge variant="destructive"><FileX className="mr-2 h-4 w-4"/> Rechazada</Badge>
    return <Badge variant="secondary">Pendiente</Badge>
  }


  return (
    <Card className="w-full max-w-4xl mx-auto custom-shadow" id="printable-area">
      <Image
          src="/AconicExaminer/imagenes/HEADERSEXA.svg"
          alt="Header"
          width={800}
          height={100}
          className="w-full h-auto mb-4 hidden print:block"
          priority
      />
      <CardHeader>
          <div className="flex justify-between items-start">
              <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Solicitud de Rectificación: {caseData.ne}</CardTitle>
              <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                  <X className="h-6 w-6" />
              </button>
          </div>
        <CardDescription className="text-muted-foreground no-print">
          Vista de solo lectura de la solicitud de incidencia.
        </CardDescription>
         {!isApproved && (
            <div className="mt-4 p-4 bg-red-100 text-red-800 border border-red-300 rounded-md text-center print:block">
                Esta solicitud no puede ser pagada porque no fue aprobada por el agente.
            </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 bg-secondary/30 p-4 rounded-md shadow-sm text-sm">
            <DetailItem label="NE" value={caseData.ne} icon={FileText} />
            <DetailItem label="Consignatario" value={caseData.consignee} icon={Building} />
            <DetailItem label="Reportado Por" value={caseData.incidentReportedBy} icon={User} />
            <DetailItem label="Fecha de Reporte" value={formatTimestamp(caseData.incidentReportedAt)} icon={Calendar} />
            <DetailItem label="Revisado Por" value={caseData.incidentReviewedBy} icon={User} />
            <DetailItem label="Fecha de Revisión" value={formatTimestamp(caseData.incidentReviewedAt)} icon={Calendar} />
            <div className="md:col-span-3">
              <div className="flex items-center">
                  <FileCheck className="mr-2 h-4 w-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground">Estado de la Incidencia</p>
              </div>
              <div className="ml-6">{getStatusBadge()}</div>
            </div>
        </div>
        
        {/* Payment and Liquidation */}
        <div>
            <h4 className="text-lg font-medium mb-2 text-foreground">Detalles de Liquidación y Pago</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-4 rounded-md">
                <DetailItem label="Declaración Aduanera" value={caseData.declaracionAduanera} icon={Hash} />
                <DetailItem label="No. de Liquidación" value={caseData.noLiquidacion} icon={Hash} />
                <DetailItem label="Pago Inicial Realizado" value={caseData.pagoInicialRealizado} icon={Banknote} />
                <DetailItem label="Recibo de Caja Pago Inicial" value={caseData.reciboDeCajaPagoInicial} icon={Receipt} />
            </div>
        </div>
        
        {/* Reasons and Observations */}
        <div>
          <h4 className="text-lg font-medium mb-2 text-foreground">Motivos y Observaciones</h4>
          <div className="space-y-4">
              <div className="p-4 border rounded-md">
                  <DetailItem label="Motivo de la Rectificación" value={caseData.motivoRectificacion} icon={PenSquare}/>
              </div>
              <div className="p-4 border rounded-md">
                  <DetailItem label="Observaciones" value={caseData.observaciones} icon={MessageSquare}/>
              </div>
          </div>
        </div>

        {/* Accounting Observations */}
        <div>
            <h4 className="text-lg font-medium mb-2 text-foreground">Observaciones (Contabilidad)</h4>
            <div className="p-4 border rounded-md bg-muted/50 min-h-[8rem]">
                 <p className="text-sm text-foreground">{caseData.observacionesContabilidad || ''}</p>
            </div>
        </div>


      </CardContent>
      <CardFooter className="justify-end gap-2 no-print border-t pt-4">
          <Button type="button" onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
      </CardFooter>
      <Image
          src="/AconicExaminer/imagenes/FOOTEREXA.svg"
          alt="Footer"
          width={800}
          height={50}
          className="w-full h-auto mt-6 hidden print:block"
      />
    </Card>
  );
};
