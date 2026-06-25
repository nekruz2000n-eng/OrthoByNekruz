'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FACULTY_SHORT_LABEL } from '@/lib/facultyCodes';
import type { FacultyId } from '@/lib/groupRegistry';

const T = {
  surface:     '#FFFFFF',
  surfaceAlt:  '#FAF8F3',
  border:      '#E7E2D6',
  text:        '#1F1B14',
  textMuted:   '#6B6558',
  textFaint:   '#9A9485',
  accent:      '#1F7A6E',
  accentSoft:  '#E5F1EE',
  success:     '#3B7A48',
  successSoft: '#E4EFE3',
  warn:        '#A0741E',
  warnSoft:    '#F7EED7',
};

const FONT_SANS = 'var(--font-sans, system-ui, sans-serif)';

type DurationKind = 'unlimited' | 'hours' | 'days' | 'exam_day';
type ModuleId = 'questions' | 'tests' | 'tasks' | 'exam' | 'materials';

interface SubjectState {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  enabled: boolean;
  active: boolean;
  modules: ModuleId[];
  durationKind: DurationKind;
  durationValue: number | null;
  examDate: string | null;
  note: string | null;
  expiresAt: string | null;
}

interface GroupNode {
  digits: string;
  studyGroup: string;
  international?: boolean;
  note?: string;
  subjects: SubjectState[];
}

interface TreeFaculty {
  facultyId: FacultyId;
  label: string;
  maxCourse: number;
  courses: { course: number; groups: GroupNode[] }[];
}

function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Telegram?.WebApp?.initData ?? '';
}

const MODULE_OPTS: { id: ModuleId; label: string }[] = [
  { id: 'questions', label: 'Вопросы' },
  { id: 'tests',     label: 'Тесты' },
  { id: 'tasks',     label: 'Задачи' },
  { id: 'exam',      label: 'Проверка' },
  { id: 'materials', label: 'Материалы' },
];

const DURATION_OPTS: { id: DurationKind; label: string }[] = [
  { id: 'unlimited', label: 'Без срока' },
  { id: 'hours',     label: 'Часы' },
  { id: 'days',      label: 'Дни' },
  { id: 'exam_day',  label: 'До конца дня экзамена' },
];

export default function AdminGroupAccessTab({
  secret,
  showToast,
}: {
  secret: string;
  showToast: (msg: string) => void;
}) {
  const [tree, setTree] = useState<TreeFaculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facultyId, setFacultyId] = useState<FacultyId>('stomatology');
  const [course, setCourse] = useState(2);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState('bio');
  const [bulkDuration, setBulkDuration] = useState<DurationKind>('unlimited');
  const [bulkDurationValue, setBulkDurationValue] = useState(24);
  const [bulkExamDate, setBulkExamDate] = useState('');

  const faculty = useMemo(
    () => tree.find(f => f.facultyId === facultyId) ?? null,
    [tree, facultyId],
  );

  const courseGroups = useMemo(
    () => faculty?.courses.find(c => c.course === course)?.groups ?? [],
    [faculty, course],
  );

  const selectedList = useMemo(
    () => [...selectedGroups],
    [selectedGroups],
  );

  const loadTree = useCallback(async () => {
    const initData = getTelegramInitData();
    if (!initData || !secret) return;
    setLoading(true);
    try {
      const r = await fetch('/api/admin-group-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tree', secret, initData }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка загрузки');
      setTree(d.tree ?? []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [secret, showToast]);

  useEffect(() => { void loadTree(); }, [loadTree]);

  const toggleGroup = (studyGroup: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(studyGroup)) next.delete(studyGroup);
      else next.add(studyGroup);
      return next;
    });
  };

  const selectRange = (from: number, to: number) => {
    const next = new Set<string>();
    for (const g of courseGroups) {
      const n = Number(g.digits);
      if (n >= from && n <= to) next.add(g.studyGroup);
    }
    setSelectedGroups(next);
  };

  const setRule = async (
    studyGroup: string,
    subjectId: string,
    enabled: boolean,
    opts?: {
      durationKind?: DurationKind;
      durationValue?: number;
      examDate?: string;
      modules?: ModuleId[];
    },
  ) => {
    const initData = getTelegramInitData();
    if (!initData) { showToast('Нет initData'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/admin-group-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_rule',
          secret,
          initData,
          facultyId,
          studyGroup,
          subjectId,
          enabled,
          syncUsers: true,
          durationKind: opts?.durationKind ?? 'unlimited',
          durationValue: opts?.durationValue,
          examDate: opts?.examDate,
          modules: opts?.modules ?? ['questions', 'tests', 'tasks'],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка');
      setTree(d.tree ?? []);
      showToast(enabled
        ? `✓ Открыто (${d.synced ?? 0} студ.)`
        : `✕ Закрыто (${d.synced ?? 0} студ.)`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const bulkSet = async (enabled: boolean) => {
    if (selectedList.length === 0) {
      showToast('Выбери группы');
      return;
    }
    const digits = selectedList
      .map(g => Number(g.match(/^([0-9]+)/)?.[1] || 0))
      .filter(n => n > 0);
    if (!digits.length) return;
    const fromDigits = Math.min(...digits);
    const toDigits = Math.max(...digits);
    const initData = getTelegramInitData();
    if (!initData) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin-group-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_rules_bulk',
          secret,
          initData,
          facultyId,
          subjectId: bulkSubject,
          enabled,
          fromDigits,
          toDigits,
          course,
          syncUsers: true,
          durationKind: bulkDuration,
          durationValue: bulkDuration === 'hours' || bulkDuration === 'days'
            ? bulkDurationValue
            : undefined,
          examDate: bulkDuration === 'exam_day' ? bulkExamDate : undefined,
          modules: ['questions', 'tests', 'tasks'],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка');
      setTree(d.tree ?? []);
      showToast(`✓ ${enabled ? 'Открыто' : 'Закрыто'} для ${d.updated ?? 0} групп · ${d.synced ?? 0} студ.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const singleGroup = selectedList.length === 1
    ? courseGroups.find(g => g.studyGroup === selectedList[0])
    : null;

  if (loading && tree.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 14 }}>
        Загрузка сетки групп…
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px 24px', fontFamily: FONT_SANS }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
        Доступ по группам
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.45 }}>
        Включи предмет для группы — студенты получат полный доступ без пробы при вводе группы.
        Оплаченный доступ не снимается.
      </div>

      {/* Факультеты */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['stomatology', 'therapeutic', 'pediatrics'] as FacultyId[]).map(id => (
          <button
            key={id}
            type="button"
            onClick={() => { setFacultyId(id); setSelectedGroups(new Set()); }}
            style={{
              padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: `1px solid ${facultyId === id ? T.accent : T.border}`,
              background: facultyId === id ? T.accentSoft : T.surfaceAlt,
              color: facultyId === id ? T.accent : T.textMuted,
              cursor: 'pointer',
            }}
          >
            {FACULTY_SHORT_LABEL[id]}
          </button>
        ))}
      </div>

      {/* Курс */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Array.from({ length: faculty?.maxCourse ?? 5 }, (_, i) => i + 1).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { setCourse(c); setSelectedGroups(new Set()); }}
            style={{
              padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${course === c ? T.accent : T.border}`,
              background: course === c ? T.accentSoft : T.surface,
              color: course === c ? T.accent : T.textFaint,
              cursor: 'pointer',
            }}
          >
            {c} курс
          </button>
        ))}
      </div>

      {/* Быстрый выбор стом 2 курс 201–208 */}
      {facultyId === 'stomatology' && course === 2 && (
        <button
          type="button"
          onClick={() => selectRange(201, 208)}
          style={{
            marginBottom: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            border: `1px dashed ${T.accent}`, background: T.accentSoft, color: T.accent,
            fontWeight: 600, cursor: 'pointer', width: '100%',
          }}
        >
          Выбрать 201с–208с (половина потока)
        </button>
      )}

      {/* Группы */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14,
        maxHeight: 160, overflowY: 'auto', padding: 4,
      }}>
        {courseGroups.map(g => {
          const on = selectedGroups.has(g.studyGroup);
          const bioOn = g.subjects.find(s => s.id === 'bio')?.active;
          return (
            <button
              key={g.studyGroup}
              type="button"
              onClick={() => toggleGroup(g.studyGroup)}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${on ? T.accent : bioOn ? T.success : T.border}`,
                background: on ? T.accentSoft : bioOn ? T.successSoft : T.surface,
                color: on ? T.accent : bioOn ? T.success : T.text,
                cursor: 'pointer',
                opacity: g.international ? 0.85 : 1,
              }}
              title={g.international ? 'Иностранцы (англ.)' : undefined}
            >
              {g.studyGroup}{g.international ? ' 🌐' : ''}
            </button>
          );
        })}
      </div>

      {/* Массовое действие */}
      {selectedList.length > 0 && (
        <div style={{
          background: T.surfaceAlt, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 12, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            Выбрано групп: {selectedList.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <select
              value={bulkSubject}
              onChange={e => setBulkSubject(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 8, border: `1px solid ${T.border}` }}
            >
              {(faculty?.courses[0]?.groups[0]?.subjects ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              value={bulkDuration}
              onChange={e => setBulkDuration(e.target.value as DurationKind)}
              style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 8, border: `1px solid ${T.border}` }}
            >
              {DURATION_OPTS.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            {(bulkDuration === 'hours' || bulkDuration === 'days') && (
              <input
                type="number"
                min={1}
                value={bulkDurationValue}
                onChange={e => setBulkDurationValue(Number(e.target.value) || 1)}
                style={{ width: 72, padding: 8, borderRadius: 8, border: `1px solid ${T.border}` }}
              />
            )}
            {bulkDuration === 'exam_day' && (
              <input
                type="date"
                value={bulkExamDate}
                onChange={e => setBulkExamDate(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: `1px solid ${T.border}` }}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void bulkSet(true)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                background: T.accent, color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              Открыть доступ
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void bulkSet(false)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${T.border}`, background: T.surface,
                color: T.textMuted, fontWeight: 600, fontSize: 13,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Одна группа — детальная настройка по предметам */}
      {singleGroup && (
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            Группа {singleGroup.studyGroup}
            {singleGroup.international && (
              <span style={{ fontSize: 11, color: T.warn, fontWeight: 500 }}> · иностранцы</span>
            )}
          </div>
          {singleGroup.subjects.map(subj => (
            <SubjectRow
              key={subj.id}
              subj={subj}
              saving={saving}
              onToggle={enabled => void setRule(singleGroup.studyGroup, subj.id, enabled, {
                durationKind: subj.durationKind,
                durationValue: subj.durationValue ?? undefined,
                examDate: subj.examDate ?? undefined,
                modules: subj.modules,
              })}
              onSave={(enabled, opts) => void setRule(singleGroup.studyGroup, subj.id, enabled, opts)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void loadTree()}
        style={{
          marginTop: 14, width: '100%', padding: 10, borderRadius: 10,
          border: `1px solid ${T.border}`, background: T.surfaceAlt,
          color: T.textMuted, fontSize: 12, cursor: 'pointer',
        }}
      >
        Обновить список
      </button>
    </div>
  );
}

function SubjectRow({
  subj,
  saving,
  onToggle,
  onSave,
}: {
  subj: SubjectState;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onSave: (enabled: boolean, opts: {
    durationKind: DurationKind;
    durationValue?: number;
    examDate?: string;
    modules: ModuleId[];
  }) => void;
}) {
  const [durationKind, setDurationKind] = useState<DurationKind>(subj.durationKind);
  const [durationValue, setDurationValue] = useState(subj.durationValue ?? 24);
  const [examDate, setExamDate] = useState(subj.examDate ?? '');
  const [modules, setModules] = useState<ModuleId[]>(subj.modules);

  useEffect(() => {
    setDurationKind(subj.durationKind);
    setDurationValue(subj.durationValue ?? 24);
    setExamDate(subj.examDate ?? '');
    setModules(subj.modules);
  }, [subj]);

  const toggleModule = (id: ModuleId) => {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: subj.color }}>{subj.label}</span>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (subj.active) onToggle(false);
            else onSave(true, {
              durationKind,
              durationValue: durationKind === 'hours' || durationKind === 'days' ? durationValue : undefined,
              examDate: durationKind === 'exam_day' ? examDate : undefined,
              modules,
            });
          }}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none',
            background: subj.active ? T.success : T.surfaceAlt,
            color: subj.active ? '#fff' : T.textMuted,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {subj.active ? 'Открыто' : 'Закрыто'}
        </button>
      </div>
      {subj.enabled && (
        <div style={{ marginTop: 8, fontSize: 11, color: T.textFaint }}>
          {subj.expiresAt
            ? `до ${new Date(subj.expiresAt).toLocaleString('ru-RU')}`
            : 'без срока'}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {MODULE_OPTS.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggleModule(m.id)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 11,
              border: `1px solid ${modules.includes(m.id) ? T.accent : T.border}`,
              background: modules.includes(m.id) ? T.accentSoft : T.surfaceAlt,
              color: modules.includes(m.id) ? T.accent : T.textFaint,
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <select
          value={durationKind}
          onChange={e => setDurationKind(e.target.value as DurationKind)}
          style={{ flex: 1, minWidth: 100, padding: 6, borderRadius: 8, fontSize: 11, border: `1px solid ${T.border}` }}
        >
          {DURATION_OPTS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {(durationKind === 'hours' || durationKind === 'days') && (
          <input
            type="number"
            min={1}
            value={durationValue}
            onChange={e => setDurationValue(Number(e.target.value) || 1)}
            style={{ width: 56, padding: 6, borderRadius: 8, fontSize: 11, border: `1px solid ${T.border}` }}
          />
        )}
        {durationKind === 'exam_day' && (
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            style={{ padding: 6, borderRadius: 8, fontSize: 11, border: `1px solid ${T.border}` }}
          />
        )}
        <button
          type="button"
          disabled={saving || modules.length === 0}
          onClick={() => onSave(true, {
            durationKind,
            durationValue: durationKind === 'hours' || durationKind === 'days' ? durationValue : undefined,
            examDate: durationKind === 'exam_day' ? examDate : undefined,
            modules,
          })}
          style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            border: 'none', background: T.accent, color: '#fff',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
