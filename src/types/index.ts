

import { Timestamp } from 'firebase/firestore';

export type UserRole = 'gestor' | 'aforador' | 'ejecutivo' | 'coordinadora' | 'admin' | 'agente' | 'digitador' | 'supervisor';

export interface ExamData {
  ne: string;
  reference?: string | null;
  manager: string;
  location: string;
  consignee: string;
}

export interface Product {
  id: string; // unique id for React keys and updates
  itemNumber?: string | null;
  weight?: string | null;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  unitMeasure?: string | null;
  serial?: string | null;
  origin?: string | null;
  numberPackages?: string | null;
  quantityPackages?: number | string | null;
  quantityUnits?: number | string | null;
  packagingCondition?: string | null;
  observation?: string | null;
  isConform: boolean;
  isExcess: boolean;
  isMissing: boolean;
  isFault: boolean;
  productTimestampSaveAt?: Timestamp;
}

// User type from Firebase, can be extended
export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: UserRole | null;
  roleTitle?: string | null; // Custom title for display purposes
  isStaticUser?: boolean;
  hasReportsAccess?: boolean; // New field for CustomsReports
}

export interface ExamDocument extends ExamData {
  id?: string; // Add optional id for mapping in reports
  products: Product[];
  savedBy: string | null; // Email of the user who saved it
  status?: 'incomplete' | 'complete' | 'requested' | 'assigned'; // To track exam status
  lock?: 'on' | 'off'; // To prevent concurrent edits
  createdAt?: Timestamp | null; // When the exam was first created
  savedAt?: Timestamp | null; // When the exam was last saved (preview)
  lastUpdated?: Timestamp | null; // To track last soft save
  completedAt?: Timestamp | null; // When the exam was finalized
  commentCount?: number; // For report comment counts
  requestedBy?: string | null; // email of executive
  requestedAt?: Timestamp | null;
  assignedTo?: string | null; // name of gestor
  assignedAt?: Timestamp | null;
  isArchived?: boolean; // For soft delete
}

export interface Comment {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    authorRoleTitle?: string | null; // Custom title for display
    createdAt: Timestamp;
}

// Interface for data passed to downloadExcelFile
// It accommodates both PreviewScreen (without savedAt/savedBy) and DatabasePage (with them)
export interface ExportableExamData extends ExamData {
  products?: Product[] | null;
  createdAt?: Timestamp | Date | null;
  completedAt?: Timestamp | Date | null;
  savedBy?: string | null;
  savedAt?: Timestamp | Date | null;
}

export interface AuditLogEntry {
    examNe: string;
    action: 'product_added' | 'product_updated' | 'product_deleted';
    changedBy: string | null;
    changedAt: Timestamp;
    details: {
        productId: string;
        previousData?: Partial<Product> | null;
        newData?: Partial<Product> | null;
        [key: string]: any;
    };
}

export interface AdminAuditLogEntry {
    id: string;
    collection: string;
    docId: string;
    adminId: string;
    adminEmail: string;
    timestamp: Timestamp;
    action: 'update';
    changes: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
}


export interface ExamRequest {
    id: string;
    ne: string;
    reference?: string | null;
    consignee: string;
    location: string;
    status: 'pendiente' | 'asignado' | 'completado';
    requestedBy: string; // email of executive
    requestedAt: Timestamp;
    assignedTo?: string; // name of gestor
    assignedAt?: Timestamp;
}

export interface ReportAccessRequest {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Timestamp;
  processedAt?: Timestamp;
}

export type AforoCaseStatus = 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Revalidación Solicitada';
export type AforadorStatus = 'En proceso' | 'Incompleto' | 'Listo para revisión' | 'Pendiente por completar';
export type DigitacionStatus = 'Pendiente de Digitación' | 'En Proceso' | 'Almacenado' | 'Completar Trámite' | 'Trámite Completo';
export type IncidentStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface AforoCase {
  id: string; // Will be the NE value
  ne: string;
  executive: string;
  consignee: string;
  declarationPattern: string;
  merchandise: string;
  aforador: string; // Name of the person
  assignmentDate: Date | Timestamp;
  createdBy: string; // UID of the user who created it
  createdAt: Timestamp;
  totalPosiciones?: number;
  entregadoAforoAt?: Timestamp | null;
  revisorAsignado?: string | null;
  revisorStatus?: AforoCaseStatus;
  observacionRevisor?: string | null;
  aforadorStatus?: AforadorStatus;
  aforadorComment?: string | null;
  worksheetId?: string; // Link to the original worksheet
  // Digitization fields
  digitacionStatus?: DigitacionStatus;
  digitadorAsignado?: string | null;
  digitadorAsignadoAt?: Timestamp | null;
  digitacionComment?: string | null;
  declaracionAduanera?: string | null; // Customs declaration number
  // Incident fields
  incidentReported?: boolean;
  incidentReason?: string | null; // Original simple reason
  incidentStatus?: IncidentStatus;
  incidentReportedBy?: string | null; // displayName of user
  incidentReportedAt?: Timestamp | null;
  incidentReviewedBy?: string | null; // displayName of agent
  incidentReviewedAt?: Timestamp | null;
  // New detailed incident fields for rectification
  reciboDeCajaPagoInicial?: string | null;
  pagoInicialRealizado?: boolean;
  noLiquidacion?: string | null;
  motivoRectificacion?: string | null;
  observaciones?: string | null;
  observacionesContabilidad?: string | null;
  // Relationship to preliquidacion
  preliquidaciones?: Preliquidacion[];
  // New fields for executive tracking
  selectividad?: string | null;
  fechaDespacho?: Timestamp | null;
  facturado?: boolean;
  facturadoAt?: Timestamp | null;
}

export interface AforoCaseUpdate {
    updatedAt: Timestamp;
    updatedBy: string; // displayName of the user
    field: keyof AforoCase | 'status_change' | 'creation' | 'incident_report' | 'document_update';
    oldValue: any;
    newValue: any;
    comment?: string; // For rejection reasons
}

export type DocumentStatus = 'Entregado' | 'En Trámite' | 'Pendiente';

export interface WorksheetDocument {
  id: string; 
  type: string;
  number: string;
  isCopy: boolean;
  status?: DocumentStatus;
}

export interface RequiredPermit {
    id: string;
    name: string;
    status: DocumentStatus;
    tramiteDate?: Timestamp | null;
    estimatedDeliveryDate?: Timestamp | null;
}

export interface Worksheet {
  id: string; // The NE
  ne: string;
  executive: string;
  consignee: string;
  grossWeight: string;
  netWeight: string;
  description: string;
  packageNumber: string;
  entryCustoms: string;
  dispatchCustoms: string;
  transportMode: 'aereo' | 'maritimo' | 'frontera' | 'terrestre';
  inLocalWarehouse: boolean;
  location?: string;
  documents: WorksheetDocument[];
  requiredPermits?: RequiredPermit[];
  operationType?: 'importacion' | 'exportacion' | null;
  patternRegime?: string;
  subRegime?: string;
  isJointOperation: boolean;
  jointNe?: string;
  jointReference?: string;
  observations?: string;
  createdAt: Timestamp;
  createdBy: string; // user email
}

export interface WorksheetWithCase extends Worksheet {
    aforoCase?: AforoCase;
}

export interface PreliquidacionItem {
    id: string;
    description: string;
    value: number;
    tax: number;
}

export interface Preliquidacion {
    id: string;
    caseId: string;
    noLiquidacion: string;
    totalGravamen: number;
    totalMultas: number;
    totalGeneral: number;
    items: PreliquidacionItem[];
    createdAt: Timestamp;
    createdBy: string;
}
