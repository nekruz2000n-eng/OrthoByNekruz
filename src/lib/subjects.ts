// ═══════════════════════════════════════════════════════════════════════════
// src/lib/subjects.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// ЦЕНТРАЛЬНАЯ КОНФИГУРАЦИЯ ДИСЦИПЛИН
//
// Чтобы добавить новую дисциплину (например, фармакологию):
//   1. Положи 4 JSON-файла в src/data/:
//      pharma_questions.json, pharma_tasks.json,
//      pharma_tests.json, pharma_glossary.json
//   2. Добавь объект в массив SUBJECTS ниже
//   3. (Опционально) Добавь CSS-переменные в globals.css если новый цвет
//   4. Готово! Кнопка появится в админке автоматически
//
// ═══════════════════════════════════════════════════════════════════════════

// ─── Тип конфигурации одной дисциплины ─────────────────────────────────────
export interface SubjectConfig {
  /** Уникальный ID дисциплины. Используется в URL, Redis, localStorage. */
  id: string;

  /** Полное название (показывается в UI) */
  label: string;

  /** Короткое название для бейджей в админке */
  shortLabel: string;

  /** Подзаголовок на карточке выбора */
  sub: string;

  /** Бейдж курса (например, "2 курс") */
  badge: string;

  // ── Дизайн ──────────────────────────────────────────────────────────────
  /** Основной цвет (CSS-переменная) */
  color: string;
  /** Цвет фона карточки */
  dimColor: string;
  /** Цвет границы */
  borderColor: string;
  /** Какую иконку показывать ('perfect' = идеальный зуб, 'normal' = обычный) */
  iconVariant: 'perfect' | 'normal';

  // ── Файлы данных (пути относительно src/data/) ─────────────────────────
  /** Имя файла с вопросами */
  questionsFile: string;
  /** Имя файла с задачами */
  tasksFile: string;
  /** Имя файла с тестами */
  testsFile: string;
  /** Имя файла с глоссарием */
  glossaryFile: string;

  // ── Ключи localStorage ──────────────────────────────────────────────────
  /** Префикс для всех localStorage-ключей этой дисциплины */
  lsPrefix: string;

  // ── Доступ ──────────────────────────────────────────────────────────────
  /**
   * Доступна ли дисциплина бесплатно после активации ключа?
   * - false: студент должен получить доступ через админку (платная)
   * - true:  доступна сразу всем кто ввел ключ (бесплатная/основная)
   *
   * Для подхода "ключ = пустой пропуск" — у ВСЕХ должно быть false.
   * Студент платит за каждую дисциплину отдельно.
   */
  freeWithKey: boolean;

  /**
   * Доступна ли в демо-режиме?
   * Только основная дисциплина должна быть в демо.
   */
  availableInDemo: boolean;
}

// ─── Список всех дисциплин ─────────────────────────────────────────────────
export const SUBJECTS: SubjectConfig[] = [
  {
    id:             'ortho',
    label:          'Ортопедия',
    shortLabel:     'ortho',
    sub:            'Вопросы · Тесты · Задачи',
    badge:          '2 курс',
    color:          'var(--c-primary)',
    dimColor:       'var(--c-primary-dim)',
    borderColor:    'var(--c-primary-br)',
    iconVariant:    'perfect',
    questionsFile:  'questions.json',
    tasksFile:      'tasks.json',
    testsFile:      'tests.json',
    glossaryFile:   'glossary.json',
    lsPrefix:       'ortho',
    freeWithKey:    false,  // Подход А: ключ = пустой пропуск
    availableInDemo: true,   // Демо показывает ортопедию
  },
  {
    id:             'micro',
    label:          'Микробиология',
    shortLabel:     'micro',
    sub:            'Вопросы · Тесты · Задачи',
    badge:          '2 курс',
    color:          'var(--c-amber)',
    dimColor:       'var(--c-amber-dim)',
    borderColor:    'var(--c-amber-br)',
    iconVariant:    'normal',
    questionsFile:  'micro_questions.json',
    tasksFile:      'micro_tasks.json',
    testsFile:      'micro_tests.json',
    glossaryFile:   'micro_glossary.json',
    lsPrefix:       'micro',
    freeWithKey:    false,
    availableInDemo: false,
  },

  // ─── ПРИМЕР: Как добавить новую дисциплину ─────────────────────────────
  // Раскомментируйте и положите файлы в src/data/
  /*
  {
    id:             'pharma',
    label:          'Фармакология',
    shortLabel:     'pharma',
    sub:            'Вопросы · Тесты · Задачи',
    badge:          '3 курс',
    color:          'var(--c-emerald)',      // добавьте в globals.css
    dimColor:       'var(--c-emerald-dim)',
    borderColor:    'var(--c-emerald-br)',
    iconVariant:    'normal',
    questionsFile:  'pharma_questions.json',
    tasksFile:      'pharma_tasks.json',
    testsFile:      'pharma_tests.json',
    glossaryFile:   'pharma_glossary.json',
    lsPrefix:       'pharma',
    freeWithKey:    false,
    availableInDemo: false,
  },
  */
];

// ─── Тип ID любой дисциплины (динамический) ────────────────────────────────
export type SubjectId = string;

// ─── Хелперы ───────────────────────────────────────────────────────────────

/** Получить конфиг дисциплины по ID. Возвращает undefined если не найдена. */
export function getSubject(id: string): SubjectConfig | undefined {
  return SUBJECTS.find(s => s.id === id);
}

/** Получить конфиг или выбросить ошибку (для критических мест) */
export function getSubjectOrThrow(id: string): SubjectConfig {
  const s = getSubject(id);
  if (!s) throw new Error(`Unknown subject: ${id}`);
  return s;
}

/** Список всех ID дисциплин */
export function getAllSubjectIds(): string[] {
  return SUBJECTS.map(s => s.id);
}

/** ID основной/первой дисциплины (для дефолтов и демо) */
export function getDefaultSubjectId(): string {
  return SUBJECTS[0]?.id || 'ortho';
}

/** Дисциплина для демо-режима */
export function getDemoSubjectId(): string {
  const demoSubject = SUBJECTS.find(s => s.availableInDemo);
  return demoSubject?.id || getDefaultSubjectId();
}

// ─── Работа с правами пользователя ────────────────────────────────────────

/**
 * Поле в Redis у пользователя:
 *   user.subjects = { ortho: true, micro: false, pharma: false }
 *
 * Если у пользователя НЕТ поля subjects — это старый аккаунт,
 * считаем что у него только ортопедия (для совместимости).
 */
export interface UserSubjects {
  [subjectId: string]: boolean;
}

/**
 * Получить список ID открытых дисциплин у пользователя.
 * Учитывает: подписку, триал, freeWithKey-флаг, поле user.subjects.
 */
export function getUserAvailableSubjects(user: any): string[] {
  if (!user) return [];

  // Если есть поле subjects (новый формат) — используем его
  if (user.subjects && typeof user.subjects === 'object') {
    return SUBJECTS
      .filter(s => user.subjects[s.id] === true)
      .map(s => s.id);
  }

  // Старый формат: поле micro: true/false
  // Все старые пользователи имеют ортопедию (т.к. они уже активировали ключ)
  const result: string[] = [];
  if (user.activatedKey) {
    result.push('ortho');                                  // ортопедия по старому ключу
    if (user.micro === true) result.push('micro');         // микробиология по старому флагу
  }
  return result;
}

/**
 * Создать дефолтный объект subjects для нового пользователя.
 * Подход А: пустой пропуск — ничего не открыто, админ откроет вручную.
 */
export function createDefaultSubjects(): UserSubjects {
  const result: UserSubjects = {};
  for (const s of SUBJECTS) {
    result[s.id] = s.freeWithKey;  // обычно все false
  }
  return result;
}

/**
 * Создать subjects для триала/демо-пользователя.
 * Открыта только демо-дисциплина.
 */
export function createDemoSubjects(): UserSubjects {
  const result: UserSubjects = {};
  for (const s of SUBJECTS) {
    result[s.id] = s.availableInDemo;
  }
  return result;
}

// ─── Утилита для путей к файлам данных ────────────────────────────────────
// Использование на сервере:
//   const data = require(`@/data/${subject.questionsFile}`);