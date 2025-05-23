"use client";
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser, type Auth } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Firebase auth instance
import type { AppUser } from '@/types';
import { useFirebaseApp } from './FirebaseAppContext';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  // Login function will be part of LoginModal, this context provides user state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { isFirebaseInitialized } = useFirebaseApp();

  useEffect(() => {
    if (!isFirebaseInitialized) {
      // Wait for Firebase to be initialized
      setLoading(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth as Auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseInitialized]);

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth as Auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out: ", error);
      // Handle error appropriately, e.g., show a toast notification
    } finally {
      setLoading(false);
    }
  };
  
  // Show a global loader or skeleton if auth state is still loading
  if (loading && isFirebaseInitialized) {
     // Or a more sophisticated loading screen
  }


  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
