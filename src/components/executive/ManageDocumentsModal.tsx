
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp, getDoc } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, Worksheet, WorksheetDocument, RequiredPermit, DocumentStatus } from '@/types';
import { Loader2, PlusCircle, Trash2, FileText, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../reports/DatePicker';

interface ManageDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

const documentSchema = z.object({
  id: z.string(),
  type: z.string(),
  number: z.string(),
  isCopy: z.boolean(),
  status: z.custom<DocumentStatus>(),
});

const permitSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.custom<DocumentStatus>(),
  tramiteDate: z.custom<Timestamp>().nullable().optional(),
  estimatedDeliveryDate: z.custom<Timestamp>().nullable().optional(),
});


const manageDocsSchema = z.object({
  documents: z.array(documentSchema),
  requiredPermits: z.array(permitSchema),
});
type ManageDocsFormData = z.infer<typeof manageDocsSchema>;

export function ManageDocumentsModal({ isOpen, onClose, caseData }: ManageDocumentsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalWorksheet, setOriginalWorksheet] = useState<Worksheet | null>(null);

  const form = useForm<ManageDocsFormData>({
    resolver: zodResolver(manageDocsSchema),
    defaultValues: { documents: [], requiredPermits: [] },
  });

  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control: form.control, name: "documents",
  });
  const { fields: permitFields, append: appendPermit, remove: removePermit } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });

  const watchPermitFields = form.watch("requiredPermits");

  useEffect(() => {
    const fetchWorksheet = async () => {
        if (caseData.worksheetId) {
            const wsDoc = await getDoc(doc(db, 'worksheets', caseData.worksheetId));
            if (wsDoc.exists()) {
                const wsData = {id: wsDoc.id, ...wsDoc.data()} as Worksheet;
                setOriginalWorksheet(wsData);
                const permitsWithDates = (wsData.requiredPermits || []).map(p => ({
                    ...p,
                    tramiteDate: p.tramiteDate,
                    estimatedDeliveryDate: p.estimatedDeliveryDate
                }));
                form.reset({
                    documents: wsData.documents || [],
                    requiredPermits: permitsWithDates,
                });
            }
        }
    };
    if (isOpen) {
        fetchWorksheet();
    }
  }, [isOpen, caseData.worksheetId, form]);

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [isDocCopy, setIsDocCopy] = useState(false);

  const addDocument = () => {
    if (docType.trim() && docNumber.trim()) {
      appendDoc({ id: uuidv4(), type: docType, number: docNumber, isCopy: isDocCopy, status: 'Entregado' });
      setDocType(''); setDocNumber(''); setIsDocCopy(false);
    } else {
      toast({ title: "Datos incompletos", variant: "destructive" });
    }
  };

  const onSubmit = async (data: ManageDocsFormData) => {
    if (!user || !user.displayName || !originalWorksheet) return;
    
    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    const worksheetDocRef = doc(db, 'worksheets', originalWorksheet.id);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    
    // Get current form values directly to ensure latest state
    const currentFormData = form.getValues();

    // 1. Update the worksheet
    batch.update(worksheetDocRef, {
        documents: currentFormData.documents,
        requiredPermits: currentFormData.requiredPermits,
    });

    // 2. Log document changes
    const originalDocs = originalWorksheet.documents || [];
    currentFormData.documents.forEach(newDoc => {
        const oldDoc = originalDocs.find(d => d.id === newDoc.id);
        if (!oldDoc) { // This is a new document
            const logRef = doc(updatesSubcollectionRef); // Generate new doc ref for the log
            batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: null, newValue: `Documento añadido: ${newDoc.type} - ${newDoc.number}`,
                comment: `Ejecutivo añadió un nuevo documento entregado.`
            } as AforoCaseUpdate);
        }
    });
    
    // 3. Log permit status changes
    const originalPermits = originalWorksheet.requiredPermits || [];
     currentFormData.requiredPermits.forEach(newPermit => {
        const oldPermit = originalPermits.find(p => p.id === newPermit.id);
        if (oldPermit && oldPermit.status !== newPermit.status) {
            const logRef = doc(updatesSubcollectionRef);
            batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: `Permiso '${newPermit.name}' en estado: ${oldPermit.status}`,
                newValue: `Permiso '${newPermit.name}' actualizado a: ${newPermit.status}`,
                comment: `Estado de permiso actualizado por ejecutivo.`
            } as AforoCaseUpdate);
        }
        // Log date changes
        const oldTramiteDate = oldPermit?.tramiteDate;
        const newTramiteDate = newPermit.tramiteDate;
        if (oldTramiteDate?.toMillis() !== newTramiteDate?.toMillis()) {
             const logRef = doc(updatesSubcollectionRef);
             batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: `Fecha de trámite para ${newPermit.name}: ${oldTramiteDate ? oldTramiteDate.toDate().toLocaleDateString() : 'N/A'}`,
                newValue: `Fecha de trámite para ${newPermit.name}: ${newTramiteDate ? newTramiteDate.toDate().toLocaleDateString() : 'N/A'}`,
                comment: 'Fecha de inicio de trámite actualizada.'
            } as AforoCaseUpdate);
        }
    });


    try {
        await batch.commit();
        toast({ title: "Documentos actualizados", description: "La lista de documentos y permisos ha sido guardada y registrada en la bitácora." });
        onClose();
    } catch (error) {
        console.error("Error updating documents with batch:", error);
        toast({ title: "Error", description: "No se pudieron guardar los cambios en la base de datos.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gestionar Documentos y Permisos</DialogTitle>
          <DialogDescription>Añada nuevos documentos o actualice el estado de los permisos para el NE: {caseData.ne}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

            <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Documentos Entregados</h3>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                    <div><Label>Tipo de Documento</Label><Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="Ej: Factura" /></div>
                    <div><Label>Número</Label><Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Ej: 12345" /></div>
                    <div className="flex items-center gap-2 pt-5"><Switch checked={isDocCopy} onCheckedChange={setIsDocCopy} /><Label>Es Copia</Label></div>
                    <Button type="button" onClick={addDocument}><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button>
                </div>
                {docFields.length > 0 && (
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>{field.isCopy ? 'Copia' : 'Original'}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                    </Table></div>
                )}
            </div>

            <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Permisos Requeridos</h3>
                {permitFields.length > 0 ? (
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Permiso</TableHead><TableHead>Estado</TableHead><TableHead>Fecha Trámite</TableHead><TableHead>Fecha Entrega Estimada</TableHead></TableRow></TableHeader>
                    <TableBody>{permitFields.map((field, index) => {
                        const currentStatus = watchPermitFields[index]?.status;
                        return (
                        <TableRow key={field.id}>
                            <TableCell className="font-medium">{field.name}</TableCell>
                            <TableCell>
                                <FormField
                                    control={form.control}
                                    name={`requiredPermits.${index}.status`}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                           <SelectTrigger><SelectValue/></SelectTrigger>
                                           <SelectContent>
                                               <SelectItem value="Pendiente">Pendiente</SelectItem>
                                               <SelectItem value="En Trámite">En Trámite</SelectItem>
                                               <SelectItem value="Entregado">Entregado</SelectItem>
                                           </SelectContent>
                                        </Select>
                                    )}
                                />
                            </TableCell>
                             <TableCell>
                                {currentStatus === 'En Trámite' && (
                                    <FormField
                                        control={form.control}
                                        name={`requiredPermits.${index}.tramiteDate`}
                                        render={({ field }) => (
                                           <DatePicker
                                                date={field.value?.toDate()}
                                                onDateChange={(date) => field.onChange(date ? Timestamp.fromDate(date) : null)}
                                            />
                                        )}
                                    />
                                )}
                            </TableCell>
                            <TableCell>
                                {currentStatus === 'En Trámite' && (
                                     <FormField
                                        control={form.control}
                                        name={`requiredPermits.${index}.estimatedDeliveryDate`}
                                        render={({ field }) => (
                                           <DatePicker
                                                date={field.value?.toDate()}
                                                onDateChange={(date) => field.onChange(date ? Timestamp.fromDate(date) : null)}
                                            />
                                        )}
                                    />
                                )}
                            </TableCell>
                        </TableRow>
                        )
                    })}</TableBody>
                    </Table></div>
                ) : ( <p className="text-sm text-muted-foreground">No hay permisos requeridos en esta hoja de trabajo.</p> )}
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
