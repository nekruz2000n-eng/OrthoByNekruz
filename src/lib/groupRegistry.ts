/**
 * Официальная сетка учебных групп КрасГМУ (для будущей админки «Доступ по группам»).
 * Источник: справочник факультетов и таблица групп по специальностям.
 *
 * Номер группы: первая цифра = курс (108 → 1 курс, 208 → 2 курс).
 * Суффикс факультета дописывается на сервере (см. studyGroup.ts).
 */

import { FACULTY_GROUP_SUFFIX, getFacultyGroupSuffix } from '@/lib/studyGroup';

export type FacultyId = 'stomatology' | 'therapeutic' | 'pediatrics';

export interface GroupRegistryEntry {
  /** Только цифры, без суффикса: 208 */
  digits: string;
  /** Полный код в Redis: 208с */
  studyGroup: string;
  facultyId: FacultyId;
  course: number;
  /** Иностранная группа (англ.), контент — отдельно в будущем */
  international?: boolean;
  note?: string;
}

export interface FacultyCourseRange {
  course: number;
  from: number;
  to: number;
  /** Отдельные пометки для конкретных групп в диапазоне */
  overrides?: Record<number, { international?: boolean; note?: string }>;
}

export interface FacultyGroupCatalog {
  facultyId: FacultyId;
  label: string;
  specialtyCode: string;
  maxCourse: number;
  ranges: FacultyCourseRange[];
}

/** Сетка групп по официальной таблице специальностей. */
export const FACULTY_GROUP_CATALOG: FacultyGroupCatalog[] = [
  {
    facultyId: 'therapeutic',
    label: '31.05.01 Лечебное дело',
    specialtyCode: '31.05.01',
    maxCourse: 6,
    ranges: [
      { course: 1, from: 101, to: 148 },
      { course: 2, from: 201, to: 248 },
      { course: 3, from: 301, to: 339 },
      { course: 4, from: 401, to: 438 },
      { course: 5, from: 501, to: 529 },
      { course: 6, from: 601, to: 631 },
    ],
  },
  {
    facultyId: 'pediatrics',
    label: '31.05.02 Педиатрия',
    specialtyCode: '31.05.02',
    maxCourse: 6,
    ranges: [
      { course: 1, from: 101, to: 120 },
      { course: 2, from: 201, to: 218 },
      { course: 3, from: 301, to: 316 },
      { course: 4, from: 401, to: 414 },
      { course: 5, from: 501, to: 512 },
      { course: 6, from: 601, to: 612 },
    ],
  },
  {
    facultyId: 'stomatology',
    label: '31.05.03 Стоматология',
    specialtyCode: '31.05.03',
    maxCourse: 5,
    ranges: [
      { course: 1, from: 101, to: 116 },
      {
        course: 2,
        from: 201,
        to: 216,
        overrides: {
          216: {
            international: true,
            note: 'Иностранцы (обучение на английском). Контент — отдельно.',
          },
        },
      },
      { course: 3, from: 301, to: 310 },
      { course: 4, from: 401, to: 411 },
      { course: 5, from: 501, to: 508 },
    ],
  },
];

const CATALOG_BY_FACULTY = new Map(
  FACULTY_GROUP_CATALOG.map(c => [c.facultyId, c]),
);

/** Курс по цифрам группы: 208 → 2, 108 → 1. */
export function parseCourseFromGroupDigits(digits: string): number | null {
  const d = digits.replace(/\D/g, '');
  if (!/^[1-6][0-9]{2,3}$/.test(d)) return null;
  const course = Number(d[0]);
  return course >= 1 && course <= 6 ? course : null;
}

export function buildStudyGroupCode(
  digits: string,
  facultyId: FacultyId,
): string | null {
  const suffix = getFacultyGroupSuffix(facultyId);
  if (!suffix) return null;
  const d = digits.replace(/\D/g, '');
  if (!d) return null;
  return `${d}${suffix}`;
}

function expandRange(
  facultyId: FacultyId,
  range: FacultyCourseRange,
): GroupRegistryEntry[] {
  const out: GroupRegistryEntry[] = [];
  for (let n = range.from; n <= range.to; n++) {
    const digits = String(n);
    const override = range.overrides?.[n];
    out.push({
      digits,
      studyGroup: buildStudyGroupCode(digits, facultyId)!,
      facultyId,
      course: range.course,
      international: override?.international,
      note: override?.note,
    });
  }
  return out;
}

/** Все официальные группы факультета (для админки). */
export function listOfficialGroups(facultyId: FacultyId): GroupRegistryEntry[] {
  const catalog = CATALOG_BY_FACULTY.get(facultyId);
  if (!catalog) return [];
  return catalog.ranges.flatMap(r => expandRange(facultyId, r));
}

/** Группы одного курса на факультете. */
export function listOfficialGroupsByCourse(
  facultyId: FacultyId,
  course: number,
): GroupRegistryEntry[] {
  return listOfficialGroups(facultyId).filter(g => g.course === course);
}

/** Проверка: группа из официальной сетки факультета. */
export function isOfficialStudyGroup(
  studyGroup: string,
  facultyId: FacultyId,
): boolean {
  const normalized = studyGroup.trim().toLowerCase();
  return listOfficialGroups(facultyId).some(g => g.studyGroup === normalized);
}

export function getGroupRegistryEntry(
  studyGroup: string,
  facultyId: FacultyId,
): GroupRegistryEntry | null {
  const normalized = studyGroup.trim().toLowerCase();
  return listOfficialGroups(facultyId).find(g => g.studyGroup === normalized) ?? null;
}

export function isInternationalStudyGroup(
  studyGroup: string,
  facultyId: FacultyId,
): boolean {
  return getGroupRegistryEntry(studyGroup, facultyId)?.international === true;
}

/** Дерево для админки: факультет → курс → группы. */
export function buildFacultyGroupTree(): Array<{
  facultyId: FacultyId;
  label: string;
  maxCourse: number;
  courses: Array<{
    course: number;
    groups: GroupRegistryEntry[];
  }>;
}> {
  return FACULTY_GROUP_CATALOG.map(cat => ({
    facultyId: cat.facultyId,
    label: cat.label,
    maxCourse: cat.maxCourse,
    courses: cat.ranges.map(r => ({
      course: r.course,
      groups: expandRange(cat.facultyId, r),
    })),
  }));
}

/** Суффиксы для справки в админке. */
export { FACULTY_GROUP_SUFFIX };
