
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
      if (user.isStaticUser) {
        router.push('/database');
      } else {
        router.push('/examiner');
      }
    }
  }, [user, loading, router]);

  const handleLoginSuccess = (isStaticUser?: boolean) => {
    if (isStaticUser) {
      router.push('/database');
    } else {
      router.push('/examiner');
    }
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
