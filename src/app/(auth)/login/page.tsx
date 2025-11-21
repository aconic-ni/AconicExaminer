
"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'aforador') {
        router.push('/database');
      } else if (user.role === 'ejecutivo') {
        router.push('/executive');
      } else if (user.role === 'coordinadora') {
        router.push('/executive');
      } else { // gestor and others
        router.push('/examiner');
      }
    }
  }, [user, loading, router]);

  const handleLoginSuccess = () => {
    // The redirection is now handled by the useEffect above, which waits for the auth state to update.
    // This function can be empty. The modal will unmount when the page navigates away.
  };
  
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="h-16 w-16 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg">
       <LoginModal isOpen={true} onClose={() => router.push('/')} onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
