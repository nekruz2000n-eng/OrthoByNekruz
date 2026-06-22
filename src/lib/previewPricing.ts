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

/** Биология */
const BIO_QUESTIONS_RUB = 800;
const BIO_TESTS_RUB = MODULE_PRICE_RUB;
const BIO_TASKS_WITH_TEST_RUB = 0;
const BIO_TASKS_WITHOUT_TEST_RUB = 1000;

/** Фармакология, 3 курс — комплект перед экзаменом */
const PHARMA_BUNDLE_RUB = 500;
/** Дата экзамена (локальная полночь следующего дня после последнего дня подготовки). */
export const PHARMA_EXAM_DATE = '2026-06-11';

export function getPharmaExamDaysLeft(now = new Date()): number {
  const exam = new Date(`${PHARMA_EXAM_DATE}T23:59:59`);
  const ms = exam.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function formatDaysLeftRu(days: number): string {
  if (days === 0) return 'сегодня экзамен';
  if (days === 1) return 'остался 1 день';
  if (days >= 2 && days <= 4) return `осталось ${days} дня`;
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `осталось ${days} дня`;
  }
  return `осталось ${days} дней`;
}

/** Пояснение на экране оплаты: скидка на комплект, не постоянная цена. */
export function getPharmaLateExamPromoNote(now = new Date()): string {
  const days = getPharmaExamDaysLeft(now);
  const when = formatDaysLeftRu(days);
  return (
    `Скидка для 3 курса: ${when} до экзамена — весь комплект `
    + `(вопросы, тест и задачи) за ${formatPriceRub(PHARMA_BUNDLE_RUB)}. `
    + 'Такая цена только на финиш подготовки, не навсегда.'
  );
}

export type PreviewPriceOptions = {
  /** Биология: тест был в пробе/куплен — задачи 0 ₽, иначе 1000 ₽ */
  bioHadTest?: boolean;
};

/** Тест входил в выбранную пробу или уже открыт постоянно. */
export function bioUserHadTest(
  chosenModules: PreviewModule[],
  grantedModules: PreviewModule[] = [],
): boolean {
  return chosenModules.includes('tests') || grantedModules.includes('tests');
}

export function calcPreviewPriceRub(
  subjectId: string,
  modules: PreviewModule[] = [],
  options?: PreviewPriceOptions,
): number {
  const chosen = modules.filter(Boolean);
  if (chosen.length === 0) return 0;

  if (subjectId === 'ortho') return calcOrthoPreviewPrice(chosen);
  if (subjectId === 'bio')  return calcBioPreviewPrice(chosen, options?.bioHadTest ?? false);
  if (subjectId === 'micro') return chosen.length * MODULE_PRICE_RUB;
  if (subjectId === 'pharma') return PHARMA_BUNDLE_RUB;
  return MODULE_PRICE_RUB;
}

function calcBioPreviewPrice(modules: PreviewModule[], hadTest: boolean): number {
  let total = 0;
  if (modules.includes('questions')) total += BIO_QUESTIONS_RUB;
  if (modules.includes('tests'))     total += BIO_TESTS_RUB;
  if (modules.includes('tasks')) {
    total += hadTest ? BIO_TASKS_WITH_TEST_RUB : BIO_TASKS_WITHOUT_TEST_RUB;
  }
  return total;
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
  /** Уже в постоянном доступе — нельзя выбрать на экране докупки. */
  alreadyOwned?: boolean;
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
      unitPriceRub: id === 'questions' ? BIO_QUESTIONS_RUB
        : id === 'tests' ? BIO_TESTS_RUB
        : id === 'tasks' ? null
        : null,
      selectable: true,
    }));
  }
  if (subjectId === 'pharma') {
    return ALL_PREVIEW_MODULES.map(id => ({
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: null,
      selectable: true,
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

/** Всегда три кнопки в ряд; недоступные и уже купленные — неактивны. */
export function getPaymentModuleRow(
  subjectId: string,
  grantedModules: PreviewModule[] = [],
): PaymentModuleOption[] {
  const owned = new Set(grantedModules);
  const byId = new Map(getPaymentModuleOptions(subjectId).map(o => [o.id, o]));
  return PAYMENT_MODULE_ROW_ORDER.map(id => {
    const found = byId.get(id);
    const base: PaymentModuleOption = found ?? {
      id,
      label: PREVIEW_MODULE_LABELS[id],
      shortLabel: PAYMENT_MODULE_SHORT_LABELS[id],
      unitPriceRub: null,
      selectable: false,
    };
    if (owned.has(id)) {
      return { ...base, selectable: false, alreadyOwned: true };
    }
    return base;
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
    return 'Вопросы 800 ₽ · Тест 500 ₽ · Задачи 0 ₽ (с тестом) или 1000 ₽ (без теста)';
  }
  if (subjectId === 'pharma') {
    return `Комплект (вопросы + тест + задачи) — ${formatPriceRub(PHARMA_BUNDLE_RUB)} до экзамена`;
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
  options?: PreviewPriceOptions,
): PreviewPriceSummary | null {
  const chosen = modules.filter(Boolean);
  if (!subjectId || chosen.length === 0) return null;

  const total = calcPreviewPriceRub(subjectId, chosen, options);

  if (subjectId === 'ortho') {
    if (total <= 0) return null;
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
    if (total <= 0) return null;
    return {
      total,
      hint: getPreviewPriceHint(subjectId),
      lines: chosen.map(m => PREVIEW_MODULE_LABELS[m]),
    };
  }

  if (subjectId === 'bio') {
    const lines: string[] = [];
    if (chosen.includes('questions')) lines.push(PREVIEW_MODULE_LABELS.questions);
    if (chosen.includes('tests'))     lines.push(PREVIEW_MODULE_LABELS.tests);
    if (chosen.includes('tasks'))     lines.push(PREVIEW_MODULE_LABELS.tasks);
    return {
      total,
      hint: getPreviewPriceHint(subjectId),
      lines,
    };
  }

  if (subjectId === 'pharma') {
    const fullKit = ['questions', 'tests', 'tasks'] as PreviewModule[];
    const hasFullKit = fullKit.every(m => chosen.includes(m));
    return {
      total,
      hint: getPreviewPriceHint(subjectId),
      lines: hasFullKit
        ? ['Вопросы + тест + задачи (комплект)']
        : chosen.map(m => PREVIEW_MODULE_LABELS[m]),
    };
  }

  if (total <= 0) return null;
  return {
    total,
    hint: getPreviewPriceHint(subjectId),
    lines: ['Доступ к тесту'],
  };
}

export function formatPriceRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}
