/** Файлы задач по биологии по факультетам. */
import { resolveUserFacultyPromo } from '@/lib/facultyCodes';

export const BIO_TASKS_STOM_FILE = 'bio_tasks.json';
export const BIO_TASKS_PED_THER_FILE = 'bio_tasks_pediatrics.json';

const BIO_TASKS_PED_THER = new Set(['pediatrics', 'therapeutic']);

export function resolveBioFacultyId(user: {
  facultyId?: string | null;
  promoCode?: string | null;
  previewFaculty?: string | null;
  activatedKey?: string | null;
} | null | undefined): string | null {
  return resolveUserFacultyPromo(user)?.id ?? user?.facultyId ?? null;
}

export function resolveBioTasksFile(facultyId: string | null | undefined): string | null {
  if (facultyId && BIO_TASKS_PED_THER.has(facultyId)) return BIO_TASKS_PED_THER_FILE;
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
