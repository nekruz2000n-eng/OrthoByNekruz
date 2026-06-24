'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FACULTY_ICON_CHANGED_EVENT,
  readStoredFacultyId,
} from '@/lib/facultyCodes';

/** Факультет из профиля (приоритет) или localStorage, с реакцией на смену. */
export function useFacultyId(serverFacultyId?: string | null): string | null {
  const [localId, setLocalId] = useState(readStoredFacultyId);

  const refresh = useCallback(() => {
    setLocalId(readStoredFacultyId());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(FACULTY_ICON_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FACULTY_ICON_CHANGED_EVENT, refresh);
  }, [refresh]);

  return serverFacultyId ?? localId;
}
