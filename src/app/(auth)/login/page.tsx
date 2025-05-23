"use client";
// This page is optional if login is only modal-based from the homepage.
// It can serve as a dedicated login route if needed.
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/examiner');
    }
  }, [user, loading, router]);

  const handleLoginSuccess = () => {
    router.push('/examiner');
  };
  
  // Keep modal open by default on this page
  // The LoginModal itself would need to be adapted if used outside Dialog
  // For simplicity, assuming the modal approach from '/' is primary.
  // This page could simply render the modal as non-closable until login or navigation.

  if (loading || user) { // Show loader or redirect if user is already logged in or loading
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <p className="text-white text-xl">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg">
       {/* Render LoginModal always open, or a dedicated login form component */}
       {/* The LoginModal is designed as a Dialog, so it needs a trigger or to be always open */}
       <LoginModal isOpen={true} onClose={() => router.push('/')} onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
