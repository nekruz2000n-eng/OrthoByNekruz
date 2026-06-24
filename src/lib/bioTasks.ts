/** Файлы задач по биологии по факультетам. */
import { resolveUserFacultyPromo } from '@/lib/facultyCodes';

export const BIO_TASKS_STOM_FILE = 'bio_tasks.json';
export const BIO_TASKS_PED_FILE = 'bio_tasks_pediatrics.json';
export const BIO_TASKS_THERAPEUTIC_FILE = 'bio_tasks_therapeutic.json';

export function resolveBioFacultyId(user: {
  facultyId?: string | null;
  promoCode?: string | null;
  previewFaculty?: string | null;
  activatedKey?: string | null;
} | null | undefined): string | null {
  return resolveUserFacultyPromo(user)?.id ?? user?.facultyId ?? null;
}

export function resolveBioTasksFile(facultyId: string | null | undefined): string | null {
  if (facultyId === 'pediatrics') return BIO_TASKS_PED_FILE;
  if (facultyId === 'therapeutic') return BIO_TASKS_THERAPEUTIC_FILE;
  if (facultyId === 'stomatology' || !facultyId) return BIO_TASKS_STOM_FILE;
  return null;
}

export function bioFacultyHasTasks(facultyId: string | null | undefined): boolean {
  return resolveBioTasksFile(facultyId) != null;
}

export function filterBioTasksForFaculty<T extends { faculties?: string[] }>(
  tasks: T[],
  facultyId: string | null | undefined,
): T[] {
  if (!facultyId) return tasks;
  return tasks.filter(t => {
    const facs = t.faculties;
    if (!facs?.length) return bioFacultyHasTasks(facultyId);
    return facs.includes(facultyId);
  });
}
