"use client";

import React, { useState, useEffect } from 'react';
import { ToothIcon } from './ToothIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validateKey, getLockoutStatus, recordFailedAttempt, clearAttempts } from '@/lib/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, KeyRound } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [key, setKey] = useState('');
  const [lockout, setLockout] = useState(getLockoutStatus());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      const status = getLockoutStatus();
      setLockout(status);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    if (validateKey(key)) {
      clearAttempts();
      onAuthenticated();
      localStorage.setItem('is_authed', 'true');
    } else {
      recordFailedAttempt();
      setKey('');
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Invalid 8-digit key. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background space-y-8">
      <div className="flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ToothIcon className="w-16 h-16 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">OrthoByNekruz</h1>
        <p className="text-muted-foreground text-sm text-center max-w-[240px]">
          Enter your 8-digit access key to continue your medical journey.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="relative group">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="••••••••"
            value={key}
            onChange={(e) => setKey(e.target.value.replace(/\D/g, ''))}
            disabled={lockout.isLocked}
            className="h-14 text-center text-2xl tracking-[0.5em] font-mono bg-card border-border focus:ring-primary focus:border-primary transition-all duration-300 animate-glow-pulse"
          />
          <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 w-5 h-5" />
        </div>

        {lockout.isLocked && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in zoom-in-95">
            <ShieldAlert className="w-4 h-4" />
            <span>Locked out. Try again in {lockout.remaining}s</span>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-transform active:scale-95"
          disabled={key.length !== 8 || lockout.isLocked}
        >
          Unlock Access
        </Button>
      </form>

      <div className="mt-auto pt-8 text-xs text-muted-foreground/40 font-mono uppercase tracking-widest">
        Secure Dental Portal v1.0
      </div>
    </div>
  );
};
