"use client";

// pages/admin.tsx
import { useState, useEffect, useCallback } from 'react';

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

// Форматируем дату
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const [secret,   setSecret]   = useState('');
  const [authed,   setAuthed]   = useState(false);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [filter,   setFilter]   = useState<Filter>('all');
  const [search,   setSearch]   = useState('');
  const [error,    setError]    = useState('');
  const [total,    setTotal]    = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchUsers = useCallback(async (s: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin-users?secret=${encodeURIComponent(s)}`);
      if (r.status === 401) { setError('Неверный пароль'); setAuthed(false); return; }
      if (!r.ok) { setError('Ошибка сервера'); return; }
      const data = await r.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setAuthed(true);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(secret);
  };

  const doAction = async (tgId: string, action: 'block' | 'unblock') => {
    setActioning(tgId);
    try {
      const r = await fetch(
        `/api/admin-users?secret=${encodeURIComponent(secret)}&action=${action}&tgId=${tgId}`
      );
      if (r.ok) {
        setUsers(prev => prev.map(u =>
          u.tgId === tgId
            ? action === 'block'
              ? { ...u, blocked: true,  blockedReason: 'manual', blockedAt: new Date().toISOString() }
              : { ...u, blocked: false, blockedReason: null, blockedAt: null }
            : u
        ));
      }
    } finally {
      setActioning(null);
    }
  };

  // Фильтрация
  const visible = users.filter(u => {
    if (filter === 'blocked'    && !u.blocked)    return false;
    if (filter === 'suspicious' && !u.suspicious && !u.blocked) return false;
    if (search && !u.tgId.includes(search))       return false;
    return true;
  });

  const blockedCount    = users.filter(u => u.blocked).length;
  const suspiciousCount = users.filter(u => u.suspicious && !u.blocked).length;

  // ── Экран логина ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f0f0f', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 16, padding: '40px 48px', width: 360,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🦷</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>OrthoByNekruz</div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>Admin Panel</div>
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="ADMIN_SECRET"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                border: '1px solid #333', background: '#111', color: '#fff',
                fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !secret}
              style={{
                width: '100%', marginTop: 16, padding: '12px', borderRadius: 10,
                background: loading ? '#333' : '#2563eb', color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Основная панель ───────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f',
      fontFamily: 'system-ui, sans-serif', color: '#e5e5e5',
    }}>
      {/* Header */}
      <div style={{
        background: '#1a1a1a', borderBottom: '1px solid #2a2a2a',
        padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{ fontSize: 24 }}>🦷</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>OrthoByNekruz</div>
          <div style={{ color: '#666', fontSize: 12 }}>Admin Panel</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchUsers(secret)}
            style={{
              padding: '8px 16px', borderRadius: 8, background: '#222',
              border: '1px solid #333', color: '#aaa', cursor: 'pointer', fontSize: 13,
            }}
          >
            ↻ Обновить
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Статистика */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Всего',          value: total,          color: '#3b82f6' },
            { label: 'Заблокировано',  value: blockedCount,   color: '#ef4444' },
            { label: 'Подозрительных', value: suspiciousCount, color: '#f59e0b' },
            { label: 'С Micro',        value: users.filter(u => u.hasMicro).length, color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ color: s.color, fontSize: 28, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Фильтры + поиск */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          {(['all', 'blocked', 'suspicious'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', border: '1px solid',
                borderColor: filter === f ? '#3b82f6' : '#2a2a2a',
                background:  filter === f ? '#1d3a6a' : '#1a1a1a',
                color:       filter === f ? '#93c5fd' : '#888',
              }}
            >
              {f === 'all' ? `Все (${total})` : f === 'blocked' ? `Заблок. (${blockedCount})` : `Подозрит. (${suspiciousCount})`}
            </button>
          ))}
          <input
            placeholder="Поиск по ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              marginLeft: 'auto', padding: '7px 14px', borderRadius: 8,
              border: '1px solid #2a2a2a', background: '#111', color: '#ddd',
              fontSize: 13, outline: 'none', width: 180,
            }}
          />
        </div>

        {/* Таблица */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 80 }}>Загрузка...</div>
        ) : (
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
            {/* Шапка */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 90px 90px 80px 80px 90px 1fr 130px',
              gap: 8, padding: '12px 20px',
              borderBottom: '1px solid #2a2a2a', color: '#555', fontSize: 12,
            }}>
              <span>Telegram ID</span>
              <span>Статус</span>
              <span>Регистрация</span>
              <span>Открытий</span>
              <span>FP смен</span>
              <span>Доступ</span>
              <span>Заблок. причина</span>
              <span style={{ textAlign: 'right' }}>Действия</span>
            </div>

            {visible.length === 0 && (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>
                Пользователи не найдены
              </div>
            )}

            {visible.map((u, i) => (
              <div
                key={u.tgId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 90px 90px 80px 80px 90px 1fr 130px',
                  gap: 8, padding: '14px 20px', alignItems: 'center', fontSize: 13,
                  borderBottom: i < visible.length - 1 ? '1px solid #222' : 'none',
                  background: u.blocked ? 'rgba(239,68,68,0.05)' : u.suspicious ? 'rgba(245,158,11,0.05)' : 'transparent',
                }}
              >
                {/* ID */}
                <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{u.tgId}</span>

                {/* Статус */}
                <span>
                  {u.blocked ? (
                    <span style={{ background: '#3f1515', color: '#f87171', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                      БЛОК
                    </span>
                  ) : u.suspicious ? (
                    <span style={{ background: '#3d2a00', color: '#fbbf24', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                      ⚠ ПОДОЗР
                    </span>
                  ) : (
                    <span style={{ background: '#0d2e1e', color: '#34d399', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                      ОК
                    </span>
                  )}
                </span>

                {/* Дата */}
                <span style={{ color: '#666', fontSize: 12 }}>{fmtDate(u.registeredAt)}</span>

                {/* Открытий */}
                <span style={{ color: u.opensToday >= 5 ? '#f87171' : u.opensToday >= 3 ? '#fbbf24' : '#aaa' }}>
                  {u.opensToday}
                </span>

                {/* FP смен */}
                <span style={{ color: u.fpChanges >= 3 ? '#f87171' : u.fpChanges >= 1 ? '#fbbf24' : '#555' }}>
                  {u.fpChanges || '—'}
                </span>

                {/* Доступ */}
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{ background: '#1e3a5f', color: '#7dd3fc', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
                    ortho
                  </span>
                  {u.hasMicro && (
                    <span style={{ background: '#14312b', color: '#6ee7b7', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
                      micro
                    </span>
                  )}
                </span>

                {/* Причина блок */}
                <span style={{ color: '#666', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.blocked
                    ? `${u.blockedReason ?? '—'} · ${fmtDate(u.blockedAt)}`
                    : '—'
                  }
                </span>

                {/* Действия */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {u.blocked ? (
                    <button
                      onClick={() => doAction(u.tgId, 'unblock')}
                      disabled={actioning === u.tgId}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        cursor: actioning === u.tgId ? 'default' : 'pointer',
                        background: '#0d2e1e', color: '#34d399',
                        border: '1px solid #1a4a30',
                      }}
                    >
                      {actioning === u.tgId ? '...' : '✓ Разблок'}
                    </button>
                  ) : (
                    <button
                      onClick={() => doAction(u.tgId, 'block')}
                      disabled={actioning === u.tgId}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        cursor: actioning === u.tgId ? 'default' : 'pointer',
                        background: '#3f1515', color: '#f87171',
                        border: '1px solid #6b2020',
                      }}
                    >
                      {actioning === u.tgId ? '...' : '✕ Блок'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}