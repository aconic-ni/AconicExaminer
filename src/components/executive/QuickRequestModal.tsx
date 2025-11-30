
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import type { WorksheetWithCase } from '@/types';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useRouter } from 'next/navigation';

const quickRequestSchema = z.object({
  reference: z.string().optional(),
  location: z.string().min(1, "La ubicación es requerida."),
});

type QuickRequestFormData = z.infer<typeof quickRequestSchema>;

interface QuickRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseWithWorksheet: WorksheetWithCase;
}

export function QuickRequestModal({ isOpen, onClose, caseWithWorksheet }: QuickRequestModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<QuickRequestFormData>({
    resolver: zodResolver(quickRequestSchema),
    defaultValues: { reference: '', location: '' },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            reference: '',
            location: caseWithWorksheet.worksheet?.location || '',
        })
    }
  }, [isOpen, caseWithWorksheet, form]);
  
  const backLink = user?.role === 'coordinadora' ? '/assignments' : '/executive';

  const onSubmit = async (data: QuickRequestFormData) => {
    if (!user || !user.email) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    if (!caseWithWorksheet.worksheet) {
        toast({ title: 'Error', description: 'No se encontró la hoja de trabajo asociada.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const ne = caseWithWorksheet.ne.toUpperCase().trim();
    
    const requestDocRef = doc(db, "solicitudesExamen", ne);
    const examDocRef = doc(db, "examenesPrevios", ne);
    const worksheetDocRef = doc(db, "worksheets", caseWithWorksheet.worksheetId!);

    try {
        const [requestSnap, examSnap] = await Promise.all([
            getDoc(requestDocRef),
            getDoc(examDocRef)
        ]);

        if (requestSnap.exists() || examSnap.exists()) {
            toast({
                title: "Solicitud Duplicada",
                description: `Ya existe una solicitud o un examen previo para el NE: ${ne}.`,
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }

        const batch = writeBatch(db);
        
        // 1. Create the new exam request
        const requestData = {
            ne: ne,
            reference: data.reference || '',
            consignee: caseWithWorksheet.consignee,
            location: data.location,
            status: 'pendiente' as const,
            requestedBy: user.email!,
            requestedAt: Timestamp.fromDate(new Date()),
        };
        batch.set(requestDocRef, requestData);

        // 2. Update the location in the original worksheet if it has changed
        if (data.location !== caseWithWorksheet.worksheet.location) {
            batch.update(worksheetDocRef, { location: data.location });
        }

        await batch.commit();

        toast({
            title: "Solicitud Enviada",
            description: `La solicitud para el examen NE: ${ne} ha sido creada y la ubicación ha sido actualizada.`,
        });
        router.push(backLink);
        onClose();

    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: `Verificación o creación para NE: ${ne}`,
            operation: 'write',
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitud Rápida de Previo</DialogTitle>
          <DialogDescription>
            Creando una solicitud para el NE: <span className="font-bold text-foreground">{caseWithWorksheet.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1 text-muted-foreground">
            <p><strong>Consignatario:</strong> {caseWithWorksheet.consignee}</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación de la Mercancía</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Especifique la ubicación" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (Contenedor, Guía, BL...)</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} placeholder="Ingrese la nueva referencia" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Enviar Solicitud
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
