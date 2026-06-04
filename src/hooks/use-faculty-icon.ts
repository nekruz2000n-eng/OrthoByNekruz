'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FACULTY_ICON_CHANGED_EVENT,
  readStoredFacultyIcon,
} from '@/lib/facultyCodes';

export function useFacultyIcon(): string {
  const [icon, setIcon] = useState(readStoredFacultyIcon);

  const refresh = useCallback(() => {
    setIcon(readStoredFacultyIcon());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(FACULTY_ICON_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FACULTY_ICON_CHANGED_EVENT, refresh);
  }, [refresh]);

  return icon;
}
