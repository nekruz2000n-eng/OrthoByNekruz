/** Файлы вопросов по биологии для разных факультетов. */
export const BIO_QUESTIONS_STOM_FILE = 'bio_questions_stomatology.json';
export const BIO_QUESTIONS_PED_FILE = 'bio_questions_pediatrics.json';

export function resolveBioQuestionsFile(facultyId: string | null | undefined): string {
  if (facultyId === 'pediatrics') return BIO_QUESTIONS_PED_FILE;
  return BIO_QUESTIONS_STOM_FILE;
}

export function isBioFacultyQuestionsFile(fileName: string): boolean {
  return fileName === BIO_QUESTIONS_STOM_FILE || fileName === BIO_QUESTIONS_PED_FILE;
}
