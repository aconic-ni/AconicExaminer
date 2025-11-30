
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, writeBatch, collection, Timestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate, Worksheet, WorksheetDocument, RequiredPermit, DocumentStatus, AppUser } from '@/types';
import { Loader2, PlusCircle, Trash2, FileText, Calendar, Receipt, RotateCcw, MessageSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../reports/DatePicker';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { PermitCommentModal } from './PermitCommentModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

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
  facturaNumber: z.string().optional(),
  assignedExecutive: z.string().optional(),
  comments: z.array(z.any()).optional(), // Add comments field
});


const manageDocsSchema = z.object({
  facturaNumber: z.string().optional(),
  documents: z.array(documentSchema),
  requiredPermits: z.array(permitSchema),
  transportDocumentType: z.enum(['guia_aerea', 'bl', 'carta_porte']).optional().nullable(),
  transportCompany: z.string().optional(),
  transportDocumentNumber: z.string().optional(),
});
type ManageDocsFormData = z.infer<typeof manageDocsSchema>;

export function ManageDocumentsModal({ isOpen, onClose, caseData }: ManageDocumentsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalWorksheet, setOriginalWorksheet] = useState<Worksheet | null>(null);
  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);
  const [selectedPermitForComment, setSelectedPermitForComment] = useState<{permit: RequiredPermit, index: number} | null>(null);


  const form = useForm<ManageDocsFormData>({
    resolver: zodResolver(manageDocsSchema),
    defaultValues: { facturaNumber: '', documents: [], requiredPermits: [], transportDocumentType: null, transportCompany: '', transportDocumentNumber: '' },
  });

  const { fields: docFields, append: appendDoc, remove: rhfRemoveDoc, update: updateDocField } = useFieldArray({
    control: form.control, name: "documents",
  });
  const { fields: permitFields, append: appendPermit, remove: removePermit, update: updatePermitField } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });

  const watchPermitFields = form.watch("requiredPermits");
  
  const [facturaPopoverOpen, setFacturaPopoverOpen] = useState(false);
  const [facturaNumberInput, setFacturaNumberInput] = useState('');
  const [facturaIsOriginal, setFacturaIsOriginal] = useState(false);

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [isOriginal, setIsOriginal] = useState(false);

  useEffect(() => {
    const fetchWorksheetAndGroup = async () => {
        if (!user) return;
        
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
                    facturaNumber: wsData.facturaNumber || '',
                    documents: wsData.documents || [],
                    requiredPermits: permitsWithDates,
                    transportDocumentType: wsData.transportDocumentType || null,
                    transportCompany: wsData.transportCompany || '',
                    transportDocumentNumber: wsData.transportDocumentNumber || '',
                });
                setFacturaNumberInput(wsData.facturaNumber || '');
            }
        }
        
        if (user.visibilityGroup && user.visibilityGroup.length > 0) {
            const uidsToFetch = Array.from(new Set([user.uid, ...user.visibilityGroup]));
            const usersQuery = query(collection(db, 'users'), where('__name__', 'in', uidsToFetch));
            const querySnapshot = await getDocs(usersQuery);
            const members = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
            setGroupMembers(members);
        } else {
            setGroupMembers([]);
        }
    };

    if (isOpen) {
        fetchWorksheetAndGroup();
    }
  }, [isOpen, caseData.worksheetId, form, user]);

  const addDocument = () => {
    if (docType.trim() && docNumber.trim()) {
      appendDoc({ id: uuidv4(), type: docType, number: docNumber, isCopy: !isOriginal, status: 'Entregado' });
      setDocType(''); setDocNumber(''); setIsOriginal(false);
    } else {
      toast({ title: "Datos incompletos", variant: "destructive" });
    }
  };
  
  const handleAddFactura = () => {
    if (facturaNumberInput.trim()) {
        form.setValue('facturaNumber', facturaNumberInput.trim());
        appendDoc({ id: uuidv4(), type: 'FACTURA', number: facturaNumberInput.trim(), isCopy: !facturaIsOriginal, status: 'Entregado'});
        setFacturaPopoverOpen(false);
    } else {
        toast({ title: "Número de factura requerido", variant: "destructive" });
    }
  }

  const handleResubmitPermit = (index: number) => {
    updatePermitField(index, { ...permitFields[index], status: 'Sometido de Nuevo' });
    toast({ title: "Permiso Reenviado", description: "El estado del permiso se ha actualizado." });
  };


  const onSubmit = async (data: ManageDocsFormData) => {
    if (!user || !user.displayName || !originalWorksheet) return;
    
    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    const worksheetDocRef = doc(db, 'worksheets', originalWorksheet.id);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    
    const sanitizedPermits = data.requiredPermits.map(permit => ({
        ...permit,
        tramiteDate: permit.tramiteDate === undefined ? null : permit.tramiteDate,
        estimatedDeliveryDate: permit.estimatedDeliveryDate === undefined ? null : permit.estimatedDeliveryDate,
    }));

    const sanitizedData = {
        ...data,
        requiredPermits: sanitizedPermits,
    };

    batch.update(worksheetDocRef, sanitizedData);
    batch.update(caseDocRef, { facturaNumber: data.facturaNumber });

    const originalDocs = originalWorksheet.documents || [];
    sanitizedData.documents.forEach(newDoc => {
        const oldDoc = originalDocs.find(d => d.id === newDoc.id);
        if (!oldDoc) {
            const logRef = doc(updatesSubcollectionRef);
            batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: null, newValue: `Documento añadido: ${newDoc.type} - ${newDoc.number}`,
                comment: `Ejecutivo añadió un nuevo documento entregado.`
            } as AforoCaseUpdate);
        }
    });
    
    const originalPermits = originalWorksheet.requiredPermits || [];
     sanitizedData.requiredPermits.forEach(newPermit => {
        const oldPermit = originalPermits.find(p => p.id === newPermit.id);
        if (!oldPermit) return; 

        if (oldPermit.status !== newPermit.status) {
            const logRef = doc(updatesSubcollectionRef);
            batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: `Permiso '${newPermit.name}' en estado: ${oldPermit.status}`,
                newValue: `Permiso '${newPermit.name}' actualizado a: ${newPermit.status}`,
                comment: `Estado de permiso actualizado por ejecutivo.`
            } as AforoCaseUpdate);
        }
        if (oldPermit.assignedExecutive !== newPermit.assignedExecutive) {
             const logRef = doc(updatesSubcollectionRef);
             batch.set(logRef, {
                 updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                 oldValue: `Permiso '${newPermit.name}' asignado a: ${oldPermit.assignedExecutive || 'N/A'}`,
                 newValue: `Permiso '${newPermit.name}' reasignado a: ${newPermit.assignedExecutive || 'N/A'}`,
                 comment: 'Reasignación de permiso realizada por ejecutivo.'
             } as AforoCaseUpdate);
        }
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
        const oldEstimatedDate = oldPermit?.estimatedDeliveryDate;
        const newEstimatedDate = newPermit.estimatedDeliveryDate;
        if (oldEstimatedDate?.toMillis() !== newEstimatedDate?.toMillis()) {
             const logRef = doc(updatesSubcollectionRef);
             batch.set(logRef, {
                updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'document_update',
                oldValue: `Fecha estimada para ${newPermit.name}: ${oldEstimatedDate ? oldEstimatedDate.toDate().toLocaleDateString() : 'N/A'}`,
                newValue: `Fecha estimada para ${newPermit.name}: ${newEstimatedDate ? newEstimatedDate.toDate().toLocaleDateString() : 'N/A'}`,
                comment: 'Fecha estimada de entrega actualizada.'
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

  const getStatusIndicatorClass = (status: DocumentStatus, estimatedDate?: Timestamp | null) => {
    if (status !== 'En Trámite' || !estimatedDate) {
        return "bg-gray-400"; // Default for non-applicable statuses
    }
    const today = new Date();
    const dueDate = estimatedDate.toDate();
    const daysDiff = differenceInDays(dueDate, today);

    if (daysDiff < 0) return "bg-red-500"; // Vencido
    if (daysDiff <= 3) return "bg-yellow-500"; // Próximo a vencer
    return "bg-green-500"; // A tiempo
  };

  const handleUpdatePermitComments = (permitIndex: number, newComments: any[]) => {
    updatePermitField(permitIndex, { ...permitFields[permitIndex], comments: newComments });
  };

  const MobilePermitCard = ({ field, index }: { field: RequiredPermit, index: number }) => {
    const currentPermit = watchPermitFields[index];
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{field.name}</CardTitle>
                <CardDescription>Factura: {field.facturaNumber || 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {groupMembers.length > 0 && (
                     <div className="space-y-1">
                        <Label>Asignado A</Label>
                        <Controller
                            control={form.control}
                            name={`requiredPermits.${index}.assignedExecutive`}
                            render={({ field: controllerField }) => (
                                <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value || user?.displayName || ''}>
                                <SelectTrigger><SelectValue placeholder="Asignar..." /></SelectTrigger>
                                <SelectContent>{groupMembers.map(member => (
                                    <SelectItem key={member.uid} value={member.displayName || ''}>{member.displayName}</SelectItem>
                                ))}</SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                )}
                 <div className="space-y-1">
                    <Label>Estado</Label>
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${getStatusIndicatorClass(currentPermit.status, currentPermit.estimatedDeliveryDate)}`}/>
                        <Select onValueChange={(value) => updatePermitField(index, {...currentPermit, status: value as DocumentStatus})} value={currentPermit.status}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Pendiente">Pendiente</SelectItem>
                                <SelectItem value="En Trámite">En Trámite</SelectItem>
                                <SelectItem value="Entregado">Entregado</SelectItem>
                                <SelectItem value="Rechazado">Rechazado</SelectItem>
                                <SelectItem value="Sometido de Nuevo">Sometido de Nuevo</SelectItem>
                            </SelectContent>
                        </Select>
                        {currentPermit.status === 'Rechazado' && (
                        <Button size="icon" variant="outline" onClick={() => handleResubmitPermit(index)}><RotateCcw className="h-4 w-4"/></Button>
                        )}
                    </div>
                </div>
                 {currentPermit.status === 'En Trámite' && (
                     <>
                        <div className="space-y-1">
                            <Label>Fecha Trámite</Label>
                            <FormField
                                control={form.control} name={`requiredPermits.${index}.tramiteDate`}
                                render={({ field: dateField }) => (
                                <DatePicker date={dateField.value?.toDate()} onDateChange={(date) => dateField.onChange(date ? Timestamp.fromDate(date) : null)} />
                                )}
                            />
                        </div>
                         <div className="space-y-1">
                            <Label>Fecha Entrega Estimada</Label>
                             <FormField
                                control={form.control} name={`requiredPermits.${index}.estimatedDeliveryDate`}
                                render={({ field: dateField }) => (
                                <DatePicker date={dateField.value?.toDate()} onDateChange={(date) => dateField.onChange(date ? Timestamp.fromDate(date) : null)} />
                                )}
                            />
                        </div>
                    </>
                 )}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setSelectedPermitForComment({permit: currentPermit, index})}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Comentarios ({currentPermit.comments?.length || 0})
                </Button>
            </CardContent>
        </Card>
    )
  }


  if (!isOpen) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Gestionar Documentos y Permisos</DialogTitle>
          <DialogDescription>Añada nuevos documentos o actualice el estado de los permisos para el NE: {caseData.ne}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            <div className="pt-4 border-t">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                    <h3 className="text-lg font-medium">Documentos Entregados</h3>
                    <Popover open={facturaPopoverOpen} onOpenChange={setFacturaPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm"><Receipt className="mr-2 h-4 w-4"/> Añadir Factura</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Añadir Factura Principal</h4>
                                    <p className="text-sm text-muted-foreground">Esta factura se guardará como la principal del caso.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="factura-number">Número de Factura</Label>
                                    <Input id="factura-number" value={facturaNumberInput} onChange={e => setFacturaNumberInput(e.target.value)} />
                                    <div className="flex items-center space-x-2">
                                        <Switch id="factura-original" checked={facturaIsOriginal} onCheckedChange={setFacturaIsOriginal} />
                                        <Label htmlFor="factura-original">Es Original</Label>
                                    </div>
                                    <Button onClick={handleAddFactura}>Guardar Factura</Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="p-3 border rounded-md mb-4">
                    <h4 className="text-md font-medium text-primary mb-2">Documento de Transporte</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField
                            control={form.control}
                            name="transportDocumentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Documento</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="guia_aerea">Guía Aérea</SelectItem>
                                            <SelectItem value="bl">BL (Conocimiento de Embarque)</SelectItem>
                                            <SelectItem value="carta_porte">Carta de Porte</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="transportCompany"
                            render={({ field }) => (
                            <FormItem><FormLabel>Compañía</FormLabel><FormControl><Input {...field} placeholder="Nombre de la compañía" /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField
                            control={form.control}
                            name="transportDocumentNumber"
                            render={({ field }) => (
                            <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} placeholder="Número del documento" /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                    <div><Label>Tipo de Documento</Label><Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="Ej: BL, Packing List" /></div>
                    <div><Label>Número</Label><Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Ej: 12345" /></div>
                    <div className="flex items-center gap-2 pt-5"><Switch checked={isOriginal} onCheckedChange={setIsOriginal} /><Label>Es Original</Label></div>
                    <Button type="button" onClick={addDocument}><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button>
                </div>
                {docFields.length > 0 && (
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>{field.isCopy ? 'Copia' : 'Original'}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => rhfRemoveDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                    </Table></div>
                )}
            </div>

            <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Permisos Requeridos</h3>
                {isMobile ? (
                    <div className="space-y-4">
                        {permitFields.map((field, index) => <MobilePermitCard key={field.id} field={field as RequiredPermit} index={index} />)}
                    </div>
                ) : permitFields.length > 0 ? (
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Permiso</TableHead><TableHead>Factura Asociada</TableHead>{groupMembers.length > 0 && <TableHead>Asignado A</TableHead>}<TableHead>Estado</TableHead><TableHead>Fecha Trámite</TableHead><TableHead>Fecha Entrega Estimada</TableHead><TableHead>Comentarios</TableHead></TableRow></TableHeader>
                    <TableBody>{permitFields.map((field, index) => {
                        const currentPermit = watchPermitFields[index];
                        return (
                        <TableRow key={field.id}>
                            <TableCell className="font-medium">{field.name}</TableCell>
                            <TableCell>{field.facturaNumber || 'N/A'}</TableCell>
                            {groupMembers.length > 0 && (
                                <TableCell>
                                    <Controller
                                        control={form.control}
                                        name={`requiredPermits.${index}.assignedExecutive`}
                                        render={({ field: controllerField }) => (
                                             <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value || user?.displayName || ''}>
                                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Asignar..." /></SelectTrigger>
                                                <SelectContent>
                                                    {groupMembers.map(member => (
                                                        <SelectItem key={member.uid} value={member.displayName || ''}>{member.displayName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </TableCell>
                            )}
                            <TableCell>
                               <div className="flex items-center gap-2">
                                 <span className={`h-2.5 w-2.5 rounded-full ${getStatusIndicatorClass(currentPermit.status, currentPermit.estimatedDeliveryDate)}`}/>
                                  <Select onValueChange={(value) => updatePermitField(index, {...currentPermit, status: value as DocumentStatus})} value={currentPermit.status}>
                                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                                        <SelectItem value="En Trámite">En Trámite</SelectItem>
                                        <SelectItem value="Entregado">Entregado</SelectItem>
                                        <SelectItem value="Rechazado">Rechazado</SelectItem>
                                        <SelectItem value="Sometido de Nuevo">Sometido de Nuevo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {currentPermit.status === 'Rechazado' && (
                                    <Button size="sm" variant="outline" onClick={() => handleResubmitPermit(index)}><RotateCcw className="h-4 w-4"/></Button>
                                  )}
                               </div>
                            </TableCell>
                             <TableCell>
                                {currentPermit.status === 'En Trámite' && (
                                    <FormField
                                        control={form.control}
                                        name={`requiredPermits.${index}.tramiteDate`}
                                        render={({ field: dateField }) => (
                                           <DatePicker
                                                date={dateField.value?.toDate()}
                                                onDateChange={(date) => dateField.onChange(date ? Timestamp.fromDate(date) : null)}
                                            />
                                        )}
                                    />
                                )}
                            </TableCell>
                            <TableCell>
                                {currentPermit.status === 'En Trámite' && (
                                     <FormField
                                        control={form.control}
                                        name={`requiredPermits.${index}.estimatedDeliveryDate`}
                                        render={({ field: dateField }) => (
                                           <DatePicker
                                                date={dateField.value?.toDate()}
                                                onDateChange={(date) => dateField.onChange(date ? Timestamp.fromDate(date) : null)}
                                            />
                                        )}
                                    />
                                )}
                            </TableCell>
                             <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedPermitForComment({permit: currentPermit, index})}>
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="sr-only">Comentarios</span>
                                    {currentPermit.comments && currentPermit.comments.length > 0 && (
                                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs">{currentPermit.comments.length}</Badge>
                                    )}
                                </Button>
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
    {selectedPermitForComment && originalWorksheet && (
        <PermitCommentModal
            isOpen={!!selectedPermitForComment}
            onClose={() => setSelectedPermitForComment(null)}
            permit={selectedPermitForComment.permit}
            worksheetId={originalWorksheet.id}
            onCommentsUpdate={(newComments) => handleUpdatePermitComments(selectedPermitForComment.index, newComments)}
        />
    )}
    </>
  );
}

    