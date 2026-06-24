/** Задачи по химии для педиатрии и лечебного дела. */
export const CHEM_TASKS_FILE = 'chem_tasks.json';

const CHEM_TASKS_FACULTIES = new Set(['pediatrics', 'therapeutic']);

export function chemFacultyHasTasks(facultyId: string | null | undefined): boolean {
  if (!facultyId) return true;
  return CHEM_TASKS_FACULTIES.has(facultyId);
}

export function resolveChemTasksFile(facultyId: string | null | undefined): string | null {
  return chemFacultyHasTasks(facultyId) ? CHEM_TASKS_FILE : null;
}

export function filterChemTasksForFaculty<T extends { faculties?: string[] }>(
  tasks: T[],
  facultyId: string | null | undefined,
): T[] {
  if (!facultyId) return tasks;
  return tasks.filter(t => {
    const facs = t.faculties;
    if (!facs?.length) return chemFacultyHasTasks(facultyId);
    return facs.includes(facultyId);
  });
}
