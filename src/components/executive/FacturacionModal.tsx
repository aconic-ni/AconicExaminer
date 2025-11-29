
"use client";

import { useState } from 'react';
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
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Loader2, Receipt } from 'lucide-react';

const facturacionSchema = z.object({
  cuentaDeRegistro: z.string().min(1, 'La cuenta de registro es requerida.'),
});

type FacturacionFormData = z.infer<typeof facturacionSchema>;

interface FacturacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function FacturacionModal({ isOpen, onClose, caseData }: FacturacionModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FacturacionFormData>({
    resolver: zodResolver(facturacionSchema),
    defaultValues: { cuentaDeRegistro: caseData.cuentaDeRegistro || '' },
  });

  const onSubmit = async (data: FacturacionFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }
    
    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');
    const batch = writeBatch(db);

    try {
        const now = Timestamp.now();
        batch.update(caseDocRef, {
            facturado: true,
            facturadoAt: now,
            cuentaDeRegistro: data.cuentaDeRegistro,
        });

        const updateLog: AforoCaseUpdate = {
            updatedAt: now,
            updatedBy: user.displayName,
            field: 'facturado',
            oldValue: 'No',
            newValue: 'Sí',
            comment: `Caso marcado como facturado con cuenta de registro: ${data.cuentaDeRegistro}`,
        };
        batch.set(doc(updatesSubcollectionRef), updateLog);
        
        await batch.commit();

        toast({
            title: `Caso Facturado`,
            description: `El caso NE ${caseData.ne} ha sido marcado como facturado.`,
        });
        onClose();

    } catch (error) {
        console.error("Error updating case to facturado:", error);
        toast({ title: 'Error', description: 'No se pudo actualizar el caso.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Facturación</DialogTitle>
          <DialogDescription>
            Ingrese la cuenta de registro para el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="cuentaDeRegistro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Receipt /> Cuenta de Registro</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isSubmitting}
                      placeholder="Ingrese la cuenta..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Guardar y Facturar
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
