
"use client";
import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { X, Mail, Lock } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, ingrese correo y contraseña.");
      setLoading(false);
      return;
    }
    
    try {
      await signInWithEmailAndPassword(auth as Auth, email, password);
      toast({ title: 'Inicio de sesión exitoso', description: 'Bienvenido a CustomsEX-p.' });
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      console.error("Firebase Auth Error:", err);
      let userFriendlyError = 'Error al iniciar sesión. Inténtelo de nuevo.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userFriendlyError = 'Correo o contraseña incorrectos.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyError = 'El formato del correo electrónico no es válido.';
      }
      setError(userFriendlyError);
      toast({ title: 'Error de inicio de sesión', description: userFriendlyError, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md glass-effect text-foreground border-border/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">CustomsEX-p</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </DialogHeader>
        <DialogDescription className="text-muted-foreground">
          Ingrese sus credenciales para acceder al sistema.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="email-login" className="flex items-center text-sm font-medium text-foreground mb-1">
              <Mail className="mr-2 h-4 w-4 text-primary" />
              Correo Electrónico
            </Label>
            <Input
              id="email-login"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-foreground placeholder:text-muted-foreground border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="password-login" className="flex items-center text-sm font-medium text-foreground mb-1">
              <Lock className="mr-2 h-4 w-4 text-primary" />
              Contraseña
            </Label>
            <Input
              id="password-login"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 text-foreground placeholder:text-muted-foreground border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="********"
            />
          </div>
           {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="text-xs text-muted-foreground">
            Para solicitar acceso, contacte a Coordinación ACONIC: <br />
            <Link href="https://wa.me/+50583956505" target="_blank" className="text-primary hover:text-primary/80 underline">
              WhatsApp (+505 8395 6505)
            </Link>
          </div>
          <DialogFooter>
            <Button type="submit" className="btn-primary text-primary-foreground px-8 py-3 rounded-md font-medium w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
