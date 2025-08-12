
"use client";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const requestSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  reference: z.string().optional(),
  location: z.string().min(1, "Ubicación es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
});

type RequestFormData = z.infer<typeof requestSchema>;

export function RequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      ne: '',
      reference: '',
      consignee: '',
      location: '',
    },
  });
  
  const backLink = user?.role === 'coordinadora' ? '/assignments' : '/executive';

  async function onSubmit(data: RequestFormData) {
    if (!user || !user.email) {
      toast({
        title: "Error de autenticación",
        description: "No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.",
        variant: "destructive",
      });
      return;
    }

    try {
      const requestDocRef = doc(db, "solicitudesExamen", data.ne.toUpperCase());
      
      const requestData = {
        ...data,
        status: 'pendiente',
        requestedBy: user.email,
        requestedAt: Timestamp.fromDate(new Date()),
      };

      await setDoc(requestDocRef, requestData);

      toast({
        title: "Solicitud Enviada",
        description: `La solicitud para el examen NE: ${data.ne} ha sido creada exitosamente.`,
      });

      router.push(backLink);
    } catch (error) {
      toast({
        title: "Error al Enviar",
        description: "No se pudo guardar la solicitud. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
      console.error("Failed to save exam request:", error);
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Solicitar Nuevo Examen Previo</CardTitle>
        <CardDescription>Complete la información para generar una nueva solicitud.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="ne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NE (Seguimiento NX1) *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: NX1-12345" {...field} />
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
                      <Input placeholder="Ej: MSKU1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="consignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignatario *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del consignatario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación de la Mercancía *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Almacén Central, Bodega 5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between items-center pt-4">
               <Button type="button" variant="ghost" asChild>
                  <Link href={backLink}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                  </Link>
                </Button>
              <Button type="submit" className="btn-primary">
                Enviar Solicitud
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
