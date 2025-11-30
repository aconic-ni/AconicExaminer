
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import type { AforoCase, AforoCaseUpdate } from '@/types';
import { Loader2 } from 'lucide-react';

const commentSchema = z.object({
  comment: z.string().min(1, 'El motivo es requerido.'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface AforadorCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: AforoCase;
}

export function AforadorCommentModal({ isOpen, onClose, caseData }: AforadorCommentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { comment: caseData.aforadorComment || '' },
  });

  const canEdit = user?.role === 'aforador' || user?.role === 'admin' || user?.role === 'coordinadora';

  const onSubmit = async (data: CommentFormData) => {
    if (!user || !user.displayName) {
        toast({ title: 'Error', description: 'Debe estar autenticado.', variant: 'destructive' });
        return;
    }

    if (!canEdit) {
        toast({ title: 'Permiso Denegado', description: 'No tiene permisos para añadir un comentario.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const caseDocRef = doc(db, 'AforoCases', caseData.id);
    const updatesSubcollectionRef = collection(caseDocRef, 'actualizaciones');

    try {
        await updateDoc(caseDocRef, {
            aforadorComment: data.comment,
        });

        const updateLog: AforoCaseUpdate = {
            updatedAt: Timestamp.now(),
            updatedBy: user.displayName,
            field: 'aforadorComment',
            oldValue: caseData.aforadorComment || '',
            newValue: data.comment,
        };
        await addDoc(updatesSubcollectionRef, updateLog);

        toast({
            title: `Comentario Guardado`,
            description: `El motivo del estado "Incompleto" ha sido guardado.`,
        });
        onClose();

    } catch (error) {
        console.error("Error updating aforador comment:", error);
        toast({ title: 'Error', description: 'No se pudo guardar el comentario.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo del Estado "Incompleto"</DialogTitle>
          <DialogDescription>
            Explique por qué el caso NE: <span className="font-bold text-foreground">{caseData.ne}</span> está incompleto.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      disabled={!canEdit || isSubmitting}
                      placeholder={canEdit ? 'Añada el motivo aquí...' : 'Sin motivo.'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                {canEdit && (
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Guardar Motivo
                    </Button>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
