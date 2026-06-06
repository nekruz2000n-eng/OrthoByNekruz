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

/** Биология: тест + задачи — пакет. */
const BIO_BUNDLE_TESTS_TASKS_RUB = 800;

const BIO_MODULE_PRICES: Record<PreviewModule, number> = {
  questions: MODULE_PRICE_RUB,
  tasks:     MODULE_PRICE_RUB,
  tests:     MODULE_PRICE_RUB,
};

const BIO_AVAILABLE_MODULES: PreviewModule[] = ['tests', 'tasks'];

export function calcPreviewPriceRub(subjectId: string, modules: PreviewModule[] = []): number {
  const chosen = modules.filter(Boolean);
  if (chosen.length === 0) return 0;

  if (subjectId === 'ortho') return calcOrthoPreviewPrice(chosen);
  if (subjectId === 'bio')  return calcBioPreviewPrice(chosen);
  if (subjectId === 'micro') return chosen.length * MODULE_PRICE_RUB;
  return MODULE_PRICE_RUB;
}

function calcBioPreviewPrice(modules: PreviewModule[]): number {
  const picked = modules.filter(m => BIO_AVAILABLE_MODULES.includes(m));
  if (picked.length === 0) return 0;

  const hasTasks = picked.includes('tasks');
  const hasTests = picked.includes('tests');

  if (hasTests && hasTasks) return BIO_BUNDLE_TESTS_TASKS_RUB;
  if (hasTests) return BIO_MODULE_PRICES.tests;
  return BIO_MODULE_PRICES.tasks;
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

export type PaymentModuleOption = {
  id: PreviewModule;
  label: string;
  shortLabel: string;
  unitPriceRub: number | null;
  selectable: boolean;
};

const ALL_PREVIEW_MODULES: PreviewModule[] = ['questions', 'tests', 'tasks'];

/** Порядок кнопок в ряду на экране оплаты. */
export const PAYMENT_MODULE_ROW_ORDER: PreviewModule[] = ['questions', 'tests', 'tasks'];

const PAYMENT_MODULE_SHORT_LABELS: Record<PreviewModule, string> = {
  questions: 'Вопр.',
  tests:     'Тест',
  tasks:     'Задач.',
};

/** Разделы с ценой за единицу — для кнопок на экране оплаты. */
export function getPaymentModuleOptions(subjectId: string): PaymentModuleOption[] {
  if (subjectId === 'ortho') {
    return ALL_PREVIEW_MODULES.map(id => ({
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: ORTHO_MODULE_PRICES[id],
      selectable: true,
    }));
  }
  if (subjectId === 'micro') {
    return ALL_PREVIEW_MODULES.map(id => ({
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: MODULE_PRICE_RUB,
      selectable: true,
    }));
  }
  if (subjectId === 'bio') {
    return ALL_PREVIEW_MODULES.map(id => ({
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: BIO_AVAILABLE_MODULES.includes(id) ? BIO_MODULE_PRICES[id] : null,
      selectable: BIO_AVAILABLE_MODULES.includes(id),
    }));
  }
  return ALL_PREVIEW_MODULES.map(id => ({
    id,
    label: PREVIEW_MODULE_LABELS[id],
    shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
    unitPriceRub: id === 'tests' ? MODULE_PRICE_RUB : null,
    selectable: id === 'tests',
  }));
}

/** Всегда три кнопки в ряд; недоступные — неактивны. */
export function getPaymentModuleRow(subjectId: string): PaymentModuleOption[] {
  const byId = new Map(getPaymentModuleOptions(subjectId).map(o => [o.id, o]));
  return PAYMENT_MODULE_ROW_ORDER.map(id => {
    const found = byId.get(id);
    if (found) return found;
    return {
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: null,
      selectable: false,
    };
  });
}

export function getModuleUnitPriceRub(subjectId: string, module: PreviewModule): number | null {
  return getPaymentModuleOptions(subjectId).find(o => o.id === module)?.unitPriceRub ?? null;
}

export function getPreviewPriceHint(subjectId: string): string {
  if (subjectId === 'ortho') {
    return 'Вопросы 1000 ₽ · Задачи 500 ₽ · Тест 500 ₽ · без теста = 1200 ₽';
  }
  if (subjectId === 'micro') {
    return 'Каждый раздел — 500 ₽';
  }
  if (subjectId === 'bio') {
    return 'Тест + задачи = 800 ₽ · по отдельности — 500 ₽';
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

  if (subjectId === 'bio') {
    const hasTasks = chosen.includes('tasks');
    const hasTests = chosen.includes('tests');

    if (hasTests && hasTasks) {
      return {
        total,
        hint: getPreviewPriceHint(subjectId),
        lines: ['Тест + задачи (пакет)'],
      };
    }

    const lines: string[] = [];
    if (hasTests) lines.push(PREVIEW_MODULE_LABELS.tests);
    if (hasTasks) lines.push(PREVIEW_MODULE_LABELS.tasks);
    return { total, hint: getPreviewPriceHint(subjectId), lines };
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
