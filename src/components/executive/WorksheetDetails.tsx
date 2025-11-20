
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

const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
};

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; icon?: React.ElementType }> = ({ label, value, icon: Icon }) => {
  let displayValue: string | React.ReactNode;
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
        <CardHeader>
            <div className="flex justify-between items-start">
                <CardTitle className="text-xl md:text-2xl font-semibold text-foreground">Hoja de Trabajo: {worksheet.ne}</CardTitle>
                <button onClick={onClose} className="p-1 text-destructive hover:text-destructive/80 no-print">
                    <X className="h-6 w-6" />
                </button>
            </div>
          <CardDescription className="text-muted-foreground no-print">
            Vista de solo lectura de la hoja de trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 bg-secondary/30 p-4 rounded-md shadow-sm text-sm">
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
           <div>
            <h4 className="text-lg font-medium mb-2 text-foreground">Descripción</h4>
            <p className="text-sm p-4 border rounded-md bg-card">{worksheet.description}</p>
          </div>

          {/* Documents */}
          <div>
            <h4 className="text-lg font-medium mb-2 text-foreground">Documentos Entregados</h4>
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {worksheet.documents.map(doc => (
                        <TableRow key={doc.id}>
                            <TableCell>{doc.type}</TableCell><TableCell>{doc.number}</TableCell>
                            <TableCell><Badge variant={doc.isCopy ? 'secondary' : 'default'}>{doc.isCopy ? 'Copia' : 'Original'}</Badge></TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          </div>
          
          {/* Operation & Joint Operation */}
          <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium mb-2 text-foreground">Detalles de Operación</h4>
                <div className="space-y-4 p-4 border rounded-md">
                    <DetailItem label="Tipo de Operación" value={worksheet.operationType} icon={ListChecks} />
                    {worksheet.operationType && (
                        <>
                         <DetailItem label="Patrón Régimen" value={worksheet.patternRegime} />
                         <DetailItem label="Sub-Régimen" value={worksheet.subRegime} />
                        </>
                    )}
                </div>
              </div>
               <div>
                <h4 className="text-lg font-medium mb-2 text-foreground">Operación Mancomunada</h4>
                <div className="space-y-4 p-4 border rounded-md">
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
            <div>
              <h4 className="text-lg font-medium mb-2 text-foreground">Observaciones</h4>
              <p className="text-sm p-4 border rounded-md bg-card whitespace-pre-wrap">{worksheet.observations}</p>
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
