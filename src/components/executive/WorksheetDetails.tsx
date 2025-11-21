
"use client";
import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { X, Printer, FileText, User, Building, Weight, Truck, MapPin, Anchor, Plane, Globe, Package, ListChecks, FileSymlink, Link as LinkIcon, Eye } from 'lucide-react';
import type { Worksheet } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format as formatDateFns } from 'date-fns';

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
};

const formatShortDate = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return formatDateFns(date, 'dd/MM/yyyy');
};


const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => {
  let displayValue: string | React.ReactNode;
  if (typeof value === 'boolean') {
    displayValue = value ? 'Sí' : 'No';
  } else {
    displayValue = String(value ?? 'N/A');
  }

  return (
    <div className="flex items-start gap-2 print:gap-1">
      {Icon && <Icon className="mr-1 h-4 w-4 text-primary mt-0.5 flex-shrink-0 print:h-3 print:w-3" />}
      <p className="text-xs font-medium text-muted-foreground whitespace-nowrap print:text-xs">{label}:</p>
      <p className="text-sm text-foreground print:text-xs">{displayValue}</p>
    </div>
  );
};

const transportIcons = {
    aereo: Plane,
    maritimo: Anchor,
    frontera: Globe,
    terrestre: Truck,
};

export const WorksheetDetails: React.FC<{ worksheet: Worksheet; onClose: () => void; }> = ({ worksheet, onClose }) => {

  const handlePrint = () => {
    window.print();
  };
  
  const TransportIcon = transportIcons[worksheet.transportMode] || Truck;

  return (
    <>
      <Card className="mt-6 w-full max-w-5xl mx-auto custom-shadow" id="printable-area">
        <Image
            src="/AconicExaminer/imagenes/HEADERSEXA.svg"
            alt="Examen Header"
            width={800}
            height={100}
            className="w-full h-auto mb-4 hidden print:block"
            priority
        />
        <CardHeader className="print:p-0">
            <div className="flex justify-between items-start">
                <CardTitle className="text-xl md:text-2xl font-semibold text-foreground print:text-lg">Hoja de Trabajo: {worksheet.ne}</CardTitle>
                <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                    <X className="h-6 w-6" />
                </button>
            </div>
          <CardDescription className="text-muted-foreground no-print print:hidden">
            Vista de solo lectura de la hoja de trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 print:space-y-2 print:p-0">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-x-6 gap-y-4 print:gap-x-4 print:gap-y-2 bg-secondary/30 p-4 rounded-md shadow-sm text-sm print:p-2 print:bg-transparent print:shadow-none">
              <DetailItem label="NE" value={worksheet.ne} icon={FileText} />
              <DetailItem label="Ejecutivo" value={worksheet.executive} icon={User} />
              <DetailItem label="Consignatario" value={worksheet.consignee} icon={Building} />
              <DetailItem label="Peso Bruto" value={worksheet.grossWeight} icon={Weight} />
              <DetailItem label="Peso Neto" value={worksheet.netWeight} icon={Weight} />
              <DetailItem label="Número de Bultos" value={worksheet.packageNumber} icon={Package} />
              <DetailItem label="Aduana de Entrada" value={worksheet.entryCustoms} icon={MapPin} />
              <DetailItem label="Aduana de Despacho" value={worksheet.dispatchCustoms} icon={MapPin} />
              <DetailItem label="Modo de Transporte" value={worksheet.transportMode} icon={TransportIcon} />
              {worksheet.inLocalWarehouse && <DetailItem label="Localización" value={worksheet.location} icon={MapPin} />}
          </div>
          
          {/* Description */}
           <div className="print:mt-2">
            <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Descripción</h4>
            <p className="text-sm p-4 border rounded-md bg-card print:p-2 print:text-xs">{worksheet.description}</p>
          </div>

          <div className="grid grid-cols-1 print:grid-cols-2 print:gap-x-4">
            {/* Documents */}
            <div className="print:mt-2">
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Documentos Entregados</h4>
                <div className="rounded-md border">
                    <Table className="print:text-xs">
                        <TableHeader><TableRow><TableHead className="print:p-1">Tipo</TableHead><TableHead className="print:p-1">Número</TableHead><TableHead className="print:p-1">Formato</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {worksheet.documents?.length > 0 ? (
                            worksheet.documents.map(doc => (
                                <TableRow key={doc.id}><TableCell className="print:p-1">{doc.type}</TableCell><TableCell className="print:p-1">{doc.number}</TableCell>
                                <TableCell className="print:p-1"><Badge variant={doc.isCopy ? 'secondary' : 'default'} className="print:text-xs print:px-1 print:py-0">{doc.isCopy ? 'Copia' : 'Original'}</Badge></TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground print:p-1">No hay documentos.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            
            {/* Required Permits */}
            <div className="mt-6 print:mt-2">
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Permisos Requeridos</h4>
                <div className="rounded-md border">
                    <Table className="print:text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="print:p-1">Permiso</TableHead>
                                <TableHead className="print:p-1">Estado</TableHead>
                                <TableHead className="print:p-1">Fecha Sometido</TableHead>
                                <TableHead className="print:p-1">Fecha Retiro Aprox.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {worksheet.requiredPermits?.length > 0 ? (
                                worksheet.requiredPermits.map(permit => (
                                    <TableRow key={permit.id}>
                                        <TableCell className="font-medium print:p-1">{permit.name}</TableCell>
                                        <TableCell className="print:p-1"><Badge variant={permit.status === 'Entregado' ? 'default' : 'secondary'} className="print:text-xs print:px-1 print:py-0">{permit.status}</Badge></TableCell>
                                        <TableCell className="print:p-1">{formatShortDate(permit.tramiteDate)}</TableCell>
                                        <TableCell className="print:p-1">{formatShortDate(permit.estimatedDeliveryDate)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground print:p-1">No hay permisos requeridos.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
          </div>
          
          {/* Operation & Joint Operation */}
          <div className="grid md:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4 print:mt-2">
              <div>
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Detalles de Operación</h4>
                <div className="space-y-4 p-4 border rounded-md print:p-2 print:space-y-1">
                    <DetailItem label="Tipo de Operación" value={worksheet.operationType ? worksheet.operationType.charAt(0).toUpperCase() + worksheet.operationType.slice(1) : undefined} icon={ListChecks} />
                    {worksheet.operationType && (
                        <>
                         <DetailItem label="Patrón Régimen" value={worksheet.patternRegime} />
                         <DetailItem label="Sub-Régimen" value={worksheet.subRegime} />
                        </>
                    )}
                </div>
              </div>
               <div>
                <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Operación Mancomunada</h4>
                <div className="space-y-4 p-4 border rounded-md print:p-2 print:space-y-1">
                    <DetailItem label="Es Mancomunada" value={worksheet.isJointOperation} />
                    {worksheet.isJointOperation && (
                        <>
                          <DetailItem label="NE Mancomunado" value={worksheet.jointNe} icon={FileSymlink} />
                          <DetailItem label="Referencia Mancomunada" value={worksheet.jointReference} icon={LinkIcon} />
                        </>
                    )}
                </div>
              </div>
          </div>

           {/* Observations */}
          {worksheet.observations && (
            <div className="print:mt-2">
              <h4 className="text-lg font-medium mb-2 text-foreground print:text-base print:mb-1">Observaciones</h4>
              <p className="text-sm p-4 border rounded-md bg-card whitespace-pre-wrap print:p-2 print:text-xs">{worksheet.observations}</p>
            </div>
          )}

        </CardContent>
        <CardFooter className="justify-end gap-2 no-print border-t pt-4">
            <Button type="button" onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </CardFooter>
        <Image
            src="/AconicExaminer/imagenes/FOOTEREXA.svg"
            alt="Examen Footer"
            width={800}
            height={50}
            className="w-full h-auto mt-6 hidden print:block"
        />
      </Card>
    </>
  );
};
