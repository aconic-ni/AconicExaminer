
"use client";
import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, writeBatch, collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
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
import { X, Loader2, PlusCircle, Trash2, CheckSquare, Square, Receipt, Check, ChevronsUpDown, RotateCcw } from 'lucide-react';
import type { AforoCase, AforoCaseUpdate, RequiredPermit, DocumentStatus, Worksheet, AppUser } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { aduanas, aduanaToShortCode, permitOptions, tiposDeclaracion } from '@/lib/formData';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { cn } from '@/lib/utils';
import { ConsigneeSelector } from '../shared/ConsigneeSelector';
import { useAppContext } from '@/context/AppContext';
import { DatePicker } from '../reports/DatePicker';


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
  facturaNumber: z.string().optional(),
  assignedExecutive: z.string().optional(),
});

const worksheetSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  reference: z.string().max(12, "La referencia no puede exceder los 12 caracteres.").optional(),
  executive: z.string().min(1, "Ejecutivo es requerido."),
  consignee: z.string().min(1, "Consignatario es requerido."),
  eta: z.date().optional().nullable(),
  appliesTLC: z.boolean().default(false),
  tlcName: z.string().optional(),
  appliesModexo: z.boolean().default(false),
  modexoCode: z.string().optional(),
  facturaNumber: z.string().min(1, "La factura es requerida. Añádala usando el botón 'Añadir Factura'."),
  grossWeight: z.string().min(1, "Peso bruto es requerido."),
  netWeight: z.string().min(1, "Peso neto es requerido."),
  description: z.string().min(1, "Descripción es requerida."),
  packageNumber: z.string().min(1, "Número de bultos es requerido."),
  entryCustoms: z.string().min(1, "Aduana de entrada es requerida."),
  dispatchCustoms: z.string().min(1, "Aduana de despacho es requerida."),
  resa: z.string().optional(),
  transportMode: z.enum(['aereo', 'maritimo', 'frontera', 'terrestre'], {
    required_error: "Debe seleccionar un modo de transporte."
  }),
  inLocalWarehouse: z.boolean().default(false),
  inCustomsWarehouse: z.boolean().default(false),
  location: z.string().optional(),
  documents: z.array(worksheetDocumentSchema),
  requiredPermits: z.array(requiredPermitSchema),
  operationType: z.enum(['importacion', 'exportacion']).optional().nullable(),
  patternRegime: z.string().optional(),
  subRegime: z.string().optional(),
  isJointOperation: z.boolean().default(false),
  jointNe: z.string().optional(),
  jointReference: z.string().optional(),
  dcCorrespondiente: z.string().optional(),
  isSplit: z.boolean().default(false),
  observations: z.string().optional(),
  // New optional fields for transport document
  transportDocumentType: z.enum(['guia_aerea', 'bl', 'carta_porte']).optional().nullable(),
  transportCompany: z.string().optional(),
  transportDocumentNumber: z.string().optional(),
})
.refine(data => !(data.inLocalWarehouse || data.inCustomsWarehouse || data.transportMode === 'aereo') || (data.resa && data.resa.trim() !== ''), {
    message: "El RESA es requerido si el transporte es aéreo o la mercancía está en almacén.",
    path: ["resa"],
})
.refine(data => !(data.inLocalWarehouse || data.inCustomsWarehouse) || (data.location && data.location.trim() !== ''), {
  message: "La localización es requerida si la mercancía está en almacén local o aduana aérea.",
  path: ["location"],
})
.refine(data => !data.isJointOperation || (data.isJointOperation && data.jointNe && data.jointNe.trim() !== ''), {
    message: "El NE mancomunado es requerido.",
    path: ["jointNe"],
})
.refine(data => !data.appliesTLC || (data.appliesTLC && data.tlcName && data.tlcName.trim() !== ''), {
    message: "El nombre del TLC es requerido si la opción está activada.",
    path: ["tlcName"],
})
.refine(data => !data.appliesModexo || (data.appliesModexo && data.modexoCode && data.modexoCode.trim() !== ''), {
    message: "El código Modexo es requerido si la opción está activada.",
    path: ["modexoCode"],
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
  const { setCaseToAssignAforador } = useAppContext();
  const [groupMembers, setGroupMembers] = useState<AppUser[]>([]);

  const form = useForm<WorksheetFormData>({
    resolver: zodResolver(worksheetSchema),
    defaultValues: {
      ne: '', reference: '', executive: '', consignee: '', eta: null, facturaNumber: '', grossWeight: '', netWeight: '', description: '',
      packageNumber: '', entryCustoms: '', dispatchCustoms: '', resa: '',
      inLocalWarehouse: false, inCustomsWarehouse: false, location: '', documents: [], requiredPermits: [], operationType: null,
      patternRegime: '', subRegime: '', isJointOperation: false, jointNe: '',
      jointReference: '', dcCorrespondiente: '', isSplit: false, observations: '',
      appliesTLC: false, tlcName: '', appliesModexo: false, modexoCode: '',
      transportDocumentType: null, transportCompany: '', transportDocumentNumber: '',
    },
  });
  
  const { fields: docFields, append: appendDoc, remove: rhfRemoveDoc, update: updateDocField } = useFieldArray({
    control: form.control, name: "documents",
  });

  const { fields: permitFields, append: appendPermit, remove: removePermit, update: updatePermitField } = useFieldArray({
    control: form.control, name: "requiredPermits",
  });

  const [docType, setDocType] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [isOriginal, setIsOriginal] = useState(false);
  
  const [permitName, setPermitName] = useState('');
  const [otherPermitName, setOtherPermitName] = useState('');
  const [permitStatus, setPermitStatus] = useState<DocumentStatus>('Pendiente');
  const [selectedFacturaForPermit, setSelectedFacturaForPermit] = useState('');
  
  // States for the factura popover
  const [facturaPopoverOpen, setFacturaPopoverOpen] = useState(false);
  const [facturaNumberInput, setFacturaNumberInput] = useState('');
  const [facturaIsOriginal, setFacturaIsOriginal] = useState(false);
  
  useEffect(() => {
    if (user?.displayName) {
      form.setValue('executive', user.displayName);
    }
  }, [user, form]);
  
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!user?.visibilityGroup || user.visibilityGroup.length === 0) {
        setGroupMembers([]);
        return;
      }
      const uidsToFetch = Array.from(new Set([user.uid, ...user.visibilityGroup]));

      if (uidsToFetch.length === 0) return;

      const usersQuery = query(collection(db, 'users'), where('__name__', 'in', uidsToFetch));
      try {
          const querySnapshot = await getDocs(usersQuery);
          const members = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
          setGroupMembers(members);
      } catch (error) {
          console.error("Error fetching group members:", error);
          setGroupMembers([]);
      }
    };
    if (isOpen) {
      fetchGroupMembers();
    }
  }, [isOpen, user]);
  
  const watchOperationType = form.watch('operationType');
  const watchIsJoint = form.watch('isJointOperation');
  const watchInWarehouse = form.watch('inLocalWarehouse');
  const watchInCustoms = form.watch('inCustomsWarehouse');
  const watchTransportMode = form.watch('transportMode');
  const watchEntryCustoms = form.watch('entryCustoms');
  const watchDispatchCustoms = form.watch('dispatchCustoms');
  const watchedFacturaNumber = form.watch('facturaNumber');
  const watchAppliesTLC = form.watch('appliesTLC');
  const watchAppliesModexo = form.watch('appliesModexo');
  const enteredFacturas = watchedFacturaNumber ? watchedFacturaNumber.split(';').map(f => f.trim()).filter(f => f) : [];
  
  const removeDoc = (index: number) => {
    const docToRemove = docFields[index];
    if (docToRemove && docToRemove.type === 'FACTURA') {
        const currentFacturas = form.getValues('facturaNumber') || '';
        const facturasArray = currentFacturas.split(';').map(f => f.trim()).filter(f => f);
        const newFacturasArray = facturasArray.filter(f => f !== docToRemove.number);
        form.setValue('facturaNumber', newFacturasArray.join('; '));
    }
    rhfRemoveDoc(index);
  };


  const addDocument = () => {
    if (docType.trim().toLowerCase().replace(/\s+/g, '').includes('factura')) {
        toast({
            title: "Acción no permitida",
            description: "La factura principal debe añadirse con el botón 'Añadir Factura'.",
            variant: "destructive"
        });
        return;
    }
    if (docType.trim() && docNumber.trim()) {
      appendDoc({ id: uuidv4(), type: docType, number: docNumber, isCopy: !isOriginal, status: 'Entregado' });
      setDocType(''); setDocNumber(''); setIsOriginal(false);
    } else {
        toast({ title: "Datos incompletos", description: "Por favor, complete el tipo y número de documento.", variant: "destructive" });
    }
  };
  
  const handleAddFactura = () => {
    const facturaNumbers = facturaNumberInput.split(/[,;]/).map(f => f.trim()).filter(f => f);

    if (facturaNumbers.length > 0) {
        let currentFacturas = form.getValues('facturaNumber') || '';
        let facturasArray = currentFacturas ? currentFacturas.split(';').map(f => f.trim()) : [];
        let addedCount = 0;

        facturaNumbers.forEach(facturaNum => {
            if (!facturasArray.includes(facturaNum)) {
                facturasArray.push(facturaNum);
                appendDoc({ id: uuidv4(), type: 'FACTURA', number: facturaNum, isCopy: !facturaIsOriginal, status: 'Entregado'});
                addedCount++;
            }
        });

        form.setValue('facturaNumber', facturasArray.join('; '));
        
        if (addedCount > 0) {
            toast({ title: `Factura(s) Añadida(s)`, description: `${addedCount} nueva(s) factura(s) registrada(s).` });
        } else {
            toast({ title: "Sin cambios", description: "Las facturas ingresadas ya existían en la lista.", variant: "default" });
        }
        
        setFacturaPopoverOpen(false);
        setFacturaNumberInput('');
    } else {
        toast({ title: "Número de factura requerido", description: "Ingrese uno o más números de factura.", variant: "destructive" });
    }
  }

  const addPermit = () => {
    const finalPermitName = permitName === 'OTROS' ? otherPermitName.trim() : permitName.trim();
    if (finalPermitName) {
      let facturaParaPermiso = selectedFacturaForPermit;
      if (!facturaParaPermiso && enteredFacturas.length === 1) {
          facturaParaPermiso = enteredFacturas[0];
      }

      if (permitStatus === 'Entregado') {
        appendDoc({ id: uuidv4(), type: finalPermitName, number: 'VER BITACORA', isCopy: false, status: 'Entregado' });
      } else {
        appendPermit({ 
            id: uuidv4(), 
            name: finalPermitName, 
            status: permitStatus, 
            facturaNumber: facturaParaPermiso,
            assignedExecutive: user?.displayName || '' // Default to current user
        });
      }
      setPermitName('');
      setOtherPermitName('');
      setPermitStatus('Pendiente');
      setSelectedFacturaForPermit('');
    } else {
      toast({ title: "Nombre requerido", description: "Por favor, ingrese el nombre del permiso.", variant: "destructive" });
    }
  };
  
  const handleResubmitPermit = (index: number) => {
    updatePermitField(index, { ...permitFields[index], status: 'En Trámite' });
    toast({ title: "Permiso Reenviado", description: "El estado del permiso se ha actualizado a 'En Trámite'." });
  };


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
        const createdByInfo = { by: user.displayName, at: creationTimestamp };

        const worksheetData: Worksheet = { ...data, id: neTrimmed, ne: neTrimmed, eta: data.eta ? Timestamp.fromDate(data.eta) : null, createdAt: creationTimestamp, createdBy: user.email!, requiredPermits: data.requiredPermits || [], lastUpdatedAt: creationTimestamp };
        batch.set(worksheetDocRef, worksheetData);

        const aforoCaseData: Partial<AforoCase> = {
            ne: neTrimmed,
            executive: data.executive,
            consignee: data.consignee,
            facturaNumber: data.facturaNumber,
            declarationPattern: data.patternRegime,
            merchandise: data.description,
            createdBy: user.uid,
            createdAt: creationTimestamp,
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
            aforador: '',
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
        
        // Special flow for PSMT
        if (data.consignee.trim().toUpperCase() === 'PSMT NICARAGUA, SOCIEDAD ANONIMA') {
            const fullCaseData: AforoCase = { ...aforoCaseData, id: neTrimmed } as AforoCase;
            setCaseToAssignAforador(fullCaseData);
        }

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
                    <FormField control={form.control} name="reference" render={({ field }) => (<FormItem><FormLabel>Referencia</FormLabel><FormControl><Input {...field} maxLength={12} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="executive" render={({ field }) => (<FormItem><FormLabel>Ejecutivo</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)}/>
                    
                    <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        <FormField
                            control={form.control}
                            name="consignee"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Consignatario</FormLabel>
                                    <FormControl>
                                        <ConsigneeSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                             <div className="flex items-center p-3 border rounded-md min-h-[58px]">
                                <FormField
                                    control={form.control}
                                    name="appliesTLC"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 flex-1">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="appliesTLC-check" /></FormControl>
                                            <Label htmlFor="appliesTLC-check" className="font-normal cursor-pointer">¿Aplica TLC?</Label>
                                        </FormItem>
                                    )}
                                />
                                {watchAppliesTLC && (
                                    <FormField control={form.control} name="tlcName" render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl><Input placeholder="Nombre del TLC" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                )}
                            </div>
                            <div className="flex items-center p-3 border rounded-md min-h-[58px]">
                                <FormField
                                    control={form.control}
                                    name="appliesModexo"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 flex-1">
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="appliesModexo-check"/></FormControl>
                                            <Label htmlFor="appliesModexo-check" className="font-normal cursor-pointer">¿Aplica Modexo?</Label>
                                        </FormItem>
                                    )}
                                />
                                {watchAppliesModexo && (
                                    <FormField control={form.control} name="modexoCode" render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl><Input placeholder="Código Modexo" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                )}
                            </div>
                        </div>
                    </div>
                     <div className="lg:col-span-3">
                        <FormField
                            control={form.control}
                            name="eta"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>ETA (Fecha Estimada de Arribo)</FormLabel>
                                    <FormControl>
                                        <DatePicker date={field.value ?? undefined} onDateChange={(date) => field.onChange(date)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="lg:col-span-3">
                        <FormField control={form.control} name="facturaNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Factura</FormLabel>
                                <FormControl><Input {...field} readOnly placeholder="Añada facturas con el botón dedicado. Separe con ; si son varias." className="bg-muted/50 cursor-not-allowed"/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>

                    <FormField control={form.control} name="grossWeight" render={({ field }) => (<FormItem><FormLabel>Peso Bruto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="netWeight" render={({ field }) => (<FormItem><FormLabel>Peso Neto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="packageNumber" render={({ field }) => (<FormItem><FormLabel>Número de Bultos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                     
                     <div className="lg:col-span-3">
                         <FormField
                            control={form.control}
                            name="entryCustoms"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Aduana Entrada</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between truncate",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                                >
                                                {field.value
                                                    ? aduanas.find(
                                                        (aduana) => aduana.value === field.value
                                                    )?.label
                                                    : "Seleccionar aduana..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Buscar aduana..." />
                                                <CommandList>
                                                <CommandEmpty>No se encontró aduana.</CommandEmpty>
                                                <CommandGroup>
                                                    {aduanas.map((aduana) => (
                                                    <CommandItem
                                                        value={aduana.label}
                                                        key={aduana.value}
                                                        onSelect={() => {
                                                        form.setValue("entryCustoms", aduana.value)
                                                        }}
                                                    >
                                                        <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            aduana.value === field.value
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                        )}
                                                        />
                                                        {aduana.label}
                                                    </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                                </CommandList>
                                            </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {watchEntryCustoms && <Badge variant="secondary">{watchEntryCustoms}</Badge>}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                         )}/>
                     </div>
                     <div className="lg:col-span-3">
                         <FormField
                            control={form.control}
                            name="dispatchCustoms"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Aduana Despacho</FormLabel>
                                 <div className="flex items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between truncate",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value
                                                ? aduanas.find(
                                                    (aduana) => aduana.value === field.value
                                                )?.label
                                                : "Seleccionar aduana..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar aduana..." />
                                            <CommandList>
                                            <CommandEmpty>No se encontró aduana.</CommandEmpty>
                                            <CommandGroup>
                                            {aduanas.map((aduana) => (
                                                <CommandItem
                                                value={aduana.label}
                                                key={aduana.value}
                                                onSelect={() => {
                                                    form.setValue("dispatchCustoms", aduana.value)
                                                }}
                                                >
                                                <Check
                                                    className={cn(
                                                    "mr-2 h-4 w-4",
                                                    aduana.value === field.value
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                    )}
                                                />
                                                {aduana.label}
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {watchDispatchCustoms && <Badge variant="secondary">{watchDispatchCustoms}</Badge>}
                                </div>
                                <FormMessage />
                            </FormItem>
                         )}/>
                     </div>

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
                        <div className="flex items-center gap-4">
                           <FormField control={form.control} name="inLocalWarehouse" render={({ field }) => (
                             <FormItem className="flex flex-row items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>En Almacén Local</FormLabel></FormItem>
                           )}/>
                            <FormField control={form.control} name="inCustomsWarehouse" render={({ field }) => (
                             <FormItem className="flex flex-row items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>En Aduana Aérea</FormLabel></FormItem>
                           )}/>
                        </div>
                       {(watchInWarehouse || watchInCustoms) && <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormControl><Input placeholder="Especifique localización..." {...field} /></FormControl><FormMessage /></FormItem>)}/>}
                    </div>
                </div>
                 {(watchInWarehouse || watchInCustoms || watchTransportMode === 'aereo') && (
                     <FormField
                        control={form.control}
                        name="resa"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>RESA</FormLabel>
                                <FormControl><Input {...field} placeholder="Número de RESA" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 )}

                <div className="pt-4 border-t">
                    <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-medium">Documentos Entregados</h3>
                        <Popover open={facturaPopoverOpen} onOpenChange={setFacturaPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="sm"><Receipt className="mr-2 h-4 w-4"/> Añadir Factura</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Añadir Factura(s)</h4>
                                        <p className="text-sm text-muted-foreground">Separe múltiples números con coma o punto y coma.</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="factura-number">Número(s) de Factura</Label>
                                        <Input id="factura-number" value={facturaNumberInput} onChange={e => setFacturaNumberInput(e.target.value)} />
                                        <div className="flex items-center space-x-2">
                                            <Switch id="factura-original" checked={facturaIsOriginal} onCheckedChange={setFacturaIsOriginal} />
                                            <Label htmlFor="factura-original">Es Original</Label>
                                        </div>
                                        <Button onClick={handleAddFactura}>Guardar Factura(s)</Button>
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
                        <div className="rounded-md border"><Table>
                            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Número</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                            <TableBody>{docFields.map((field, index) => (<TableRow key={field.id}><TableCell>{field.type}</TableCell><TableCell>{field.number}</TableCell><TableCell>{field.isCopy ? 'Copia' : 'Original'}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>))}</TableBody>
                        </Table></div>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-2">Permisos Requeridos</h3>
                     <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end mb-4 p-3 border rounded-md">
                        <div className="grid gap-2">
                            <Label>Nombre del Permiso</Label>
                            <Select value={permitName} onValueChange={setPermitName}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar permiso..." /></SelectTrigger>
                                <SelectContent>
                                    {permitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {permitName === 'OTROS' && <Input value={otherPermitName} onChange={e => setOtherPermitName(e.target.value)} placeholder="Indique cuál" />}
                        </div>
                         <div>
                            <Label>Factura Asociada</Label>
                             <Select value={selectedFacturaForPermit} onValueChange={setSelectedFacturaForPermit} disabled={enteredFacturas.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar factura..." /></SelectTrigger>
                                <SelectContent>
                                    {enteredFacturas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                </SelectContent>
                             </Select>
                         </div>
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
                            <TableHeader><TableRow>
                                <TableHead>Permiso</TableHead>
                                <TableHead>Factura Asociada</TableHead>
                                {groupMembers.length > 1 && <TableHead>Asignado A</TableHead>}
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>{permitFields.map((field, index) => {
                                const currentPermit = form.getValues(`requiredPermits.${index}`);
                                return (
                                <TableRow key={field.id}>
                                    <TableCell>{field.name}</TableCell>
                                    <TableCell>{field.facturaNumber || 'N/A'}</TableCell>
                                    {groupMembers.length > 1 && (
                                        <TableCell>
                                            <Controller
                                                control={form.control}
                                                name={`requiredPermits.${index}.assignedExecutive`}
                                                render={({ field: controllerField }) => (
                                                     <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value || user?.displayName || ''}>
                                                        <SelectTrigger className="w-[180px]">
                                                            <SelectValue placeholder="Asignar ejecutivo..." />
                                                        </SelectTrigger>
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
                                        {currentPermit.status === 'Rechazado' ? (
                                            <div className="flex items-center gap-2">
                                                 <Badge variant="destructive">Rechazado</Badge>
                                                 <Button size="sm" variant="outline" onClick={() => handleResubmitPermit(index)}>
                                                     <RotateCcw className="mr-2 h-4 w-4" /> Someter Nuevamente
                                                 </Button>
                                            </div>
                                        ) : (
                                            <Controller
                                                control={form.control}
                                                name={`requiredPermits.${index}.status`}
                                                render={({ field: controllerField }) => (
                                                    <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                            <SelectItem value="En Trámite">En Trámite</SelectItem>
                                                            <SelectItem value="Entregado">Entregado</SelectItem>
                                                            <SelectItem value="Rechazado">Rechazado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => removePermit(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            )})}</TableBody>
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
                            <FormField
                                control={form.control}
                                name="patternRegime"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Modelo (Patrón)</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                    >
                                                        {field.value
                                                            ? tiposDeclaracion.find(
                                                                (tipo) => tipo.value === field.value
                                                            )?.value
                                                            : "Seleccionar..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Buscar por código..." />
                                                    <CommandList>
                                                        <CommandEmpty>No se encontró el modelo.</CommandEmpty>
                                                        <CommandGroup>
                                                            {tiposDeclaracion.map(tipo => (
                                                                <CommandItem
                                                                    value={tipo.value}
                                                                    key={tipo.value}
                                                                    onSelect={() => {
                                                                        form.setValue("patternRegime", tipo.value);
                                                                    }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", tipo.value === field.value ? "opacity-100" : "opacity-0")} />
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold">{tipo.value}</span>
                                                                        <span className="text-xs text-muted-foreground">{tipo.label}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                
                 <div className="flex items-end gap-6 pt-4">
                    <FormField control={form.control} name="dcCorrespondiente" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Ingresar DC Correspondiente" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="isSplit" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 pb-2">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="is-split"/></FormControl>
                            <FormLabel htmlFor="is-split" className="text-sm font-normal">Es Split</FormLabel>
                        </FormItem>
                    )}/>
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
