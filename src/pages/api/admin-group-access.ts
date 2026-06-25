import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { SUBJECTS } from '@/lib/subjects';
import { verifyInitDataUser } from '@/lib/verifyInitData';
import { getAllUserIds, registerUserId } from '@/lib/userIndex';
import { healUserFacultyFields } from '@/lib/facultyCodes';
import { normalizeStudyGroup, buildStudyGroupFromDigits } from '@/lib/studyGroup';
import type { FacultyId } from '@/lib/groupRegistry';
import {
  applyGroupAccessToUser,
  getAdminGroupAccessTree,
  loadGroupAccessRules,
  saveGroupAccessRules,
  upsertGroupAccessRule,
  type GroupAccessDurationKind,
  type GroupAccessModule,
  normalizeModules,
} from '@/lib/groupAccess';
import { buildSubjectCatalog } from '@/lib/subjectCatalog';

const redis = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_TG_ID = process.env.ADMIN_TG_ID || '978243325';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

function verifyAdmin(initData: string, secret: string): boolean {
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return false;
  if (!BOT_TOKEN) return false;
  const tgUser = verifyInitDataUser(initData, BOT_TOKEN);
  if (!tgUser || String(tgUser.id) !== ADMIN_TG_ID) return false;
  return true;
}

async function saveUser(tgId: string, data: unknown) {
  const { user: healed } = healUserFacultyFields(data as Record<string, unknown>);
  await redis.set(`user_id:${tgId}`, healed);
  await registerUserId(redis, tgId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { initData, secret, action } = req.body ?? {};
  if (!initData || !secret || !verifyAdmin(String(initData), String(secret))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const rules = await loadGroupAccessRules(redis);

    if (action === 'tree') {
      return res.status(200).json({
        ok: true,
        tree: getAdminGroupAccessTree(rules),
        subjects: SUBJECTS.map(s => ({
          id: s.id,
          label: s.label,
          shortLabel: s.shortLabel,
          color: s.color,
        })),
        catalog: buildSubjectCatalog().map(s => ({
          id: s.id,
          modules: s.modules.map(m => ({
            id: m.id,
            label: m.label,
            available: m.available,
          })),
        })),
      });
    }

    if (action === 'set_rule') {
      const facultyId = String(req.body.facultyId || '').trim() as FacultyId;
      const studyGroup = normalizeStudyGroup(String(req.body.studyGroup || ''));
      const subjectId = String(req.body.subjectId || '').trim();
      const enabled = req.body.enabled === true || req.body.enabled === 'true';

      if (!facultyId || !studyGroup || !subjectId) {
        return res.status(400).json({ error: 'Укажи факультет, группу и предмет.' });
      }
      if (!SUBJECTS.some(s => s.id === subjectId)) {
        return res.status(400).json({ error: 'Неизвестный предмет.' });
      }

      const durationKind = String(req.body.durationKind || 'unlimited') as GroupAccessDurationKind;
      const durationValue = req.body.durationValue != null
        ? Number(req.body.durationValue)
        : undefined;
      const examDate = req.body.examDate ? String(req.body.examDate) : undefined;
      const modules = normalizeModules(req.body.modules) as GroupAccessModule[];

      const next = upsertGroupAccessRule(rules, {
        facultyId,
        studyGroup,
        subjectId,
        enabled,
        modules,
        durationKind,
        durationValue,
        examDate,
        note: req.body.note ? String(req.body.note) : undefined,
      });
      await saveGroupAccessRules(redis, next);

      let synced = 0;
      if (req.body.syncUsers === true || req.body.syncUsers === 'true') {
        synced = await syncUsersForRule(facultyId, studyGroup, next);
      }

      return res.status(200).json({
        ok: true,
        tree: getAdminGroupAccessTree(next),
        synced,
      });
    }

    if (action === 'set_rules_bulk') {
      const facultyId = String(req.body.facultyId || '').trim() as FacultyId;
      const subjectId = String(req.body.subjectId || '').trim();
      const enabled = req.body.enabled === true || req.body.enabled === 'true';
      const fromDigits = Number(req.body.fromDigits);
      const toDigits = Number(req.body.toDigits);
      const course = req.body.course != null ? Number(req.body.course) : null;

      if (!facultyId || !subjectId || !Number.isFinite(fromDigits) || !Number.isFinite(toDigits)) {
        return res.status(400).json({ error: 'Укажи факультет, предмет и диапазон групп.' });
      }

      const durationKind = String(req.body.durationKind || 'unlimited') as GroupAccessDurationKind;
      const durationValue = req.body.durationValue != null ? Number(req.body.durationValue) : undefined;
      const examDate = req.body.examDate ? String(req.body.examDate) : undefined;
      const modules = normalizeModules(req.body.modules) as GroupAccessModule[];

      let next = [...rules];
      for (let n = fromDigits; n <= toDigits; n++) {
        const digits = String(n);
        if (course != null && Number(digits[0]) !== course) continue;
        const built = buildStudyGroupFromDigits(digits, facultyId);
        if (!built) continue;
        next = upsertGroupAccessRule(next, {
          facultyId,
          studyGroup: built,
          subjectId,
          enabled,
          modules,
          durationKind,
          durationValue,
          examDate,
        });
      }
      await saveGroupAccessRules(redis, next);

      const synced = await syncUsersForFacultyGroupRange(
        facultyId,
        fromDigits,
        toDigits,
        next,
        course,
      );

      return res.status(200).json({
        ok: true,
        tree: getAdminGroupAccessTree(next),
        synced,
        updated: toDigits - fromDigits + 1,
      });
    }

    if (action === 'sync_all') {
      const synced = await syncAllUsers(rules);
      return res.status(200).json({ ok: true, synced });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('[admin-group-access]', e);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function syncUsersForRule(
  facultyId: FacultyId,
  studyGroup: string,
  rules: Awaited<ReturnType<typeof loadGroupAccessRules>>,
): Promise<number> {
  const ids = await getAllUserIds(redis);
  let synced = 0;
  const target = normalizeStudyGroup(studyGroup);
  for (const id of ids) {
    const raw: unknown = await redis.get(`user_id:${id}`);
    if (!raw || typeof raw !== 'object') continue;
    const user = raw as Record<string, unknown>;
    if (String(user.facultyId || '') !== facultyId) continue;
    if (normalizeStudyGroup(String(user.studyGroup || '')) !== target) continue;
    const { user: patched, changed } = applyGroupAccessToUser(user, rules);
    if (changed) {
      await saveUser(id, patched);
      synced++;
    }
  }
  return synced;
}

async function syncUsersForFacultyGroupRange(
  facultyId: FacultyId,
  fromDigits: number,
  toDigits: number,
  rules: Awaited<ReturnType<typeof loadGroupAccessRules>>,
  course: number | null,
): Promise<number> {
  const ids = await getAllUserIds(redis);
  let synced = 0;
  for (const id of ids) {
    const raw: unknown = await redis.get(`user_id:${id}`);
    if (!raw || typeof raw !== 'object') continue;
    const user = raw as Record<string, unknown>;
    if (String(user.facultyId || '') !== facultyId) continue;
    const g = normalizeStudyGroup(String(user.studyGroup || ''));
    const digits = Number(g.match(/^([0-9]+)/)?.[1] || 0);
    if (!digits || digits < fromDigits || digits > toDigits) continue;
    if (course != null && Number(String(digits)[0]) !== course) continue;
    const { user: patched, changed } = applyGroupAccessToUser(user, rules);
    if (changed) {
      await saveUser(id, patched);
      synced++;
    }
  }
  return synced;
}

async function syncAllUsers(
  rules: Awaited<ReturnType<typeof loadGroupAccessRules>>,
): Promise<number> {
  const ids = await getAllUserIds(redis);
  let synced = 0;
  for (const id of ids) {
    const raw: unknown = await redis.get(`user_id:${id}`);
    if (!raw || typeof raw !== 'object') continue;
    const { user: patched, changed } = applyGroupAccessToUser(raw, rules);
    if (changed) {
      await saveUser(id, patched);
      synced++;
    }
  }
  return synced;
}
