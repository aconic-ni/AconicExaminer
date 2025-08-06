
"use client";
import type React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ExamData, Product, AppUser as AuthAppUser, ExamDocument, AuditLogEntry } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { doc, setDoc, Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export enum ExamStep {
  WELCOME = 0,
  INITIAL_INFO = 1,
  PRODUCT_LIST = 2,
  PREVIEW = 3,
  SUCCESS = 4,
}

interface AppContextType {
  examData: ExamData | null;
  products: Product[];
  currentStep: ExamStep;
  editingProduct: Product | null;
  isAddProductModalOpen: boolean;
  isProductDetailModalOpen: boolean;
  productToView: Product | null;
  setExamData: (data: ExamData, isRecovery?: boolean) => void;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (updatedProduct: Product) => void;
  deleteProduct: (productId: string) => void;
  setCurrentStep: (step: ExamStep) => void;
  setEditingProduct: (product: Product | null) => void;
  openAddProductModal: (productToEdit?: Product | null) => void;
  closeAddProductModal: () => void;
  openProductDetailModal: (product: Product) => void;
  closeProductDetailModal: () => void;
  resetApp: () => void;
  softSaveExam: (examData: ExamData, products: Product[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [examData, setExamDataState] = useState<ExamData | null>(null);
  const [products, setProductsState] = useState<Product[]>([]);
  const [currentStep, setCurrentStepState] = useState<ExamStep>(ExamStep.WELCOME);
  const [editingProduct, setEditingProductState] = useState<Product | null>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false);
  const [productToView, setProductToView] = useState<Product | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // New state for audit trail

  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [internalUser, setInternalUser] = useState<AuthAppUser | null>(authUser);

  const resetApp = useCallback(() => {
    setExamDataState(null);
    setProductsState([]);
    setCurrentStepState(ExamStep.WELCOME);
    setEditingProductState(null);
    setIsAddProductModalOpen(false);
    setIsProductDetailModalOpen(false);
    setProductToView(null);
    setIsRecoveryMode(false); // Reset recovery mode
  }, []);

  useEffect(() => {
    const authUserChanged = authUser?.uid !== internalUser?.uid || (authUser && !internalUser) || (!authUser && internalUser);
    if (authUserChanged) {
      resetApp();
      setInternalUser(authUser);
    }
  }, [authUser, internalUser, resetApp]);

  const logAuditEvent = useCallback(async (action: AuditLogEntry['action'], details: AuditLogEntry['details']) => {
    if (!isRecoveryMode || !examData?.ne || !authUser?.email) return;

    try {
      const auditLogRef = collection(db, "examenesRecuperados");
      const logEntry: Omit<AuditLogEntry, 'id'> = {
        examNe: examData.ne,
        action: action,
        changedBy: authUser.email,
        changedAt: Timestamp.fromDate(new Date()),
        details: details
      };
      await addDoc(auditLogRef, logEntry);
    } catch (error) {
      console.error("Error writing audit log:", error);
      toast({
        title: "Error de Auditoría",
        description: "No se pudo registrar el cambio en la bitácora de recuperación.",
        variant: "destructive"
      });
    }
  }, [isRecoveryMode, examData?.ne, authUser?.email, toast]);
  
  const softSaveExam = useCallback(async (currentExamData: ExamData | null, currentProducts: Product[]) => {
      if (!currentExamData?.ne || !authUser?.email) {
          console.log("Soft save prerequisites not met.", {ne: currentExamData?.ne, user: authUser?.email})
          return; // Don't save if there's no NE or user
      }
  
      const examDocRef = doc(db, "examenesPrevios", currentExamData.ne.toUpperCase());
  
      const dataToSave: Partial<ExamDocument> = {
          ...currentExamData,
          products: currentProducts,
          savedBy: authUser.email,
          status: 'incomplete', // Add a status field
          lastUpdated: Timestamp.fromDate(new Date()),
      };
      
      try {
          await setDoc(examDocRef, dataToSave, { merge: true }); // Merge to avoid overwriting with partial data
          console.log(`Soft save successful for NE: ${currentExamData.ne}`);
      } catch (error) {
          console.error("Error during soft save:", error);
          toast({
              title: "Error de Autoguardado",
              description: "No se pudo guardar el progreso. Revisa tu conexión.",
              variant: "destructive"
          });
      }
  }, [authUser, toast]);

  const setExamData = useCallback((data: ExamData, isRecovery: boolean = false) => {
    setExamDataState(data);
    if (isRecovery) {
      setIsRecoveryMode(true);
    }
  }, []);
  
  const setProducts = useCallback((products: Product[]) => {
    setProductsState(products);
  }, []);

  const addProduct = useCallback((productData: Omit<Product, 'id'>) => {
    const newProduct: Product = { ...productData, id: uuidv4() };
    setProductsState((prevProducts) => {
        const newProducts = [...prevProducts, newProduct];
        softSaveExam(examData, newProducts);
        return newProducts;
    });
    logAuditEvent('product_added', {
        productId: newProduct.id,
        newData: newProduct
    });
  }, [examData, softSaveExam, logAuditEvent]);

  const updateProduct = useCallback((updatedProduct: Product) => {
    let previousData: Product | undefined;
    setProductsState((prevProducts) => {
        previousData = prevProducts.find(p => p.id === updatedProduct.id);
        const newProducts = prevProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
        softSaveExam(examData, newProducts);
        return newProducts;
    });
    logAuditEvent('product_updated', {
        productId: updatedProduct.id,
        previousData: previousData,
        newData: updatedProduct
    });
    setEditingProductState(null);
  }, [examData, softSaveExam, logAuditEvent]);

  const deleteProduct = useCallback((productId: string) => {
    let deletedProduct: Product | undefined;
    setProductsState((prevProducts) => {
        deletedProduct = prevProducts.find(p => p.id === productId);
        const newProducts = prevProducts.filter((p) => p.id !== productId);
        softSaveExam(examData, newProducts);
        return newProducts;
    });
     if (deletedProduct) {
        logAuditEvent('product_deleted', {
            productId: productId,
            previousData: deletedProduct
        });
    }
  }, [examData, softSaveExam, logAuditEvent]);

  const setCurrentStep = useCallback((step: ExamStep) => {
    setCurrentStepState(step);
  }, []);
  
  const setEditingProduct = useCallback((product: Product | null) => {
    setEditingProductState(product);
  }, []);

  const openAddProductModal = useCallback((productToEdit: Product | null = null) => {
    setEditingProductState(productToEdit);
    setIsAddProductModalOpen(true);
  }, []);

  const closeAddProductModal = useCallback(() => {
    setIsAddProductModalOpen(false);
    setEditingProductState(null);
  }, []);

  const openProductDetailModal = useCallback((product: Product) => {
    setProductToView(product);
    setIsProductDetailModalOpen(true);
  }, []);

  const closeProductDetailModal = useCallback(() => {
    setIsProductDetailModalOpen(false);
    setProductToView(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        examData,
        products,
        currentStep,
        editingProduct,
        isAddProductModalOpen,
        isProductDetailModalOpen,
        productToView,
        setExamData,
        setProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        setCurrentStep,
        setEditingProduct,
        openAddProductModal,
        closeAddProductModal,
        openProductDetailModal,
        closeProductDetailModal,
        resetApp,
        softSaveExam,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
