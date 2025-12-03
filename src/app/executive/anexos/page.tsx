"use client";
import React, { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc, Timestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { X, Loader2, PlusCircle, Trash2, ArrowLeft, Edit } from 'lucide-react';
import type { AforoCase, AforoCaseUpdate, Worksheet, AppUser } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aduanas } from '@/lib/formData';
import { ConsigneeSelector } from '@/components/shared/ConsigneeSelector';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { AnexoDocumentModal } from '@/components/executive/anexos/AnexoDocumentModal';

// Zod Schema Definition
export const anexoDocumentSchema = z.object({
    id: z.string(),
    cantidad: z.coerce.number().optional(),
    origen: z.string().optional(),
    um: z.string().optional(),
    sac: z.string().optional(),
    peso: z.coerce.number().optional(),
    descripcion: z.string().min(1, "Descripción es requerida."),
    linea: z.string().optional(),
    guia: z.string().optional(),
    bulto: z.coerce.number().optional(),
    total: z.coerce.number().optional(),
});
export type AnexoDocumentFormData = z.infer<typeof anexoDocumentSchema>;


const anexoSchema = z.object({
  worksheetType: z.enum(['hoja_de_trabajo', 'anexo_5', 'anexo_7']).default('anexo_5'),
  ne: z.string().min(1, "El campo NE es requerido."),
  executive: z.string().min(1, "Ejecutivo es requerido."),
  consignee: z.string().min(1, "Empresa que solicita es requerida."),
  ruc: z.string().optional(),
  resa: z.string().optional(),
  facturaNumber: z.string().min(1, "Factura No es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de destino es requerida."),
  documents: z.array(anexoDocumentSchema),
  observations: z.string().optional(), // Nota
  valor: z.coerce.number().optional(),
  flete: z.coerce.number().optional(),
  seguro: z.coerce.number().optional(),
  otrosGastos: z.coerce.number().optional(),
  packageNumber: z.string().optional(),
  grossWeight: z.string().optional(),
  precinto: z.string().optional(),
  precintoLateral: z.string().optional(),
  codigoAduanero: z.string().optional(),
  marcaVehiculo: z.string().optional(),
  placaVehiculo: z.string().optional(),
  motorVehiculo: z.string().optional(),
  chasisVehiculo: z.string().optional(),
  vin: z.string().optional(),
  nombreConductor: z.string().optional(),
  licenciaConductor: z.string().optional(),
  cedulaConductor: z.string().optional(),
  tipoMedio: z.string().optional(),
  pesoVacioVehiculo: z.string().optional(),
  aforador: z.string().optional(),
  cantidadTotal: z.coerce.number().optional(),
  unidadMedidaTotal: z.string().optional(),
});


type AnexoFormData = z.infer<typeof anexoSchema>;

function AnexoForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentesAduaneros, setAgentesAduaneros] = useState<AppUser[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<AnexoDocumentFormData | null>(null);
  const [editingWorksheetId, setEditingWorksheetId] = useState<string | null>(null);

  const worksheetType = (searchParams.get('type') as 'anexo_5' | 'anexo_7') || 'anexo_5';
  
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setEditingWorksheetId(id);
      const fetchWorksheet = async () => {
        const wsDocRef = doc(db, 'worksheets', id);
        const wsSnap = await getDoc(wsDocRef);
        if (wsSnap.exists()) {
          form.reset(wsSnap.data() as AnexoFormData);
        } else {
          toast({ title: 'Error', description: 'No se encontró el anexo para editar.', variant: 'destructive'});
        }
      };
      fetchWorksheet();
    }
  }, [searchParams]);


  const form = useForm<AnexoFormData>({
    resolver: zodResolver(anexoSchema),
    defaultValues: {
      worksheetType: worksheetType,
      ne: '', executive: '', consignee: '', ruc: '', resa: '', facturaNumber: '', dispatchCustoms: '',
      documents: [], observations: '', valor: 0, flete: 0, seguro: 0, otrosGastos: 0,
      packageNumber: '', grossWeight: '', precinto: '', precintoLateral: '',
      codigoAduanero: '', marcaVehiculo: '', placaVehiculo: '', motorVehiculo: '', chasisVehiculo: '', vin: '',
      nombreConductor: '', licenciaConductor: '', cedulaConductor: '', tipoMedio: '', pesoVacioVehiculo: '', aforador: '-',
      cantidadTotal: 0, unidadMedidaTotal: ''
    },
  });
  
  const { fields: docFields, append: appendDoc, remove: removeDoc, update: updateDocField } = useFieldArray({
    control: form.control, name: "documents",
  });
  
  const watchedDocs = form.watch('documents');
  const totalSum = React.useMemo(() => {
    return watchedDocs.reduce((sum, doc) => sum + (Number(doc.total) || 0), 0);
  }, [watchedDocs]);

   const cantidadTotalSum = React.useMemo(() => {
    return watchedDocs.reduce((sum, doc) => sum + (Number(doc.cantidad) || 0), 0);
  }, [watchedDocs]);

  const bultosTotalesSum = React.useMemo(() => {
    return watchedDocs.reduce((sum, doc) => sum + (Number(doc.bulto) || 0), 0);
  }, [watchedDocs]);

  const pesoTotalSum = React.useMemo(() => {
    return watchedDocs.reduce((sum, doc) => sum + (Number(doc.peso) || 0), 0);
  }, [watchedDocs]);
  
  useEffect(() => {
    form.setValue('valor', totalSum);
  }, [totalSum, form]);

  useEffect(() => {
    form.setValue('cantidadTotal', cantidadTotalSum);
  }, [cantidadTotalSum, form]);

  useEffect(() => {
    form.setValue('packageNumber', String(bultosTotalesSum));
  }, [bultosTotalesSum, form]);

  useEffect(() => {
    form.setValue('grossWeight', String(pesoTotalSum));
  }, [pesoTotalSum, form]);

  useEffect(() => {
    if (user?.displayName && !editingWorksheetId) {
      form.setValue('executive', user.displayName);
    }
    form.setValue('worksheetType', worksheetType);
  }, [user, form, worksheetType, editingWorksheetId]);
  
  useEffect(() => {
    const fetchAgents = async () => {
        const q = query(collection(db, 'users'), where('roleTitle', '==', 'agente aduanero'));
        const querySnapshot = await getDocs(q);
        const agents = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        
        const completeAgents = agents.filter(agent => 
            agent.displayName && agent.agentLicense && agent.cedula
        );
        setAgentesAduaneros(completeAgents);
    };

    fetchAgents();
  }, []);

  const handleOpenModal = (doc?: AnexoDocumentFormData) => {
    setEditingDocument(doc || null);
    setIsModalOpen(true);
  };

  const handleSaveDocument = (data: AnexoDocumentFormData) => {
    const existingIndex = docFields.findIndex(field => field.id === data.id);
    if (existingIndex > -1) {
        updateDocField(existingIndex, data);
    } else {
        appendDoc(data);
    }
    setIsModalOpen(false);
    setEditingDocument(null);
  };


  const onSubmit = async (data: AnexoFormData) => {
    if (!user || !user.displayName) {
      toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
      return;
    }
    if (!data.ne) {
      toast({ title: 'Error', description: 'El campo NE no puede estar vacío.', variant: 'destructive'});
      return;
    }
    
    setIsSubmitting(true);

    if (editingWorksheetId) {
      // Update existing record
      const worksheetDocRef = doc(db, 'worksheets', editingWorksheetId);
      const aforoCaseDocRef = doc(db, 'AforoCases', editingWorksheetId);
      const batch = writeBatch(db);

      try {
        const updatedWorksheetData = { ...data, lastUpdatedAt: Timestamp.now() };
        batch.update(worksheetDocRef, updatedWorksheetData);
        batch.update(aforoCaseDocRef, {
            executive: data.executive,
            consignee: data.consignee,
            facturaNumber: data.facturaNumber,
            merchandise: data.observations,
            aforador: data.aforador || '',
        });

        const logRef = doc(collection(aforoCaseDocRef, 'actualizaciones'));
        const updateLog: AforoCaseUpdate = {
          updatedAt: Timestamp.now(),
          updatedBy: user.displayName,
          field: 'document_update',
          oldValue: `Anexo ${worksheetType === 'anexo_5' ? '5' : '7'}`,
          newValue: `Anexo ${worksheetType === 'anexo_5' ? '5' : '7'} actualizado`,
          comment: `Anexo fue modificado por ${user.displayName}.`,
        };
        batch.set(logRef, updateLog);
        
        await batch.commit();
        toast({ title: "Anexo Actualizado", description: `El anexo ${editingWorksheetId} ha sido actualizado.` });
        router.push('/executive');

      } catch(serverError: any) {
         const permissionError = new FirestorePermissionError({
          path: `batch update to worksheets/${editingWorksheetId} and AforoCases/${editingWorksheetId}`,
          operation: 'update',
          requestResourceData: { worksheetData: data },
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setIsSubmitting(false);
      }

    } else {
      // Create new record
      const neTrimmed = data.ne.trim().toUpperCase();
      const worksheetDocRef = doc(db, 'worksheets', neTrimmed);
      const aforoCaseDocRef = doc(db, 'AforoCases', neTrimmed);
      const batch = writeBatch(db);

      try {
        const [worksheetSnap, aforoCaseSnap] = await Promise.all([getDoc(worksheetDocRef), getDoc(aforoCaseDocRef)]);
        if (worksheetSnap.exists() || aforoCaseSnap.exists()) {
          toast({ title: "Registro Duplicado", description: `Ya existe un registro con el NE ${neTrimmed}.`, variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        
        const creationTimestamp = Timestamp.now();
        const createdByInfo = { by: user.displayName, at: creationTimestamp };
        
        const worksheetData = { ...data, id: neTrimmed, ne: neTrimmed, createdAt: creationTimestamp, createdBy: user.email!, lastUpdatedAt: creationTimestamp };
        batch.set(worksheetDocRef, worksheetData);

        const aforoCaseData: Partial<AforoCase> = {
          ne: neTrimmed,
          executive: data.executive,
          consignee: data.consignee,
          facturaNumber: data.facturaNumber,
          declarationPattern: '',
          merchandise: data.observations,
          createdBy: user.uid,
          createdAt: creationTimestamp,
          aforador: data.aforador || '',
          assignmentDate: data.aforador ? creationTimestamp : null,
          aforadorStatus: 'Pendiente ',
          aforadorStatusLastUpdate: createdByInfo,
          revisorStatus: 'Pendiente',
          revisorStatusLastUpdate: createdByInfo,
          preliquidationStatus: 'Pendiente',
          preliquidationStatusLastUpdate: createdByInfo,
          digitacionStatus: 'Pendiente',
          digitacionStatusLastUpdate: createdByInfo,
          incidentStatus: 'Pendiente',
          incidentStatusLastUpdate: createdByInfo,
          revisorAsignado: '',
          revisorAsignadoLastUpdate: createdByInfo,
          digitadorAsignado: '',
          digitadorAsignadoLastUpdate: createdByInfo,
          worksheetId: neTrimmed,
          entregadoAforoAt: creationTimestamp,
        };
        batch.set(aforoCaseDocRef, aforoCaseData);

        const initialLogRef = doc(collection(aforoCaseDocRef, 'actualizaciones'));
        const initialLog: AforoCaseUpdate = {
          updatedAt: Timestamp.now(),
          updatedBy: user.displayName,
          field: 'creation',
          oldValue: null,
          newValue: `case_created_from_${worksheetType}`,
          comment: `${worksheetType === 'anexo_5' ? 'Anexo 5' : 'Anexo 7'} ingresado por ${user.displayName}.`,
        };
        batch.set(initialLogRef, initialLog);

        await batch.commit();
        toast({ title: "Registro Creado", description: `El registro para el ${worksheetType.replace('_', ' ')} ${neTrimmed} ha sido guardado.` });
        router.push('/executive');
        form.reset();
          
      } catch (serverError: any) {
        console.error("Error creating record:", serverError);
        const permissionError = new FirestorePermissionError({
          path: `batch write to worksheets/${neTrimmed} and AforoCases/${neTrimmed}`,
          operation: 'create',
          requestResourceData: { worksheetData: data, aforoCaseData: { ne: neTrimmed } },
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <Card className="w-full max-w-screen-2xl mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">{editingWorksheetId ? 'Editar' : 'Nuevo'} {worksheetType === 'anexo_5' ? 'Anexo 5' : 'Anexo 7'}: Nota de Traslado</CardTitle>
            <CardDescription>{editingWorksheetId ? `Modificando el anexo ${editingWorksheetId}.` : 'Complete la información para generar el nuevo anexo.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="ne" render={({ field }) => (<FormItem><FormLabel>NE</FormLabel><FormControl><Input {...field} disabled={!!editingWorksheetId} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="consignee" render={({ field }) => (<FormItem><FormLabel>Empresa que solicita (Consignatario)</FormLabel><FormControl><ConsigneeSelector value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="ruc" render={({ field }) => (<FormItem><FormLabel>RUC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="resa" render={({ field }) => (<FormItem><FormLabel>RESA No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="facturaNumber" render={({ field }) => (<FormItem><FormLabel>Factura No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField
                    control={form.control}
                    name="dispatchCustoms"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Delegación de Aduana Destino</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar aduana..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {aduanas.map(aduana => <SelectItem key={aduana.value} value={aduana.value}>{aduana.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        <FormMessage />
                    </FormItem>
                 )}/>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Descripción de las mercancías</h3>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cantidad</TableHead><TableHead>Origen</TableHead><TableHead>UM</TableHead>
                                <TableHead>SAC</TableHead><TableHead>Peso</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Linea Aerea</TableHead><TableHead>N° Guia Aerea</TableHead><TableHead>Bulto</TableHead>
                                <TableHead>Total (US$)</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {docFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell>{field.cantidad}</TableCell>
                                    <TableCell>{field.origen}</TableCell>
                                    <TableCell>{field.um}</TableCell>
                                    <TableCell>{field.sac}</TableCell>
                                    <TableCell>{field.peso}</TableCell>
                                    <TableCell className="max-w-xs truncate">{field.descripcion}</TableCell>
                                    <TableCell>{field.linea}</TableCell>
                                    <TableCell>{field.guia}</TableCell>
                                    <TableCell>{field.bulto}</TableCell>
                                    <TableCell>{field.total?.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-1 justify-end">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenModal(field as AnexoDocumentFormData)}>
                                                <Edit className="h-4 w-4 text-blue-600"/>
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Button type="button" onClick={() => handleOpenModal()} size="sm" variant="outline" className="mt-2"><PlusCircle className="mr-2 h-4 w-4"/>Añadir Fila</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="cantidadTotal" render={({ field }) => (<FormItem><FormLabel>Cantidad Total</FormLabel><FormControl><Input placeholder="Cantidad" {...field} readOnly className="bg-muted/50" /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="unidadMedidaTotal" render={({ field }) => (<FormItem><FormLabel>Unidad</FormLabel><FormControl><Input placeholder="Unidad" {...field} /></FormControl></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="observations" render={({ field }) => (<FormItem><FormLabel>Nota</FormLabel><FormControl><Textarea rows={8} {...field} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <div className="space-y-4">
                     <div className="space-y-2">
                        <Label>Valor Total (USD)</Label>
                        <p className="text-2xl font-bold p-2 bg-muted rounded-md">${totalSum.toFixed(2)}</p>
                    </div>
                    <FormField control={form.control} name="packageNumber" render={({ field }) => (<FormItem><FormLabel>Bultos Totales</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/50" /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel>Peso Total</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/50"/></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="precinto" render={({ field }) => (<FormItem><FormLabel>Precinto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="precintoLateral" render={({ field }) => (<FormItem><FormLabel>Precinto Lateral</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm">Conformación de Valor</h4>
                        <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                           <FormField control={form.control} name="valor" render={({ field }) => (<FormItem><FormLabel>Valor $</FormLabel><FormControl><Input type="number" step="0.01" {...field} readOnly className="bg-muted/50" /></FormControl><FormMessage /></FormItem>)}/>
                           <FormField control={form.control} name="flete" render={({ field }) => (<FormItem><FormLabel>Flete $</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                           <FormField control={form.control} name="seguro" render={({ field }) => (<FormItem><FormLabel>Seguro $</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                           <FormField control={form.control} name="otrosGastos" render={({ field }) => (<FormItem><FormLabel>O. Gastó $</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                    </div>
                </div>
              </div>


              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Datos de Transporte</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="codigoAduanero" render={({ field }) => (<FormItem><FormLabel>Código de Aduanero</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="marcaVehiculo" render={({ field }) => (<FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="placaVehiculo" render={({ field }) => (<FormItem><FormLabel>Placa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="motorVehiculo" render={({ field }) => (<FormItem><FormLabel>Motor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="chasisVehiculo" render={({ field }) => (<FormItem><FormLabel>Chasis</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="vin" render={({ field }) => (<FormItem><FormLabel>VIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="nombreConductor" render={({ field }) => (<FormItem><FormLabel>Nombre Conductor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="licenciaConductor" render={({ field }) => (<FormItem><FormLabel>Licencia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="cedulaConductor" render={({ field }) => (<FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="tipoMedio" render={({ field }) => (<FormItem><FormLabel>Tipo de medio</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="pesoVacioVehiculo" render={({ field }) => (<FormItem><FormLabel>Peso Vacío</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField
                        control={form.control}
                        name="aforador"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Agente Aduanero</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar agente..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="-">- Ninguno -</SelectItem>
                                    {agentesAduaneros.map(agente => (
                                        <SelectItem key={agente.uid} value={agente.displayName || ''}>
                                            {agente.displayName} ({agente.agentLicense})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                     )}/>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <Button type="button" variant="outline" asChild>
                    <Link href="/executive"><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar {worksheetType === 'anexo_5' ? 'Anexo 5' : 'Anexo 7'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <AnexoDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDocument}
        documentData={editingDocument}
      />
    </>
  )
}

export default function AnexoPage() {
    return (
        <AppShell>
            <div className="py-2 md:py-5">
                <React.Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
                    <AnexoForm />
                </React.Suspense>
            </div>
        </AppShell>
    )
}
