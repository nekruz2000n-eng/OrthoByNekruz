export type PreviewModule = 'questions' | 'tests' | 'tasks';

export const PREVIEW_MODULE_LABELS: Record<PreviewModule, string> = {
  questions: 'Вопросы',
  tests:     'Тесты',
  tasks:     'Задачи',
};

export function formatPreviewModulesList(modules: string[] | null | undefined): string {
  if (!Array.isArray(modules) || modules.length === 0) return '';
  return modules
    .map(m => PREVIEW_MODULE_LABELS[m as PreviewModule] || m)
    .join(', ');
}

export function normalizePreviewModules(input: unknown): PreviewModule[] {
  if (!Array.isArray(input)) return [];
  const allowed: PreviewModule[] = ['questions', 'tests', 'tasks'];
  return input
    .map(m => String(m))
    .filter((m): m is PreviewModule => allowed.includes(m as PreviewModule));
}
