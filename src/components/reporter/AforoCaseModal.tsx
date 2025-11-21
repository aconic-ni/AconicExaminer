"use client";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { X, Loader2, Calendar } from 'lucide-react';
import { DatePickerWithTime } from '@/components/reports/DatePickerWithTime';
import { useEffect } from 'react';

const aforoCaseSchema = z.object({
  ne: z.string().min(1, "El NE es requerido."),
  consignee: z.string().min(1, "El Consignatario es requerido."),
  declarationPattern: z.string().min(1, "El Patrón de la Declaración es requerido."),
  merchandise: z.string().min(1, "La Mercancía es requerida."),
  aforador: z.string().min(1, "El nombre del Aforador es requerido."),
  totalPosiciones: z.coerce.number({
    invalid_type_error: "Debe ser un número."
  }).optional(),
  assignmentDate: z.date({
    required_error: "La fecha de asignación es requerida.",
  }),
});

type AforoCaseFormData = z.infer<typeof aforoCaseSchema>;

interface AforoCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AforoCaseModal({ isOpen, onClose }: AforoCaseModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<AforoCaseFormData>({
    resolver: zodResolver(aforoCaseSchema),
    defaultValues: {
      ne: '',
      consignee: '',
      declarationPattern: '',
      merchandise: '',
      aforador: '',
      assignmentDate: new Date(),
    },
  });

  useEffect(() => {
    if (user?.displayName) {
        form.setValue('aforador', user.displayName);
    }
  }, [user, form]);

  const onSubmit = async (data: AforoCaseFormData) => {
    if (!user) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive'});
        return;
    }

    const neTrimmed = data.ne.trim().toUpperCase();
    const caseDocRef = doc(db, 'AforoCases', neTrimmed);

    try {
        const docSnap = await getDoc(caseDocRef);
        if (docSnap.exists()) {
            toast({
                title: "Registro Duplicado",
                description: "Ya existe un caso de aforo con este NE. No se puede crear de nuevo.",
                variant: "destructive",
            });
            return;
        }

        await setDoc(caseDocRef, {
            ...data,
            ne: neTrimmed,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            revisorStatus: 'Pendiente'
        });

        toast({
            title: "Registro Creado",
            description: `El caso de aforo para el NE ${neTrimmed} ha sido guardado.`,
        });
        onClose();
        form.reset();

    } catch (error) {
        console.error("Error creating aforo case: ", error);
        toast({ title: 'Error', description: 'No se pudo crear el registro de aforo.', variant: 'destructive'});
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo Registro de Aforo</DialogTitle>
          <DialogDescription>Complete los datos para registrar un nuevo caso de aforo.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="ne" render={({ field }) => (
                <FormItem><FormLabel>NE</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="consignee" render={({ field }) => (
                <FormItem><FormLabel>Consignatario / Cliente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="declarationPattern" render={({ field }) => (
                <FormItem><FormLabel>Patrón de la Dec.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="merchandise" render={({ field }) => (
                <FormItem><FormLabel>Mercancía</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="aforador" render={({ field }) => (
                <FormItem><FormLabel>Aforador</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="totalPosiciones" render={({ field }) => (
                 <FormItem><FormLabel>Total Posiciones</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField control={form.control} name="assignmentDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel className="mb-1">Fecha de Asignación</FormLabel>
                    <FormControl>
                        <DatePickerWithTime date={field.value} onDateChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
              )}/>
            </div>
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Registro
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
