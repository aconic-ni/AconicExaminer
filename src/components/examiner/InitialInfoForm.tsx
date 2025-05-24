
"use client";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext, ExamStep } from '@/context/AppContext';
import type { InitialInfoFormData} from './FormParts/zodSchemas';
import { initialInfoSchema } from './FormParts/zodSchemas';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

// Helper function to extract and format name from email
function extractNameFromEmail(email?: string | null): string {
  if (!email) return "";
  try {
    const localPart = email.substring(0, email.lastIndexOf('@'));
    const nameParts = localPart.split(/[._-]/); // Split by dot, underscore, or hyphen
    const formattedName = nameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
    return formattedName;
  } catch (error) {
    console.error("Error extracting name from email:", error);
    return ""; // Return empty string or a default name if extraction fails
  }
}

export function InitialInfoForm() {
  const { setExamData, setCurrentStep, examData: existingExamData } = useAppContext();
  const { user } = useAuth(); // Get user from AuthContext

  const defaultManagerName = 
    existingExamData?.manager || 
    (user?.email ? extractNameFromEmail(user.email) : '');

  const form = useForm<InitialInfoFormData>({
    resolver: zodResolver(initialInfoSchema),
    defaultValues: {
      ne: existingExamData?.ne || '',
      reference: existingExamData?.reference || '',
      manager: defaultManagerName,
      location: existingExamData?.location || '',
    },
  });

  function onSubmit(data: InitialInfoFormData) {
    setExamData(data);
    setCurrentStep(ExamStep.PRODUCT_LIST);
  }

  return (
    <Card className="w-full max-w-3xl mx-auto custom-shadow">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-800">Nuevo Examen</CardTitle>
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
                    <FormLabel>Referencia (Contenedor, Guía, BL, Factura...)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: MSKU1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Gestor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo del gestor" {...field} />
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
            <div className="flex justify-end pt-2">
              <Button type="submit" className="btn-primary px-6 py-3">
                Continuar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
