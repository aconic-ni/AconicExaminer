
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'gestor' | 'aforador' | 'ejecutivo' | 'coordinadora';

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
}

// User type from Firebase, can be extended
export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: UserRole | null;
  roleTitle?: string | null; // Custom title for display purposes
  isStaticUser?: boolean;
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
