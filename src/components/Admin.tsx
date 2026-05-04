"use client";

import { useState, useCallback, useMemo } from 'react';

interface User {
  tgId:          string;
  username:      string | null;
  firstName:     string | null;
  lastName:      string | null;
  blocked:       boolean;
  blockedReason: string | null;
  blockedAt:     string | null;
  hasMicro:      boolean;
  usedDemo:      boolean;
  activatedKey:  string | null;
  registeredAt:  string | null;
  opensToday:    number;
  fpChanges:     number;
  suspicious:    boolean;
}

type Filter = 'all' | 'blocked' | 'suspicious' | 'demo';
type Action = 'block' | 'unblock' | 'give_micro' | 'revoke_micro' | 'reset_demo';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function displayName(u: User): string {
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ');
  if (parts) return parts;
  if (u.username) return `@${u.username}`;
  return u.tgId;
}

// ── Кнопка действия ───────────────────────────────────────────────────────────
function ActionBtn({
  onClick, disabled, children, color,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  color: 'red' | 'green' | 'blue' | 'yellow' | 'gray';
}) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    red:    { bg: '#3f1515', text: '#f87171', border: '#6b2020' },
    green:  { bg: '#0d2e1e', text: '#34d399', border: '#1a4a30' },
    blue:   { bg: '#1a3060', text: '#93c5fd', border: '#2a4a8a' },
    yellow: { bg: '#3d2a00', text: '#fbbf24', border: '#5a3d00' },
    gray:   { bg: '#222',    text: '#888',    border: '#333'    },
  };
  const p = palette[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#1a1a1a' : p.bg,
        color: disabled ? '#444' : p.text,
        border: `1px solid ${disabled ? '#2a2a2a' : p.border}`,
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
        opacity: disabled ? 0.5 : 1,
        minHeight: 36,
        flex: '0 0 auto',
      }}
    >
      {children}
    </button>
  );
}

// ── Карточка пользователя ─────────────────────────────────────────────────────
function UserCard({
  user,
  actioning,
  onAction,
}: {
  user: User;
  actioning: string | null;
  onAction: (tgId: string, action: Action) => void;
}) {
  const busy = actioning === user.tgId;
  const name = displayName(user);
  const isDemo = user.activatedKey === 'trial' || (!user.activatedKey && user.usedDemo);

  const borderColor = user.blocked
    ? 'rgba(239,68,68,0.35)'
    : user.suspicious
    ? 'rgba(245,158,11,0.3)'
    : '#252525';

  const bgColor = user.blocked
    ? 'rgba(239,68,68,0.06)'
    : user.suspicious
    ? 'rgba(245,158,11,0.04)'
    : '#1a1a1a';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* ── Строка 1: имя + статус ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#e5e5e5',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name !== user.tgId && name}
          </div>
          <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace', marginTop: 1 }}>
            {user.tgId}
            {user.username && name !== `@${user.username}` && (
              <span style={{ color: '#444', marginLeft: 6 }}>@{user.username}</span>
            )}
          </div>
        </div>

        {/* Статус-бейдж */}
        <div>
          {user.blocked ? (
            <span style={{ background: '#3f1515', color: '#f87171', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
              🚫 БЛОК
            </span>
          ) : user.suspicious ? (
            <span style={{ background: '#3d2a00', color: '#fbbf24', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
              ⚠ ПОДОЗР
            </span>
          ) : (
            <span style={{ background: '#0d2e1e', color: '#34d399', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
              ✓ ОК
            </span>
          )}
        </div>
      </div>

      {/* ── Строка 2: чипы доступа ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {/* Ортопедия */}
        {user.activatedKey && user.activatedKey !== 'trial' ? (
          <span style={{ background: '#1e3a5f', color: '#7dd3fc', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
            🦷 ортопедия
          </span>
        ) : isDemo ? (
          <span style={{ background: '#2a1f00', color: '#f59e0b', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
            🕐 триал
          </span>
        ) : (
          <span style={{ background: '#1f1f1f', color: '#444', borderRadius: 5, padding: '3px 8px', fontSize: 11 }}>
            без ключа
          </span>
        )}

        {/* Микробиология */}
        {user.hasMicro && (
          <span style={{ background: '#14312b', color: '#6ee7b7', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
            🧫 микро
          </span>
        )}

        {/* Демо */}
        {user.usedDemo && (
          <span style={{ background: '#1a1030', color: '#a78bfa', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
            👁 демо исп.
          </span>
        )}
      </div>

      {/* ── Строка 3: мета-инфо ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#555' }}>
        <span>📅 {fmtDate(user.registeredAt)}</span>
        <span style={{ color: user.opensToday >= 5 ? '#f87171' : user.opensToday >= 3 ? '#fbbf24' : '#555' }}>
          👁 {user.opensToday} откр.
        </span>
        {user.fpChanges > 0 && (
          <span style={{ color: user.fpChanges >= 3 ? '#f87171' : '#fbbf24' }}>
            🔁 {user.fpChanges} FP
          </span>
        )}
        {user.blocked && user.blockedAt && (
          <span style={{ color: '#f87171' }}>
            🔒 {fmtDate(user.blockedAt)}
          </span>
        )}
      </div>

      {/* ── Строка 4: кнопки действий ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Блок / Разблок */}
        {user.blocked ? (
          <ActionBtn color="green" disabled={busy} onClick={() => onAction(user.tgId, 'unblock')}>
            {busy ? '...' : '✓ Разблокировать'}
          </ActionBtn>
        ) : (
          <ActionBtn color="red" disabled={busy} onClick={() => onAction(user.tgId, 'block')}>
            {busy ? '...' : '🚫 Заблокировать'}
          </ActionBtn>
        )}

        {/* Micro */}
        {user.hasMicro ? (
          <ActionBtn color="gray" disabled={busy} onClick={() => onAction(user.tgId, 'revoke_micro')}>
            {busy ? '...' : '✕ Откл. микро'}
          </ActionBtn>
        ) : (
          <ActionBtn color="blue" disabled={busy} onClick={() => onAction(user.tgId, 'give_micro')}>
            {busy ? '...' : '+ Дать микро'}
          </ActionBtn>
        )}

        {/* Демо-сброс */}
        {user.usedDemo && (
          <ActionBtn color="yellow" disabled={busy} onClick={() => onAction(user.tgId, 'reset_demo')}>
            {busy ? '...' : '🔄 Дать демо снова'}
          </ActionBtn>
        )}
      </div>
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret,    setSecret]    = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [users,     setUsers]     = useState<User[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [search,    setSearch]    = useState('');
  const [error,     setError]     = useState('');
  const [total,     setTotal]     = useState(0);
  const [demoCount, setDemoCount] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
      setDemoCount(data.demoCount ?? 0);
      setAuthed(true);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secret) fetchUsers(secret);
  };

  const doAction = async (tgId: string, action: Action) => {
    setActioning(tgId);
    try {
      const r = await fetch(
        `/api/admin-users?secret=${encodeURIComponent(secret)}&action=${action}&tgId=${tgId}`
      );
      if (!r.ok) { showToast('Ошибка действия'); return; }

      // Оптимистичное обновление стейта
      setUsers(prev => prev.map(u => {
        if (u.tgId !== tgId) return u;
        switch (action) {
          case 'block':
            return { ...u, blocked: true, blockedReason: 'manual', blockedAt: new Date().toISOString() };
          case 'unblock':
            return { ...u, blocked: false, blockedReason: null, blockedAt: null, opensToday: 0, suspicious: u.fpChanges >= 2 };
          case 'give_micro':
            return { ...u, hasMicro: true };
          case 'revoke_micro':
            return { ...u, hasMicro: false };
          case 'reset_demo':
            return { ...u, usedDemo: false };
          default:
            return u;
        }
      }));

      // Обновляем счётчик демо
      if (action === 'reset_demo') {
        setDemoCount(c => Math.max(0, c - 1));
        showToast('✓ Демо-доступ выдан повторно');
      } else if (action === 'block') {
        showToast('🚫 Пользователь заблокирован');
      } else if (action === 'unblock') {
        showToast('✓ Пользователь разблокирован');
      } else if (action === 'give_micro') {
        showToast('✓ Микро-доступ выдан');
      } else if (action === 'revoke_micro') {
        showToast('Микро-доступ отозван');
      }
    } finally {
      setActioning(null);
    }
  };

  const blockedCount    = useMemo(() => users.filter(u => u.blocked).length, [users]);
  const suspiciousCount = useMemo(() => users.filter(u => u.suspicious && !u.blocked).length, [users]);
  const microCount      = useMemo(() => users.filter(u => u.hasMicro).length, [users]);

  const visible = useMemo(() => {
    return users.filter(u => {
      if (filter === 'blocked'    && !u.blocked)                   return false;
      if (filter === 'suspicious' && !u.suspicious && !u.blocked)  return false;
      if (filter === 'demo'       && !u.usedDemo)                  return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const hay = [u.tgId, u.username, u.firstName, u.lastName]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, filter, search]);

  // ── Экран входа ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0a',
        fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif",
        padding: '20px',
      }}>
        <div style={{
          background: '#141414', border: '1px solid #252525',
          borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 360,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🦷</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>
              OrthoByNekruz
            </div>
            <div style={{ color: '#444', fontSize: 13, marginTop: 4 }}>Admin Panel</div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Введите ADMIN_SECRET"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              autoComplete="current-password"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1px solid #2a2a2a', background: '#0f0f0f', color: '#fff',
                fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px',
                color: '#f87171', fontSize: 14, textAlign: 'center',
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !secret}
              style={{
                padding: '14px', borderRadius: 12,
                background: loading || !secret ? '#1e1e1e' : '#2563eb',
                color: loading || !secret ? '#444' : '#fff',
                border: 'none', fontSize: 16, fontWeight: 700,
                cursor: loading || !secret ? 'default' : 'pointer',
                minHeight: 48,
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Основная панель ────────────────────────────────────────────────────────
  const TABS: { id: Filter; label: string; count: number; color: string }[] = [
    { id: 'all',        label: 'Все',       count: total,          color: '#3b82f6' },
    { id: 'blocked',    label: '🚫 Блок',  count: blockedCount,   color: '#ef4444' },
    { id: 'suspicious', label: '⚠ Подозр', count: suspiciousCount, color: '#f59e0b' },
    { id: 'demo',       label: '👁 Демо',  count: demoCount,      color: '#a78bfa' },
  ];

  return (
    <div style={{
      minHeight: '100dvh', background: '#0a0a0a',
      fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif",
      color: '#e5e5e5',
    }}>
      {/* Toast уведомление */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', border: '1px solid #333',
          borderRadius: 10, padding: '10px 20px',
          color: '#e5e5e5', fontSize: 14, fontWeight: 500,
          zIndex: 1000, whiteSpace: 'nowrap',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Шапка ────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#111', borderBottom: '1px solid #1e1e1e',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 22 }}>🦷</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>OrthoByNekruz</div>
          <div style={{ color: '#444', fontSize: 11 }}>Admin Panel</div>
        </div>
        <button
          onClick={() => fetchUsers(secret)}
          disabled={loading}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            color: loading ? '#444' : '#888', cursor: loading ? 'default' : 'pointer',
            fontSize: 13, minHeight: 36,
          }}
        >
          {loading ? '⏳' : '↻ Обновить'}
        </button>
      </div>

      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>

        {/* ── Плитки статистики ─────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginBottom: 16,
        }}>
          {[
            { label: 'Пользователей', value: total,          color: '#3b82f6', icon: '👤' },
            { label: 'Заблокировано', value: blockedCount,   color: '#ef4444', icon: '🚫' },
            { label: 'Подозрительных', value: suspiciousCount, color: '#f59e0b', icon: '⚠️' },
            { label: 'С Микро',        value: microCount,    color: '#10b981', icon: '🧫' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#141414', border: '1px solid #1e1e1e',
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div>
                <div style={{ color: s.color, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ color: '#444', fontSize: 11, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Демо-баннер отдельно, чтобы выделить */}
        <div style={{
          background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 12, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        }}>
          <div style={{ fontSize: 22 }}>👁</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#a78bfa', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {demoCount}
            </div>
            <div style={{ color: '#6d5aad', fontSize: 11, marginTop: 3 }}>
              использовали демо-доступ (можно выдать повторно)
            </div>
          </div>
          <button
            onClick={() => setFilter('demo')}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: filter === 'demo' ? 'rgba(167,139,250,0.2)' : '#1a1a1a',
              border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', cursor: 'pointer',
            }}
          >
            Смотреть
          </button>
        </div>

        {/* ── Вкладки-фильтры ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12,
          overflowX: 'auto', paddingBottom: 4,
          // скрываем скроллбар визуально
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto',
                border: '1px solid',
                borderColor: filter === tab.id ? tab.color : '#222',
                background:  filter === tab.id ? `rgba(${hexToRgb(tab.color)},0.15)` : '#141414',
                color:       filter === tab.id ? tab.color : '#555',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: 6, background: filter === tab.id
                    ? `rgba(${hexToRgb(tab.color)},0.3)` : '#222',
                  borderRadius: 10, padding: '1px 6px', fontSize: 11,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Поиск ─────────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#444', fontSize: 16, pointerEvents: 'none',
          }}>🔍</span>
          <input
            placeholder="Поиск по ID, имени, @username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px 11px 36px',
              borderRadius: 10, border: '1px solid #1e1e1e',
              background: '#111', color: '#ddd',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#555',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* ── Список пользователей ──────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#333', padding: '60px 0', fontSize: 15 }}>
            Загрузка...
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#333', padding: '60px 0',
            fontSize: 15, background: '#141414', borderRadius: 14,
            border: '1px solid #1e1e1e',
          }}>
            {search ? 'Ничего не найдено' : 'Нет пользователей'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#333', fontSize: 12, marginBottom: 2 }}>
              Показано: {visible.length} из {total}
            </div>
            {visible.map(u => (
              <UserCard
                key={u.tgId}
                user={u}
                actioning={actioning}
                onAction={doAction}
              />
            ))}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// Вспомогательная утилита для прозрачных цветов в inline-стилях
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}