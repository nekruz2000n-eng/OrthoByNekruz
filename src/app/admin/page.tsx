"use client";
// src/app/admin/page.tsx  ← App Router

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

const S = {
  page:    { minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui,sans-serif', color: '#e5e5e5' } as React.CSSProperties,
  header:  { background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties,
  body:    { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' } as React.CSSProperties,
  card:    { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12 } as React.CSSProperties,
  input:   { padding: '11px 16px', borderRadius: 10, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
  btn:     (bg: string, color: string, border: string) => ({ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: bg, color, border: `1px solid ${border}` } as React.CSSProperties),
  badge:   (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 } as React.CSSProperties),
  grid:    { display: 'grid', gridTemplateColumns: '130px 100px 100px 70px 70px 100px 1fr 130px', gap: 8, padding: '13px 20px', alignItems: 'center', fontSize: 13 } as React.CSSProperties,
};

export default function AdminPage() {
  const [secret,    setSecret]    = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [users,     setUsers]     = useState<User[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [search,    setSearch]    = useState('');
  const [error,     setError]     = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

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

  const doAction = async (tgId: string, action: 'block' | 'unblock') => {
    setActioning(tgId);
    try {
      const r = await fetch(`/api/admin-users?secret=${encodeURIComponent(secret)}&action=${action}&tgId=${tgId}`);
      if (r.ok) {
        setUsers(prev => prev.map(u => u.tgId !== tgId ? u : action === 'block'
          ? { ...u, blocked: true,  blockedReason: 'manual', blockedAt: new Date().toISOString() }
          : { ...u, blocked: false, blockedReason: null, blockedAt: null }
        ));
      }
    } finally { setActioning(null); }
  };

  const visible = users.filter(u => {
    if (filter === 'blocked'    && !u.blocked)              return false;
    if (filter === 'suspicious' && !u.suspicious && !u.blocked) return false;
    if (search && !u.tgId.includes(search))                 return false;
    return true;
  });

  const blocked    = users.filter(u => u.blocked).length;
  const suspicious = users.filter(u => u.suspicious && !u.blocked).length;
  const withMicro  = users.filter(u => u.hasMicro).length;

  // ── Логин ────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, padding: '40px 48px', width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36 }}>🦷</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 8 }}>OrthoByNekruz</div>
          <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Admin Panel</div>
        </div>
        <form onSubmit={e => { e.preventDefault(); fetchUsers(secret); }}>
          <input type="password" placeholder="ADMIN_SECRET" value={secret}
            onChange={e => setSecret(e.target.value)} style={S.input} />
          {error && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading || !secret} style={{
            ...S.btn('#2563eb', '#fff', '#1d4ed8'),
            width: '100%', marginTop: 16, padding: '12px', fontSize: 15,
            opacity: loading || !secret ? 0.5 : 1,
          }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Панель ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize: 24 }}>🦷</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>OrthoByNekruz</div>
          <div style={{ color: '#555', fontSize: 12 }}>Admin Panel</div>
        </div>
        <button onClick={() => fetchUsers(secret)} style={{ ...S.btn('#222', '#aaa', '#333'), marginLeft: 'auto' }}>
          ↻ Обновить
        </button>
      </div>

      <div style={S.body}>
        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Всего пользователей', value: users.length, color: '#60a5fa' },
            { label: 'Заблокировано',       value: blocked,      color: '#f87171' },
            { label: 'Подозрительных',      value: suspicious,   color: '#fbbf24' },
            { label: 'Есть Micro-доступ',   value: withMicro,    color: '#34d399' },
          ].map(s => (
            <div key={s.label} style={{ ...S.card, padding: '16px 20px' }}>
              <div style={{ color: s.color, fontSize: 30, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Фильтры */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          {(['all', 'blocked', 'suspicious'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              ...S.btn(
                filter === f ? '#1d3a6a' : '#1a1a1a',
                filter === f ? '#93c5fd' : '#666',
                filter === f ? '#3b82f6' : '#2a2a2a',
              ), padding: '8px 16px', fontSize: 13,
            }}>
              {f === 'all' ? `Все (${users.length})` : f === 'blocked' ? `Заблок. (${blocked})` : `Подозрит. (${suspicious})`}
            </button>
          ))}
          <input placeholder="Поиск по ID..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, width: 180, marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }} />
        </div>

        {/* Таблица */}
        <div style={S.card}>
          {/* Шапка таблицы */}
          <div style={{ ...S.grid, borderBottom: '1px solid #2a2a2a', color: '#444', fontSize: 11, textTransform: 'uppercase' as const }}>
            <span>TG ID</span><span>Статус</span><span>Дата</span>
            <span>Откр.</span><span>FP</span><span>Доступ</span>
            <span>Причина блокировки</span><span style={{ textAlign: 'right' }}>Действие</span>
          </div>

          {loading && <div style={{ textAlign: 'center', color: '#444', padding: 60 }}>Загрузка...</div>}
          {!loading && visible.length === 0 && <div style={{ textAlign: 'center', color: '#444', padding: 60 }}>Нет пользователей</div>}

          {visible.map((u, i) => (
            <div key={u.tgId} style={{
              ...S.grid,
              borderBottom: i < visible.length - 1 ? '1px solid #1f1f1f' : 'none',
              background: u.blocked ? 'rgba(239,68,68,0.04)' : u.suspicious ? 'rgba(245,158,11,0.04)' : 'transparent',
            }}>
              {/* TG ID */}
              <span style={{ fontFamily: 'monospace', color: '#7dd3fc', fontSize: 12 }}>{u.tgId}</span>

              {/* Статус */}
              <span>
                {u.blocked    ? <span style={S.badge('#3f1515', '#f87171')}>БЛОК</span>
                : u.suspicious ? <span style={S.badge('#3d2a00', '#fbbf24')}>⚠ ПОДОЗР</span>
                :                <span style={S.badge('#0d2e1e', '#34d399')}>ОК</span>}
              </span>

              {/* Дата */}
              <span style={{ color: '#444', fontSize: 11 }}>{fmtDate(u.registeredAt)}</span>

              {/* Открытий сегодня */}
              <span style={{ color: u.opensToday >= 5 ? '#f87171' : u.opensToday >= 3 ? '#fbbf24' : '#555', fontWeight: 600 }}>
                {u.opensToday}
              </span>

              {/* Fingerprint смен */}
              <span style={{ color: u.fpChanges >= 3 ? '#f87171' : u.fpChanges >= 1 ? '#fbbf24' : '#333' }}>
                {u.fpChanges || '—'}
              </span>

              {/* Доступы */}
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                <span style={S.badge('#1e3a5f', '#7dd3fc')}>ortho</span>
                {u.hasMicro && <span style={S.badge('#14312b', '#6ee7b7')}>micro</span>}
              </span>

              {/* Причина */}
              <span style={{ color: '#444', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {u.blocked ? `${u.blockedReason ?? '—'} · ${fmtDate(u.blockedAt)}` : '—'}
              </span>

              {/* Кнопка */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {u.blocked
                  ? <button onClick={() => doAction(u.tgId, 'unblock')} disabled={actioning === u.tgId}
                      style={{ ...S.btn('#0d2e1e', '#34d399', '#1a4a30'), opacity: actioning === u.tgId ? 0.5 : 1 }}>
                      {actioning === u.tgId ? '...' : '✓ Разблок'}
                    </button>
                  : <button onClick={() => doAction(u.tgId, 'block')} disabled={actioning === u.tgId}
                      style={{ ...S.btn('#3f1515', '#f87171', '#6b2020'), opacity: actioning === u.tgId ? 0.5 : 1 }}>
                      {actioning === u.tgId ? '...' : '✕ Блок'}
                    </button>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}