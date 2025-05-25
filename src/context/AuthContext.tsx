
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
  setStaticUser: (user: AppUser | null) => void; // To set static user
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { isFirebaseInitialized } = useFirebaseApp();

  useEffect(() => {
    if (!isFirebaseInitialized) {
      setLoading(true);
      return;
    }

    // If a static user is already set (e.g. from LoginModal), don't override with Firebase auth state
    if (user?.isStaticUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth as Auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isStaticUser: false,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isFirebaseInitialized, user?.isStaticUser]);

  const logout = async () => {
    setLoading(true);
    try {
      if (!user?.isStaticUser) { // Only sign out from Firebase if it's a Firebase user
        await firebaseSignOut(auth as Auth);
      }
      setUser(null); // Clear user for both static and Firebase users
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
      setLoading(false);
    }
  };

  const setStaticUser = (staticUser: AppUser | null) => {
    setUser(staticUser);
    setLoading(false); // Assuming static user login is immediate
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, logout, setStaticUser }}>
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
