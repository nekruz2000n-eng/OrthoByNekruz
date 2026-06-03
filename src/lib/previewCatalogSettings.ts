import type { ModuleKind, SubjectCatalogEntry } from '@/lib/subjectCatalog';
import { buildSubjectCatalog } from '@/lib/subjectCatalog';
import { SUBJECTS } from '@/lib/subjects';

const REDIS_KEY = 'settings:preview_catalog';

export type PreviewCatalogSettings = Record<string, {
  /** false — весь предмет серый «в разработке» */
  open?: boolean;
  modules?: Partial<Record<ModuleKind, boolean>>;
}>;

type RedisGetSet = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

export function sanitizePreviewCatalogSettings(raw: unknown): PreviewCatalogSettings {
  if (!raw || typeof raw !== 'object') return {};
  const validIds = new Set(SUBJECTS.map(s => s.id));
  const validMods: ModuleKind[] = ['questions', 'tests', 'tasks'];
  const out: PreviewCatalogSettings = {};

  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(id) || !val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const entry: PreviewCatalogSettings[string] = {};
    if (v.open === false) entry.open = false;
    if (v.modules && typeof v.modules === 'object') {
      const modules: Partial<Record<ModuleKind, boolean>> = {};
      for (const mod of validMods) {
        if (mod in (v.modules as object)) {
          modules[mod] = (v.modules as Record<string, unknown>)[mod] !== false;
        }
      }
      if (Object.keys(modules).length) entry.modules = modules;
    }
    if (entry.open === false || entry.modules) out[id] = entry;
  }
  return out;
}

export async function loadPreviewCatalogSettings(redis: RedisGetSet): Promise<PreviewCatalogSettings> {
  const raw = await redis.get(REDIS_KEY);
  return sanitizePreviewCatalogSettings(raw);
}

export async function savePreviewCatalogSettings(
  redis: RedisGetSet,
  settings: PreviewCatalogSettings,
) {
  await redis.set(REDIS_KEY, sanitizePreviewCatalogSettings(settings));
}

export function applyPreviewCatalogSettings(
  catalog: SubjectCatalogEntry[],
  settings: PreviewCatalogSettings | null | undefined,
): SubjectCatalogEntry[] {
  if (!settings || !Object.keys(settings).length) return catalog;

  return catalog.map(entry => {
    const cfg = settings[entry.id];
    if (!cfg) return entry;

    const modules = entry.modules.map(mod => {
      if (cfg.open === false) {
        return { ...mod, available: false };
      }
      const wasFileAvailable = mod.available;
      const modOpen = cfg.modules?.[mod.id] !== false;
      return { ...mod, available: wasFileAvailable && modOpen };
    });

    const availableCount = modules.filter(m => m.available).length;
    return {
      ...entry,
      modules,
      hasAnyModule:      availableCount > 0,
      allModulesMissing: availableCount === 0,
    };
  });
}

export async function buildPreviewSubjectCatalog(redis: RedisGetSet): Promise<SubjectCatalogEntry[]> {
  const settings = await loadPreviewCatalogSettings(redis);
  return applyPreviewCatalogSettings(buildSubjectCatalog(), settings);
}

/** Эффективное состояние для админки (файл + настройки). */
export function getEffectivePreviewCatalogState(
  base: SubjectCatalogEntry[],
  settings: PreviewCatalogSettings,
): Record<string, { open: boolean; modules: Record<ModuleKind, boolean> }> {
  const applied = applyPreviewCatalogSettings(base, settings);
  const out: Record<string, { open: boolean; modules: Record<ModuleKind, boolean> }> = {};

  for (const entry of base) {
    const appliedEntry = applied.find(a => a.id === entry.id) ?? entry;
    const modules = {} as Record<ModuleKind, boolean>;
    for (const mod of entry.modules) {
      modules[mod.id] = appliedEntry.modules.find(m => m.id === mod.id)?.available ?? false;
    }
    out[entry.id] = {
      open: !appliedEntry.allModulesMissing,
      modules,
    };
  }
  return out;
}

export function subjectSettingFromToggles(
  subjectId: string,
  open: boolean,
  modules: Record<ModuleKind, boolean>,
  base: SubjectCatalogEntry[],
): PreviewCatalogSettings[string] | null {
  const baseEntry = base.find(s => s.id === subjectId);
  if (!baseEntry) return null;

  const entry: PreviewCatalogSettings[string] = {};
  if (!open) {
    entry.open = false;
    return entry;
  }

  const modOverrides: Partial<Record<ModuleKind, boolean>> = {};
  for (const mod of baseEntry.modules) {
    if (!mod.available) continue;
    if (modules[mod.id] === false) {
      modOverrides[mod.id] = false;
    }
  }
  if (Object.keys(modOverrides).length) {
    entry.modules = modOverrides;
  }
  return Object.keys(entry).length ? entry : null;
}

export function mergePreviewCatalogSettings(
  current: PreviewCatalogSettings,
  subjectId: string,
  patch: PreviewCatalogSettings[string] | null,
): PreviewCatalogSettings {
  const next = { ...current };
  if (!patch) {
    delete next[subjectId];
  } else {
    next[subjectId] = patch;
  }
  return sanitizePreviewCatalogSettings(next);
}
