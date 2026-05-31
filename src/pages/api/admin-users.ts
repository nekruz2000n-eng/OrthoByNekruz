import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { SUBJECTS, getSubject, getUserAvailableSubjects } from '@/lib/subjects';
import { verifyInitDataUser } from '@/lib/verifyInitData';
import { getAllUserIds, registerUserId, removeUserId } from '@/lib/userIndex';

const redis        = Redis.fromEnv();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_TG_ID  = process.env.ADMIN_TG_ID || '978243325';
const BOT_TOKEN    = process.env.BOT_TOKEN    || '';
const PAGE_SIZE    = 50;

type ListFilter = 'all' | 'blocked' | 'suspicious' | 'demo' | 'unpaid';
type ListSort   = 'registered' | 'lastLogin' | 'loginCount';

function verifyAdmin(initData: string, secret: string): boolean {
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) return false;
  if (!BOT_TOKEN) return false;
  const tgUser = verifyInitDataUser(initData, BOT_TOKEN);
  if (!tgUser || String(tgUser.id) !== ADMIN_TG_ID) return false;
  return true;
}

function ensureSubjects(user: any): any {
  if (!user) return user;
  if (user.subjects && typeof user.subjects === 'object') return user;

  const subjects: { [k: string]: boolean } = {};
  for (const s of SUBJECTS) subjects[s.id] = false;
  if (user.activatedKey) subjects.ortho = true;
  if (user.micro === true) subjects.micro = true;

  return { ...user, subjects };
}

function subjectPayload() {
  return SUBJECTS.map(s => ({
    id:         s.id,
    label:      s.label,
    shortLabel: s.shortLabel,
    color:      s.color,
  }));
}

function isSuspicious(opensToday: number): boolean {
  return opensToday >= 5;
}

function toListUser(
  id: string,
  user: any,
  opensToday: number,
  usedDemo: boolean,
) {
  user = ensureSubjects(user);
  const userSubjects = getUserAvailableSubjects(user);
  return {
    tgId:          id,
    username:      user.username      ?? null,
    firstName:     user.firstName     ?? null,
    lastName:      user.lastName      ?? null,
    blocked:       user.blocked === true,
    blockedReason: user.blockedReason ?? null,
    blockedAt:     user.blockedAt     ?? null,
    subjects:      userSubjects,
    hasMicro:      userSubjects.includes('micro'),
    usedDemo,
    activatedKey:  user.activatedKey  ?? null,
    registeredAt:  user.date          ?? null,
    lastLogin:     user.lastLogin     ?? null,
    loginCount:    Number(user.loginCount) || 0,
    opensToday,
    suspicious:    isSuspicious(opensToday),
    paid:          user.paid === true,
  };
}

function toDetailUser(
  id: string,
  user: any,
  opensToday: number,
  usedDemo: boolean,
) {
  user = ensureSubjects(user);
  const userSubjects = getUserAvailableSubjects(user);
  return {
    tgId:          id,
    username:      user.username      ?? null,
    firstName:     user.firstName     ?? null,
    lastName:      user.lastName      ?? null,
    blocked:       user.blocked === true,
    blockedReason: user.blockedReason ?? null,
    blockedAt:     user.blockedAt     ?? null,
    subjects:      userSubjects,
    hasMicro:      userSubjects.includes('micro'),
    usedDemo,
    activatedKey:  user.activatedKey  ?? null,
    registeredAt:  user.date          ?? null,
    lastLogin:     user.lastLogin     ?? null,
    loginCount:    Number(user.loginCount) || 0,
    opensToday,
    suspicious:    isSuspicious(opensToday),
    navHidden:     (user.navHidden && typeof user.navHidden === 'object') ? user.navHidden : {},
    paid:          user.paid === true,
  };
}

/** Ключ активирован (не trial), отметка «оплачено» не стоит */
function isUnpaid(u: ReturnType<typeof toListUser>): boolean {
  const key = u.activatedKey;
  if (!key || key === 'trial') return false;
  return u.paid !== true;
}

function matchesQuery(u: ReturnType<typeof toListUser>, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/^@/, '');
  if (!needle) return true;
  const hay = [u.tgId, u.username, u.firstName, u.lastName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (hay.includes(needle)) return true;
  if (u.username && u.username.toLowerCase().includes(needle)) return true;
  return false;
}

function sortUsers(
  list: ReturnType<typeof toListUser>[],
  sortBy: ListSort,
  sortDir: 'asc' | 'desc',
) {
  return [...list].sort((a, b) => {
    if (sortBy === 'loginCount') {
      const diff = b.opensToday - a.opensToday;
      if (diff !== 0) return diff;
      return b.loginCount - a.loginCount;
    }
    if (sortBy === 'lastLogin') {
      const ta = a.lastLogin ? Date.parse(a.lastLogin) : (a.registeredAt ? Date.parse(a.registeredAt) : 0);
      const tb = b.lastLogin ? Date.parse(b.lastLogin) : (b.registeredAt ? Date.parse(b.registeredAt) : 0);
      return tb - ta;
    }
    const ta = a.registeredAt ? Date.parse(a.registeredAt) : 0;
    const tb = b.registeredAt ? Date.parse(b.registeredAt) : 0;
    return sortDir === 'asc' ? ta - tb : tb - ta;
  });
}

async function saveUser(tgId: string, data: any) {
  await redis.set(`user_id:${tgId}`, data);
  await registerUserId(redis, tgId);
}

async function buildUserList(ids: string[]) {
  if (!ids.length) return [];

  const today = new Date().toISOString().slice(0, 10);

  const pipeline1 = redis.pipeline();
  for (const id of ids) pipeline1.get(`user_id:${id}`);
  const rawUsers = await pipeline1.exec();

  const pipeline2 = redis.pipeline();
  for (const id of ids) {
    pipeline2.get(`opens:${id}:${today}`);
  }
  const opensData = await pipeline2.exec();

  const pipeline3 = redis.pipeline();
  for (const id of ids) pipeline3.sismember('used_demo_ids', id);
  const demoData = await pipeline3.exec();

  return ids.map((id, i) => {
    const user      = (rawUsers[i] as any) ?? {};
    const opens     = Number(opensData[i]) || 0;
    const usedDemo  = Boolean(demoData[i]);
    return toListUser(id, user, opens, usedDemo);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    initData, secret, action, tgId, subject, enable, reason, section,
    page, limit, filter, q, sortBy, sortDir,
  } = req.body ?? {};

  if (!initData || !secret || !verifyAdmin(String(initData), String(secret))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (action === 'get_user' && tgId) {
      const id = String(tgId);
      const user: any = await redis.get(`user_id:${id}`);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const today = new Date().toISOString().slice(0, 10);
      const opensToday = Number(await redis.get(`opens:${id}:${today}`)) || 0;
      const usedDemo   = Boolean(await redis.sismember('used_demo_ids', id));

      return res.status(200).json({
        user: toDetailUser(id, user, opensToday, usedDemo),
      });
    }

    if (action && tgId) {
      let user: any = await redis.get(`user_id:${tgId}`);
      if (!user && action !== 'reset_demo') {
        return res.status(404).json({ error: 'User not found' });
      }
      user = ensureSubjects(user);

      if (action === 'block') {
        const cleanReason = String(reason ?? '').trim().slice(0, 200) || 'manual';
        await saveUser(String(tgId), {
          ...user,
          blocked:       true,
          blockedReason: cleanReason,
          blockedAt:     new Date().toISOString(),
        });
        return res.status(200).json({ ok: true });
      }

      if (action === 'unblock') {
        const updated: Record<string, any> = { ...user };
        delete updated.blocked;
        delete updated.blockedReason;
        delete updated.blockedAt;
        await saveUser(String(tgId), updated);
        const today = new Date().toISOString().slice(0, 10);
        await redis.del(`opens:${tgId}:${today}`);
        await redis.del(`opens_notified:${tgId}:${today}`);
        return res.status(200).json({ ok: true });
      }

      if (action === 'toggle_subject') {
        const subjectId = String(subject || '').trim();
        const enabled   = enable === true || enable === 'true' || enable === '1';

        const cfg = getSubject(subjectId);
        if (!cfg) {
          return res.status(400).json({ error: `Unknown subject: ${subjectId}` });
        }

        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) {
          if (!(s.id in subjects)) subjects[s.id] = false;
        }
        subjects[subjectId] = enabled;

        const ALL_SECTIONS = ['questions', 'tests', 'tasks', 'exam', 'materials'];

        const navHidden: Record<string, string[]> = { ...(user.navHidden || {}) };
        if (enabled) {
          navHidden[subjectId] = ALL_SECTIONS;
        } else {
          delete navHidden[subjectId];
        }

        const updated: any = { ...user, subjects, navHidden, _migrated_subjects: true };

        if (enabled) {
          updated[`${subjectId}_grantedAt`] = new Date().toISOString();
        } else {
          delete updated[`${subjectId}_grantedAt`];
        }

        if (subjectId === 'micro') {
          if (enabled) {
            updated.micro          = true;
            updated.microGrantedAt = new Date().toISOString();
          } else {
            delete updated.micro;
            delete updated.microGrantedAt;
            delete updated.microKey;
            delete updated.microDate;
          }
        }

        await saveUser(String(tgId), updated);
        return res.status(200).json({
          ok: true,
          subjects: getUserAvailableSubjects(updated),
          navHidden,
        });
      }

      if (action === 'give_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = true;
        await saveUser(String(tgId), {
          ...user,
          subjects,
          micro:              true,
          microGrantedAt:     new Date().toISOString(),
          _migrated_subjects: true,
        });
        return res.status(200).json({ ok: true });
      }

      if (action === 'revoke_micro') {
        const subjects = { ...(user.subjects || {}) };
        for (const s of SUBJECTS) if (!(s.id in subjects)) subjects[s.id] = false;
        subjects.micro = false;
        const u: Record<string, any> = { ...user, subjects, _migrated_subjects: true };
        delete u.micro;
        delete u.microGrantedAt;
        delete u.microKey;
        delete u.microDate;
        await saveUser(String(tgId), u);
        return res.status(200).json({ ok: true });
      }

      if (action === 'reset_demo') {
        await redis.srem('used_demo_ids', tgId as string);
        return res.status(200).json({ ok: true });
      }

      if (action === 'toggle_paid') {
        const newPaid = !user.paid;
        await saveUser(String(tgId), { ...user, paid: newPaid });
        return res.status(200).json({ ok: true, paid: newPaid });
      }

      if (action === 'delete_user') {
        const id = String(tgId);
        await redis.del(`user_id:${id}`);
        await removeUserId(redis, id);
        await redis.srem('used_demo_ids', id);
        try {
          let cur = 0;
          do {
            const [nextCur, keys] = await redis.scan(cur, { match: `opens*:${id}:*`, count: 100 });
            cur = Number(nextCur);
            if ((keys as string[]).length) {
              await redis.del(...(keys as [string, ...string[]]));
            }
          } while (cur !== 0);
        } catch { /* не критично */ }
        return res.status(200).json({ ok: true });
      }

      if (action === 'toggle_section') {
        const subjectId = String(subject || '').trim();
        const sectionId = String(section || '').trim();
        const enabled   = enable === true || enable === 'true' || enable === '1';
        const ALLOWED_SECTIONS = ['questions', 'tests', 'tasks', 'exam', 'materials'];
        if (!subjectId || !ALLOWED_SECTIONS.includes(sectionId)) {
          return res.status(400).json({ error: 'Bad subject/section' });
        }
        const navHidden: Record<string, string[]> = { ...(user.navHidden || {}) };
        const set = new Set<string>(navHidden[subjectId] || []);
        if (enabled) set.delete(sectionId); else set.add(sectionId);
        if (set.size === 0) delete navHidden[subjectId]; else navHidden[subjectId] = [...set];
        await saveUser(String(tgId), { ...user, navHidden });
        return res.status(200).json({ ok: true, navHidden });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    // ── Список пользователей (пагинация + фильтры на сервере) ───────────────
    const ids = await getAllUserIds(redis);
    const allUsers = await buildUserList(ids);

    const listFilter = (['all', 'blocked', 'suspicious', 'demo', 'unpaid'].includes(filter)
      ? filter
      : 'all') as ListFilter;
    const listSort = (['registered', 'lastLogin', 'loginCount'].includes(sortBy)
      ? sortBy
      : 'lastLogin') as ListSort;
    const listSortDir: 'asc' | 'desc' =
      sortDir === 'asc' && listSort === 'registered' ? 'asc' : 'desc';
    const query = String(q ?? '').trim().toLowerCase();

    let filtered = allUsers.filter(u => {
      if (listFilter === 'blocked'    && !u.blocked) return false;
      if (listFilter === 'suspicious' && !u.suspicious && !u.blocked) return false;
      if (listFilter === 'demo'       && !u.usedDemo) return false;
      if (listFilter === 'unpaid'     && !isUnpaid(u)) return false;
      if (query && !matchesQuery(u, query)) return false;
      return true;
    });

    filtered = sortUsers(filtered, listSort, listSortDir);

    const pageSize = PAGE_SIZE;
    const browsingTop50 = listFilter === 'all' && !query;
    const pageNum  = browsingTop50 ? 1 : Math.max(1, Number(page) || 1);
    const start    = (pageNum - 1) * pageSize;
    const slice    = filtered.slice(start, start + pageSize);

    const blockedCount    = allUsers.filter(u => u.blocked).length;
    const suspiciousCount = allUsers.filter(u => u.suspicious && !u.blocked).length;
    const demoCount       = allUsers.filter(u => u.usedDemo).length;
    const unpaidCount     = allUsers.filter(isUnpaid).length;
    const microCount      = allUsers.filter(u => u.subjects.some(s => s !== 'ortho')).length;

    return res.status(200).json({
      users: slice,
      total: allUsers.length,
      filteredTotal: filtered.length,
      page: pageNum,
      pageSize,
      hasMore: browsingTop50 ? false : start + pageSize < filtered.length,
      sortBy: listSort,
      sortDir: listSortDir,
      demoCount,
      unpaidCount,
      blockedCount,
      suspiciousCount,
      microCount,
      availableSubjects: subjectPayload(),
    });

  } catch (err) {
    console.error('[admin-users] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
