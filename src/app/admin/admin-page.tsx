"use client";
// src/app/admin/page.tsx

import { useState, useCallback } from 'react';

interface User {
  tgId:          string;
  blocked:       boolean;
  blockedReason: string | null;
  blockedAt:     string | null;
  hasMicro:      boolean;
  activatedKey:  string | null;
  registeredAt:  string | null;
  opensToday:    number;
  fpChanges:     number;
  suspicious:    boolean;
}

type Filter = 'all' | 'blocked' | 'suspicious';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function AdminPage() {
  const [secret,    setSecret]    = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [users,     setUsers]     = useState<User[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [search,    setSearch]    = useState('');
  const [error,     setError]     = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [toast,     setToast]     = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchUsers = useCallback(async (s: string) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin-users?secret=${encodeURIComponent(s)}`);
      if (r.status === 401) { setError('Неверный пароль'); setAuthed(false); return; }
      if (!r.ok)            { setError('Ошибка сервера'); return; }
      const data = await r.json();
      setUsers(data.users ?? []);
      setAuthed(true);
    } catch { setError('Ошибка соединения'); }
    finally  { setLoading(false); }
  }, []);

  const doAction = async (tgId: string, action: 'block' | 'unblock' | 'give_micro' | 'revoke_micro') => {
    setActioning(`${tgId}:${action}`);
    try {
      const r = await fetch(`/api/admin-users?secret=${encodeURIComponent(secret)}&action=${action}&tgId=${tgId}`);
      if (r.ok) {
        setUsers(prev => prev.map(u => {
          if (u.tgId !== tgId) return u;
          if (action === 'block')       return { ...u, blocked: true,  blockedReason: 'manual', blockedAt: new Date().toISOString() };
          if (action === 'unblock')     return { ...u, blocked: false, blockedReason: null, blockedAt: null };
          if (action === 'give_micro')  return { ...u, hasMicro: true };
          if (action === 'revoke_micro') return { ...u, hasMicro: false };
          return u;
        }));
        showToast(
          action === 'block'        ? `✕ ${tgId} заблокирован` :
          action === 'unblock'      ? `✓ ${tgId} разблокирован` :
          action === 'give_micro'   ? `✓ ${tgId} получил Micro` :
                                      `✕ ${tgId} — Micro отозван`
        );
      }
    } finally { setActioning(null); }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showToast(`Скопировано: ${id}`);
  };

  const visible = users.filter(u => {
    if (filter === 'blocked'    && !u.blocked)                  return false;
    if (filter === 'suspicious' && !u.suspicious && !u.blocked) return false;
    if (search && !u.tgId.includes(search))                     return false;
    return true;
  });

  const blocked    = users.filter(u => u.blocked).length;
  const suspicious = users.filter(u => u.suspicious && !u.blocked).length;
  const withMicro  = users.filter(u => u.hasMicro).length;
  const activeToday = users.filter(u => u.opensToday > 0).length;

  // ── Логин ────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#141414', border: '1px solid #242424', borderRadius: 16, padding: '40px 48px', width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40 }}>🦷</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 10 }}>OrthoByNekruz</div>
          <div style={{ color: '#444', fontSize: 13, marginTop: 4 }}>Admin Panel</div>
        </div>
        <form onSubmit={e => { e.preventDefault(); fetchUsers(secret); }}>
          <input type="password" placeholder="ADMIN_SECRET" value={secret}
            onChange={e => setSecret(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#0a0a0a', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const }} />
          {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 10, textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading || !secret}
            style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, background: secret && !loading ? '#2563eb' : '#1a1a1a', color: secret && !loading ? '#fff' : '#444', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Проверка...' : 'Войти →'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Панель ───────────────────────────────────────────────────────────────
  return (
    <div className="scroll-container" style={{ height: '100vh', overflowY: 'scroll', background: '#0a0a0a', fontFamily: 'system-ui,sans-serif', color: '#e5e5e5' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 20px', color: '#e5e5e5', fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1f1f1f', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontSize: 22 }}>🦷</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>OrthoByNekruz</span>
          <span style={{ color: '#444', fontSize: 12, marginLeft: 10 }}>Admin Panel</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => fetchUsers(secret)} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontSize: 13 }}>
            {loading ? '...' : '↻ Обновить'}
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>

        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Всего',          value: users.length,  color: '#60a5fa', icon: '👥' },
            { label: 'Активны сегодня', value: activeToday,  color: '#a78bfa', icon: '📱' },
            { label: 'Заблокировано',  value: blocked,       color: '#f87171', icon: '🚫' },
            { label: 'Подозрительных', value: suspicious,    color: '#fbbf24', icon: '⚠️' },
            { label: 'Есть Micro',     value: withMicro,     color: '#34d399', icon: '🧬' },
          ].map(s => (
            <div key={s.label} style={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 12, padding: '16px 18px', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ color: s.color, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ color: '#444', fontSize: 12, marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Фильтры + поиск */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          {([
            ['all',        `Все (${users.length})`],
            ['blocked',    `Заблок. (${blocked})`],
            ['suspicious', `Подозрит. (${suspicious})`],
          ] as [Filter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${filter === f ? '#3b82f6' : '#1f1f1f'}`,
              background: filter === f ? '#1d3a6a' : '#141414',
              color:      filter === f ? '#93c5fd' : '#555',
            }}>{label}</button>
          ))}
          <input placeholder="🔍  Поиск по ID..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid #1f1f1f', background: '#111', color: '#ddd', fontSize: 13, outline: 'none', width: 200 }} />
        </div>

        {/* Таблица */}
        <div style={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 12, overflow: 'hidden' }}>
          {/* Шапка */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 90px 105px 65px 55px 110px 1fr 180px', gap: 8, padding: '11px 20px', borderBottom: '1px solid #1f1f1f', color: '#333', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            <span>TG ID</span><span>Статус</span><span>Регистрация</span>
            <span>Откр.</span><span>FP</span><span>Доступ</span>
            <span>Инфо</span><span style={{ textAlign: 'right' as const }}>Действия</span>
          </div>

          {loading && <div style={{ textAlign: 'center', color: '#333', padding: 60, fontSize: 14 }}>Загрузка...</div>}
          {!loading && visible.length === 0 && <div style={{ textAlign: 'center', color: '#333', padding: 60, fontSize: 14 }}>Пользователи не найдены</div>}

          {visible.map((u, i) => (
            <div key={u.tgId}>
              {/* Основная строка */}
              <div style={{
                display: 'grid', gridTemplateColumns: '150px 90px 105px 65px 55px 110px 1fr 180px',
                gap: 8, padding: '13px 20px', alignItems: 'center', fontSize: 13,
                borderBottom: '1px solid #111',
                background: u.blocked ? 'rgba(239,68,68,0.03)' : u.suspicious ? 'rgba(245,158,11,0.03)' : 'transparent',
                transition: 'background 0.15s',
              }}>

                {/* TG ID + копировать */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'monospace', color: '#7dd3fc', fontSize: 12, cursor: 'pointer' }}
                    onClick={() => copyId(u.tgId)}
                    title="Нажми чтобы скопировать">
                    {u.tgId}
                  </span>
                </div>

                {/* Статус */}
                <span>
                  {u.blocked
                    ? <span style={{ background: '#3f1515', color: '#f87171', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>БЛОК</span>
                    : u.suspicious
                    ? <span style={{ background: '#3d2a00', color: '#fbbf24', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>⚠ ПОДОЗР</span>
                    : <span style={{ background: '#0d2e1e', color: '#34d399', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>ОК</span>
                  }
                </span>

                {/* Дата */}
                <div>
                  <div style={{ color: '#555', fontSize: 11 }}>{fmtDate(u.registeredAt)}</div>
                  <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>
                    {daysSince(u.registeredAt) === 0 ? 'сегодня' : `${daysSince(u.registeredAt)} дн. назад`}
                  </div>
                </div>

                {/* Открытий */}
                <span style={{ color: u.opensToday >= 5 ? '#f87171' : u.opensToday >= 3 ? '#fbbf24' : '#444', fontWeight: 600 }}>
                  {u.opensToday}
                </span>

                {/* FP смен */}
                <span style={{ color: u.fpChanges >= 3 ? '#f87171' : u.fpChanges >= 1 ? '#fbbf24' : '#2a2a2a' }}>
                  {u.fpChanges || '—'}
                </span>

                {/* Доступы */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                  <span style={{ background: '#1e3a5f', color: '#7dd3fc', borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>ortho</span>
                  {u.hasMicro && <span style={{ background: '#14312b', color: '#6ee7b7', borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>micro</span>}
                </div>

                {/* Инфо */}
                <div style={{ color: '#333', fontSize: 11 }}>
                  {u.blocked
                    ? <span style={{ color: '#f87171' }}>{u.blockedReason} · {fmtDate(u.blockedAt)}</span>
                    : u.activatedKey
                    ? <span>ключ: <span style={{ fontFamily: 'monospace', color: '#555' }}>{u.activatedKey}</span></span>
                    : '—'
                  }
                </div>

                {/* Действия */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' as const }}>
                  {/* Блок / Разблок */}
                  {u.blocked
                    ? <button onClick={() => doAction(u.tgId, 'unblock')} disabled={!!actioning}
                        style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#0d2e1e', color: '#34d399', border: '1px solid #1a4a30', opacity: actioning ? 0.5 : 1 }}>
                        ✓ Разблок
                      </button>
                    : <button onClick={() => doAction(u.tgId, 'block')} disabled={!!actioning}
                        style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#3f1515', color: '#f87171', border: '1px solid #6b2020', opacity: actioning ? 0.5 : 1 }}>
                        ✕ Блок
                      </button>
                  }
                  {/* Micro */}
                  {u.hasMicro
                    ? <button onClick={() => doAction(u.tgId, 'revoke_micro')} disabled={!!actioning}
                        style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a', opacity: actioning ? 0.5 : 1 }}>
                        − Micro
                      </button>
                    : <button onClick={() => doAction(u.tgId, 'give_micro')} disabled={!!actioning}
                        style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#14312b', color: '#6ee7b7', border: '1px solid #1a4a30', opacity: actioning ? 0.5 : 1 }}>
                        + Micro
                      </button>
                  }
                  {/* Подробнее */}
                  <button onClick={() => setExpanded(expanded === u.tgId ? null : u.tgId)}
                    style={{ padding: '5px 11px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#1a1a1a', color: expanded === u.tgId ? '#93c5fd' : '#444', border: `1px solid ${expanded === u.tgId ? '#3b82f6' : '#2a2a2a'}` }}>
                    ⋯
                  </button>
                </div>
              </div>

              {/* Раскрытая строка */}
              {expanded === u.tgId && (
                <div style={{ padding: '14px 20px 16px', background: '#0f0f0f', borderBottom: '1px solid #111', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                  {[
                    ['Telegram ID',      u.tgId],
                    ['Регистрация',      fmtDate(u.registeredAt)],
                    ['Дней с регистр.',  daysSince(u.registeredAt) + ' дн.'],
                    ['Открытий сегодня', String(u.opensToday)],
                    ['Смен устройства',  String(u.fpChanges || 0)],
                    ['Ключ активации',   u.activatedKey || '—'],
                    ['Доступ Ortho',     'есть'],
                    ['Доступ Micro',     u.hasMicro ? 'есть' : 'нет'],
                    ['Причина блок.',    u.blockedReason || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ color: '#333', fontSize: 11, marginBottom: 3 }}>{label}</div>
                      <div style={{ color: '#888', fontSize: 13, fontFamily: label.includes('ID') || label.includes('ключ') ? 'monospace' : 'inherit' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Пояснение колонок */}
        <div style={{ marginTop: 20, padding: '14px 18px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
          {[
            ['Откр.', 'Сколько раз открыл приложение сегодня. ≥5 = подозрительно'],
            ['FP',    'Смены устройства (device fingerprint). ≥2 = возможный шаринг'],
            ['⋯',    'Раскрыть подробную карточку пользователя'],
          ].map(([key, desc]) => (
            <div key={key} style={{ fontSize: 12 }}>
              <span style={{ color: '#555', fontWeight: 600 }}>{key}</span>
              <span style={{ color: '#333', marginLeft: 6 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}