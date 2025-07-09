
import type { Timestamp } from 'firebase/firestore';

export interface ExamData {
  ne: string;
  reference?: string;
  manager: string;
  location: string;
  consignee: string;
}

export interface Product {
  id: string; // unique id for React keys and updates
  itemNumber?: string;
  weight?: string;
  description?: string;
  brand?: string;
  model?: string;
  unitMeasure?: string;
  serial?: string;
  origin?: string;
  numberPackages?: string;
  quantityPackages?: number | string; // Allow string for input flexibility, parse to number
  quantityUnits?: number | string; // Allow string for input flexibility, parse to number
  packagingCondition?: string;
  observation?: string;
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
  isStaticUser?: boolean; // Flag for the static user
}

export interface ExamDocument extends ExamData {
  products: Product[];
  savedAt: Timestamp; // Firestore Timestamp for when it was saved
  savedBy: string | null; // Email of the user who saved it
}

// Interface for data passed to downloadExcelFile
// It accommodates both PreviewScreen (without savedAt/savedBy) and DatabasePage (with them)
export interface ExportableExamData extends ExamData {
  products?: Product[] | null;
  savedAt?: Timestamp | Date | null; // Allow null for consistency if field might be absent
  savedBy?: string | null;
}
