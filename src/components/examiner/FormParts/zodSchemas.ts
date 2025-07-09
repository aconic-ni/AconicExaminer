import { z } from 'zod';

export const initialInfoSchema = z.object({
  ne: z.string().min(1, "NE es requerido."),
  reference: z.string().optional(),
  manager: z.string().min(1, "Nombre del Gestor es requerido."),
  location: z.string().min(1, "Ubicación es requerida."),
  consignee: z.string().min(1, "Consignatario es requerido."),
});

export type InitialInfoFormData = z.infer<typeof initialInfoSchema>;

export const productSchema = z.object({
  id: z.string().optional(), // Optional for new products, required for updates
  itemNumber: z.string().optional(),
  weight: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  unitMeasure: z.string().optional(),
  serial: z.string().optional(),
  origin: z.string().optional(),
  numberPackages: z.string().optional(),
  quantityPackages: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().min(0, "Cantidad de bultos debe ser positiva.").optional()
  ),
  quantityUnits: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().min(0, "Cantidad de unidades debe ser positiva.").optional()
  ),
  packagingCondition: z.string().optional(),
  observation: z.string().optional(),
  isConform: z.boolean().default(false),
  isExcess: z.boolean().default(false),
  isMissing: z.boolean().default(false),
  isFault: z.boolean().default(false),
});

export type ProductFormData = z.infer<typeof productSchema>;
