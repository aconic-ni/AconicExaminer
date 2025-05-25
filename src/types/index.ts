
import type { Timestamp } from 'firebase/firestore';

export interface ExamData {
  ne: string;
  reference: string;
  manager: string;
  location: string;
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
