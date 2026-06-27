'use client';

import { useCallback, useEffect, useState } from 'react';
import { validateClientSession } from '@/lib/appSession';

export function useAppAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(validateClientSession());
    setIsLoading(false);
  }, []);

  const onAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    setIsAuthenticated,
    onAuthenticated,
  };
}
