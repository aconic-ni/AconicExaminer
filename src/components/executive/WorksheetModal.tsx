
"use client";
import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { X, Loader2, PlusCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import type { AforoCase, AforoCaseUpdate, RequiredPermit, DocumentStatus } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Checkbox } from '../ui/checkbox';

// Zod Schema Definition
const worksheetDocumentSchema = z.object({
  id: z.string(),
  type: z.string().min(1, "Tipo es requerido."),
  number: z.string().min(1, "Número es requerido."),
  isCopy: z.boolean().default(false),
  status: z.custom<DocumentStatus>().default('Entregado')
});

const requiredPermitSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nombre del permiso es requerido."),
  status: z.custom<DocumentStatus>(),
});

const worksheetSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  executive: z.string().min(1, "Ejecutivo es requerido."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  grossWeight: z.string().min(1, "Peso bruto es requerido."),
  netWeight: z.string().min(1, "Peso neto es requerido."),
  description: z.string().min(1, "Descripción es requerida."),
  packageNumber: z.string().min(1, "Número de bultos es requerido."),
  entryCustoms: z.string().min(1, "Aduana de entrada es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de despacho es requerida."),
  transportMode: z.enum(['aereo', 'maritimo', 'frontera', 'terrestre'], {
    required_error: "Debe seleccionar un modo de transporte."
  }),
  inLocalWarehouse: z.boolean().default(false),
  location: z.string().optional(),
  documents: z.array(worksheetDocumentSchema),
  requiredPermits: z.array(requiredPermitSchema),
  operationType: z.enum(['importacion', 'exportacion']).optional().nullable(),
  patternRegime: z.string().optional(),
  subRegime: z.string().optional(),
  isJointOperation: z.boolean().default(false),
  jointNe: z.string().optional(),
  jointReference: z.string().optional(),
  observations: z.string().optional(),
}).refine(data => !data.inLocalWarehouse || (data.inLocalWarehouse && data.location && data.location.trim() !== ''), {
  message: "La localización es requerida si está en almacén local.",
  path: ["location"],
}).refine(data => !data.isJointOperation || (data.isJointOperation && data.jointNe && data.jointNe.trim() !== ''), {
    message: "El NE mancomunado es requerido.",
    path: ["jointNe"],
});

type WorksheetFormData = z.infer<typeof worksheetSchema>;

interface WorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorksheetCreated: () => void; // Callback to refresh table
}

export function WorksheetModal({ isOpen, onClose, onWorksheetCreated }: WorksheetModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<WorksheetFormData>({
    resolver: zodResolver(worksheetSchema),
    defaultValues: {
      ne: '', executive: '', consignee: '', grossWeight: '', netWeight: '', description: '',
      packageNumber: '', entryCustoms: '', dispatchCustoms: '',
      inLocalWarehouse: false, location: '', documents: [], requiredPermits: [], operationType: null,
      patternRegime: '', subRegime: '', isJointOperation: false, jointNe: '',
      jointReference: '', observations: '',
    },
  });
  
  const { fields: docFields, append: appendDoc, remove: removeDoc, update: updateDoc } = useFieldArray({
    control: form.control, name: "documents",
  });

  const { fields: permitFields, append: appendPermit, remove: removePermit } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [isDocCopy, setIsDocCopy] = useState(false);
  
  const [permitName, setPermitName] = useState('');
  const [permitStatus, setPermitStatus] = useState<DocumentStatus>('Pendiente');
  
  useEffect(() => { if (user?.displayName) { form.setValue('executive', user.displayName); } }, [user, form]);
  
  const watchOperationType = form.watch('operationType');
  const watchIsJoint = form.watch('isJointOperation');
  const watchInWarehouse = form.watch('inLocalWarehouse');

  const addDocument = () => {
    if (docType.trim() && docNumber.trim()) {
      appendDoc({ id: uuidv4(), type: docType, number: docNumber, isCopy: isDocCopy, status: 'Entregado' });
      setDocType(''); setDocNumber(''); setIsDocCopy(false);
    } else {
        toast({ title: "Datos incompletos", description: "Por favor, complete el tipo y número de documento.", variant: "destructive" });
    }
  };

  const addPermit = () => {
     if(permitName.trim()) {
        if(permitStatus === 'Entregado') {
            appendDoc({ id: uuidv4(), type: permitName, number: 'VER BITACORA', isCopy: false, status: 'Entregado' });
        } else {
            appendPermit({ id: uuidv4(), name: permitName, status: permitStatus });
        }
        setPermitName('');
        setPermitStatus('Pendiente');
     } else {
        toast({ title: "Nombre requerido", description: "Por favor, ingrese el nombre del permiso.", variant: "destructive" });
     }
  }


  const onSubmit = async (data: WorksheetFormData) => {
    if (!user || !user.displayName) { toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'}); return; }
    setIsSubmitting(true);
    const neTrimmed = data.ne.trim().toUpperCase();
    const worksheetDocRef = doc(db, 'worksheets', neTrimmed);
    const aforoCaseDocRef = doc(db, 'AforoCases', neTrimmed);
    const batch = writeBatch(db);

    try {
        const [worksheetSnap, aforoCaseSnap] = await Promise.all([getDoc(worksheetDocRef), getDoc(aforoCaseDocRef)]);
        if (worksheetSnap.exists() || aforoCaseSnap.exists()) {
             toast({ title: "Registro Duplicado", description: `Ya existe un registro con el NE ${neTrimmed}.`, variant: "destructive" });
             setIsSubmitting(false); return;
        }

        const creationTimestamp = Timestamp.now();
        const worksheetData = { ...data, id: neTrimmed, ne: neTrimmed, createdAt: creationTimestamp, createdBy: user.email, };
        batch.set(worksheetDocRef, worksheetData);

        const aforoCaseData: Partial<AforoCase> = {
            ne: neTrimmed,
            executive: data.executive,
            consignee: data.consignee,
            merchandise: data.description,
            createdBy: user.uid,
            createdAt: creationTimestamp,
            aforadorStatus: 'Pendiente por completar',
            revisorStatus: 'Pendiente',
            worksheetId: neTrimmed,
            aforador: '',
            declarationPattern: '',
            assignmentDate: null,
            entregadoAforoAt: creationTimestamp,
        };
        batch.set(aforoCaseDocRef, aforoCaseData);

        const initialLogRef = doc(collection(aforoCaseDocRef, 'actualizaciones'));
        const initialLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(), updatedBy: user.displayName, field: 'creation', oldValue: null,
            newValue: 'case_created_from_worksheet', comment: `Hoja de Trabajo ingresada por ${user.displayName}.`,
        };
        batch.set(initialLogRef, initialLog);
        await batch.commit();

        toast({ title: "Hoja de Trabajo Creada", description: `El registro para el NE ${neTrimmed} ha sido guardado y enviado a Aforo.` });
        onWorksheetCreated(); onClose(); form.reset();
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: `batch write to worksheets/${neTrimmed} and AforoCases/${neTrimmed}`, operation: 'create',
            requestResourceData: { worksheetData: data, aforoCaseData: {ne: neTrimmed} },
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    } finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader><DialogTitle className="text-2xl">Nueva Hoja de Trabajo</DialogTitle><DialogDescription>Complete la información para generar el registro.</DialogDescription></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="ne" render={({ field }) => (<FormItem><FormLabel>NE</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="executive" render={({ field }) => (<FormItem><FormLabel>Ejecutivo</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="consignee" render={({ field }) => (<FormItem><FormLabel>Consignatario</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel>Peso Bruto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="netWeight" render={({ field }) => (<FormItem><FormLabel>Peso Neto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="packageNumber" render={({ field }) => (<FormItem><FormLabel>Número de Bultos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="entryCustoms" render={({ field }) => (<FormItem><FormLabel>Aduana Entrada</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="dispatchCustoms" render={({ field }) => (<FormItem><FormLabel>Aduana Despacho</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <div className="lg:col-span-3"><FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <FormField control={form.control} name="transportMode" render={({ field }) => (
                        <FormItem className="space-y-3"><FormLabel>Modo de Transporte</FormLabel><FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="aereo" /></FormControl><FormLabel className="font-normal">Aéreo</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="maritimo" /></FormControl><FormLabel className="font-normal">Marítimo</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="frontera" /></FormControl><FormLabel className="font-normal">Frontera</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="terrestre" /></FormControl><FormLabel className="font-normal">Terrestre</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                    )}/>
                    <div className="space-y-2">
                       <FormField control={form.control} name="inLocalWarehouse" render={({ field }) => (
                         <FormItem className="flex flex-row items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>En Almacén Local</FormLabel></FormItem>
                       )}/>
                       {watchInWarehouse && <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormControl><Input placeholder="Especifique localización..." {...field} /></FormControl><FormMessage /></FormItem>)}/>}
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-2">Documentos Entregados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                         <div><Label>Tipo de Documento</Label><Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="Ej: Factura" /></div>
                         <div><Label>Número</Label><Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="Ej: 12345" /></div>
                         <div className="flex items-center gap-2 pt-5"><Switch checked={isDocCopy} onCheckedChange={setIsDocCopy} /><Label>Es Copia</Label></div>
                         <Button type="button" onClick={addDocument}><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button>
                    </div>
                    {docFields.length > 0 && (
                        <div className="rounded-md border"><Table>
                            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                            <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>{field.isCopy ? 'Copia' : 'Original'}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                        </Table></div>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-2">Permisos Requeridos</h3>
                     <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                        <div><Label>Nombre del Permiso</Label><Input value={permitName} onChange={(e) => setPermitName(e.target.value)} placeholder="Ej: MAG, IPSA"/></div>
                        <div><Label>Estado</Label>
                            <RadioGroup value={permitStatus} onValueChange={(v: any) => setPermitStatus(v)} className="flex gap-4 pt-2">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Pendiente"/></FormControl><FormLabel className="font-normal">Pendiente</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="En Trámite"/></FormControl><FormLabel className="font-normal">En Trámite</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Entregado"/></FormControl><FormLabel className="font-normal">Entregado</FormLabel></FormItem>
                            </RadioGroup>
                        </div>
                        <Button type="button" onClick={addPermit}><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button>
                     </div>
                     {permitFields.length > 0 && (
                        <div className="rounded-md border"><Table>
                            <TableHeader><TableRow><TableHead>Permiso</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                            <TableBody>{permitFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.name}</TableCell><TableCell>{field.status}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removePermit(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                        </Table></div>
                     )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <FormField control={form.control} name="operationType" render={({ field }) => (
                         <FormItem className="space-y-3"><FormLabel>Tipo de Operación</FormLabel><FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value ?? ""} className="flex gap-4">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="importacion" /></FormControl><FormLabel className="font-normal">Importación</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="exportacion" /></FormControl><FormLabel className="font-normal">Exportación</FormLabel></FormItem>
                            </RadioGroup>
                         </FormControl><FormMessage /></FormItem>
                    )}/>
                    {watchOperationType && (
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="patternRegime" render={({ field }) => (<FormItem><FormLabel>Patrón Régimen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField control={form.control} name="subRegime" render={({ field }) => (<FormItem><FormLabel>Sub-Régimen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <FormField control={form.control} name="isJointOperation" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl><FormLabel>Operación Mancomunada</FormLabel></FormItem>
                    )}/>
                    {watchIsJoint && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="jointNe" render={({ field }) => (<FormItem><FormLabel>NE Mancomunado</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="jointReference" render={({ field }) => (<FormItem><FormLabel>Referencia Mancomunada</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                    )}
                </div>
                
                <div className="pt-4 border-t">
                    <FormField control={form.control} name="observations" render={({ field }) => (
                        <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} placeholder="Añada cualquier observación adicional aquí..."/></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>

                <DialogFooter className="pt-6">
                  <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Hoja de Trabajo
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
