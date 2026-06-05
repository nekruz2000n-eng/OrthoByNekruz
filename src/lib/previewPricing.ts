import type { PreviewModule } from '@/lib/previewModules';
import { PREVIEW_MODULE_LABELS } from '@/lib/previewModules';

const MODULE_PRICE_RUB = 500;

const ORTHO_MODULE_PRICES: Record<PreviewModule, number> = {
  questions: 1000,
  tasks:     500,
  tests:     500,
};

/** Вопросы + задачи без теста — пакет. */
const ORTHO_BUNDLE_NO_TEST_RUB = 1200;

export function calcPreviewPriceRub(subjectId: string, modules: PreviewModule[] = []): number {
  const chosen = modules.filter(Boolean);
  if (chosen.length === 0) return 0;

  if (subjectId === 'ortho') return calcOrthoPreviewPrice(chosen);
  if (subjectId === 'micro') return chosen.length * MODULE_PRICE_RUB;
  return MODULE_PRICE_RUB;
}

function calcOrthoPreviewPrice(modules: PreviewModule[]): number {
  const hasQuestions = modules.includes('questions');
  const hasTasks     = modules.includes('tasks');
  const hasTests     = modules.includes('tests');

  if (hasQuestions && hasTasks && !hasTests) {
    return ORTHO_BUNDLE_NO_TEST_RUB;
  }

  let total = 0;
  if (hasQuestions) total += ORTHO_MODULE_PRICES.questions;
  if (hasTasks)     total += ORTHO_MODULE_PRICES.tasks;
  if (hasTests)     total += ORTHO_MODULE_PRICES.tests;
  return total;
}

export function getPreviewPriceHint(subjectId: string): string {
  if (subjectId === 'ortho') {
    return 'Вопросы 1000 ₽ · Задачи 500 ₽ · Тест 500 ₽ · без теста = 1200 ₽';
  }
  if (subjectId === 'micro') {
    return 'Каждый раздел — 500 ₽';
  }
  return 'Любой тест — 500 ₽';
}

export type PreviewPriceSummary = {
  total: number;
  hint: string;
  lines: string[];
};

/** Для экрана оплаты после пробы — сумма и расшифровка по выбору. */
export function describePreviewPrice(
  subjectId: string,
  modules: PreviewModule[] = [],
): PreviewPriceSummary | null {
  const chosen = modules.filter(Boolean);
  if (!subjectId || chosen.length === 0) return null;

  const total = calcPreviewPriceRub(subjectId, chosen);
  if (total <= 0) return null;

  if (subjectId === 'ortho') {
    const hasQuestions = chosen.includes('questions');
    const hasTasks     = chosen.includes('tasks');
    const hasTests     = chosen.includes('tests');

    if (hasQuestions && hasTasks && !hasTests) {
      return {
        total,
        hint: getPreviewPriceHint(subjectId),
        lines: ['Вопросы + задачи (пакет без теста)'],
      };
    }

    const lines: string[] = [];
    if (hasQuestions) lines.push(PREVIEW_MODULE_LABELS.questions);
    if (hasTasks)     lines.push(PREVIEW_MODULE_LABELS.tasks);
    if (hasTests)     lines.push(PREVIEW_MODULE_LABELS.tests);
    return { total, hint: getPreviewPriceHint(subjectId), lines };
  }

  if (subjectId === 'micro') {
    return {
      total,
      hint: getPreviewPriceHint(subjectId),
      lines: chosen.map(m => PREVIEW_MODULE_LABELS[m]),
    };
  }

  return {
    total,
    hint: getPreviewPriceHint(subjectId),
    lines: ['Доступ к тесту'],
  };
}

export function formatPriceRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}
