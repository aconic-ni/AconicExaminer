"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAppContext, ExamStep } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { InitialInfoForm } from '@/components/examiner/InitialInfoForm';
import { ProductListScreen } from '@/components/examiner/ProductListScreen';
import { PreviewScreen } from '@/components/examiner/PreviewScreen';
import { SuccessModal } from '@/components/examiner/SuccessModal';
import { Loader2 } from 'lucide-react';

export default function ExaminerPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentStep } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/'); // Redirect to login if not authenticated
    }
  }, [user, authLoading, router]);
  
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Standard way to show a confirmation dialog
      event.preventDefault();
      // Chrome requires returnValue to be set
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);


  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando autenticación...</p>
      </div>
    );
  }

  if (!user) {
     // This typically won't be seen due to redirect, but good for robustness
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg">Redirigiendo a inicio de sesión...</p>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case ExamStep.INITIAL_INFO:
        return <InitialInfoForm />;
      case ExamStep.PRODUCT_LIST:
        return <ProductListScreen />;
      case ExamStep.PREVIEW:
        return <PreviewScreen />;
      case ExamStep.SUCCESS:
        // SuccessModal is a dialog, typically shown over other content.
        // ProductListScreen might be a good background for it, or PreviewScreen.
        return <> <PreviewScreen /> <SuccessModal /> </>; // Show preview underneath success
      default:
        return <InitialInfoForm />;
    }
  };

  return (
    <AppShell>
      <div className="py-2 md:py-5">
         {renderStepContent()}
      </div>
      {/* SuccessModal is rendered conditionally inside renderStepContent or always if it handles its own visibility based on currentStep */}
      {currentStep === ExamStep.SUCCESS && <SuccessModal />}
    </AppShell>
  );
}
