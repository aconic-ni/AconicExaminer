"use client";
import type React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { ExamData, Product } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export enum ExamStep {
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
  setExamData: (data: ExamData) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialExamData: ExamData = {
  ne: '',
  reference: '',
  manager: '',
  location: '',
};

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [examData, setExamDataState] = useState<ExamData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentStep, setCurrentStepState] = useState<ExamStep>(ExamStep.INITIAL_INFO);
  const [editingProduct, setEditingProductState] = useState<Product | null>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false);
  const [productToView, setProductToView] = useState<Product | null>(null);


  const setExamData = useCallback((data: ExamData) => {
    setExamDataState(data);
  }, []);

  const addProduct = useCallback((productData: Omit<Product, 'id'>) => {
    const newProduct: Product = { ...productData, id: uuidv4() };
    setProducts((prevProducts) => [...prevProducts, newProduct]);
  }, []);

  const updateProduct = useCallback((updatedProduct: Product) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setEditingProductState(null); // Clear editing state
  }, []);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
  }, []);

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
    setEditingProductState(null); // Clear editing state when closing
  }, []);

  const openProductDetailModal = useCallback((product: Product) => {
    setProductToView(product);
    setIsProductDetailModalOpen(true);
  }, []);

  const closeProductDetailModal = useCallback(() => {
    setIsProductDetailModalOpen(false);
    setProductToView(null);
  }, []);

  const resetApp = useCallback(() => {
    setExamDataState(null);
    setProducts([]);
    setCurrentStepState(ExamStep.INITIAL_INFO);
    setEditingProductState(null);
    setIsAddProductModalOpen(false);
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
