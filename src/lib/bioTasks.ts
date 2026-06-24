/** Файл задач по биологии для стоматологического факультета. */
export const BIO_TASKS_STOM_FILE = 'bio_tasks.json';

/** Задачи из PDF «Задачи био» — только для стоматологов. */
export function resolveBioTasksFile(facultyId: string | null | undefined): string | null {
  if (facultyId === 'stomatology' || !facultyId) return BIO_TASKS_STOM_FILE;
  return null;
}

export function bioFacultyHasTasks(facultyId: string | null | undefined): boolean {
  return resolveBioTasksFile(facultyId) != null;
}
