"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';

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

// ── Хук: снимает блокировку скролла из globals.css (нужна для Telegram Mini App) ──
function useAdminScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow:    html.style.overflow,
      htmlHeight:      html.style.height,
      htmlPosition:    html.style.position,
      bodyOverflow:    body.style.overflow,
      bodyHeight:      body.style.height,
      bodyPosition:    body.style.position,
      bodyTouchAction: body.style.touchAction,
    };
    html.style.overflow    = 'auto';
    html.style.height      = 'auto';
    html.style.position    = 'static';
    body.style.overflow    = 'auto';
    body.style.height      = 'auto';
    body.style.position    = 'static';
    body.style.touchAction = 'auto';
    return () => {
      html.style.overflow    = prev.htmlOverflow;
      html.style.height      = prev.htmlHeight;
      html.style.position    = prev.htmlPosition;
      body.style.overflow    = prev.bodyOverflow;
      body.style.height      = prev.bodyHeight;
      body.style.position    = prev.bodyPosition;
      body.style.touchAction = prev.bodyTouchAction;
    };
  }, []);
}

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
  onClick, disabled, children, color, fullWidth,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  color: 'red' | 'green' | 'blue' | 'yellow' | 'gray';
  fullWidth?: boolean;
}) {
  const palette = {
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
        padding: '9px 14px', borderRadius: 9,
        fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#1a1a1a' : p.bg,
        color: disabled ? '#444' : p.text,
        border: `1px solid ${disabled ? '#2a2a2a' : p.border}`,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        minHeight: 38,
        flex: fullWidth ? '1 1 0' : '0 0 auto',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

// ── Карточка пользователя (сворачиваемая) ─────────────────────────────────────
function UserCard({
  user, actioning, onAction, expanded, onToggle,
}: {
  user: User;
  actioning: string | null;
  onAction: (tgId: string, action: Action) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const busy      = actioning === user.tgId;
  const name      = displayName(user);
  const hasFullKey = user.activatedKey && user.activatedKey !== 'trial';
  const isTrial    = user.activatedKey === 'trial';

  return (
    <div style={{
      background: '#161616',
      border: `1px solid ${user.blocked ? 'rgba(239,68,68,0.3)' : user.suspicious ? 'rgba(245,158,11,0.25)' : '#1e1e1e'}`,
      borderRadius: 13, overflow: 'hidden',
    }}>

      {/* Шапка: всегда видна, тап — раскрыть */}
      <div
        onClick={onToggle}
        style={{
          padding: '12px 13px',
          display: 'flex', alignItems: 'center', gap: 9,
          cursor: 'pointer',
          background: user.blocked ? 'rgba(239,68,68,0.05)' : user.suspicious ? 'rgba(245,158,11,0.04)' : 'transparent',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Цветная точка статуса */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: user.blocked ? '#ef4444' : user.suspicious ? '#f59e0b' : '#22c55e',
        }} />

        {/* Имя + ID + чипы */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#ddd',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 3,
          }}>
            {name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: 11, color: '#2e2e2e', fontFamily: 'monospace', flexShrink: 0 }}>
              {user.tgId}
            </span>
            {hasFullKey && <Chip bg="#1a3050" color="#60a5fa">🦷</Chip>}
            {isTrial    && <Chip bg="#2a1f00" color="#d97706">триал</Chip>}
            {user.hasMicro && <Chip bg="#0d2a22" color="#4ade80">🧫</Chip>}
            {user.usedDemo && <Chip bg="#1a1035" color="#8b5cf6">демо</Chip>}
            {user.opensToday >= 3 && (
              <span style={{ fontSize: 10, color: user.opensToday >= 5 ? '#f87171' : '#f59e0b', flexShrink: 0 }}>
                👁{user.opensToday}
              </span>
            )}
          </div>
        </div>

        {/* Стрелка */}
        <span style={{
          color: '#2a2a2a', fontSize: 20, flexShrink: 0, lineHeight: 1,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>⌄</span>
      </div>

      {/* Раскрытое содержимое */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1e1e1e', padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>

          {/* Мета-инфо */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', fontSize: 12 }}>
            <MetaItem label="Зарег." value={fmtDate(user.registeredAt)} />
            <MetaItem label="Открытий"  value={String(user.opensToday)}
              color={user.opensToday >= 5 ? '#f87171' : user.opensToday >= 3 ? '#fbbf24' : undefined} />
            <MetaItem label="FP смен"   value={String(user.fpChanges)}
              color={user.fpChanges >= 3 ? '#f87171' : user.fpChanges >= 1 ? '#fbbf24' : undefined} />
            {user.activatedKey && (
              <MetaItem label="Ключ"
                value={user.activatedKey === 'trial' ? 'триал' : `···${user.activatedKey.slice(-4)}`} />
            )}
            {user.blocked && (
              <MetaItem label="Заблок." value={fmtDate(user.blockedAt)} color="#f87171" />
            )}
          </div>

          {/* Кнопки блок/разблок + микро */}
          <div style={{ display: 'flex', gap: 8 }}>
            {user.blocked ? (
              <ActionBtn color="green" disabled={busy} onClick={() => onAction(user.tgId, 'unblock')} fullWidth>
                {busy ? '...' : '✓ Разблокировать'}
              </ActionBtn>
            ) : (
              <ActionBtn color="red" disabled={busy} onClick={() => onAction(user.tgId, 'block')} fullWidth>
                {busy ? '...' : '🚫 Заблокировать'}
              </ActionBtn>
            )}
            {user.hasMicro ? (
              <ActionBtn color="gray" disabled={busy} onClick={() => onAction(user.tgId, 'revoke_micro')} fullWidth>
                {busy ? '...' : '✕ Откл. микро'}
              </ActionBtn>
            ) : (
              <ActionBtn color="blue" disabled={busy} onClick={() => onAction(user.tgId, 'give_micro')} fullWidth>
                {busy ? '...' : '+ Дать микро'}
              </ActionBtn>
            )}
          </div>

          {/* Кнопка демо */}
          {user.usedDemo && (
            <ActionBtn color="yellow" disabled={busy} onClick={() => onAction(user.tgId, 'reset_demo')}>
              {busy ? '...' : '🔄 Выдать демо повторно'}
            </ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ background: bg, color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
      {children}
    </span>
  );
}

function MetaItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ color: '#333', fontSize: 10 }}>{label}</div>
      <div style={{ color: color ?? '#777', fontWeight: 500, marginTop: 1 }}>{value}</div>
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function AdminPage() {
  useAdminScroll();

  const [secret,      setSecret]      = useState('');
  const [authed,      setAuthed]      = useState(false);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [filter,      setFilter]      = useState<Filter>('all');
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState('');
  const [total,       setTotal]       = useState(0);
  const [demoCount,   setDemoCount]   = useState(0);
  const [actioning,   setActioning]   = useState<string | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleExpand = useCallback((tgId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(tgId) ? next.delete(tgId) : next.add(tgId);
      return next;
    });
  }, []);

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

      setUsers(prev => prev.map(u => {
        if (u.tgId !== tgId) return u;
        switch (action) {
          case 'block':       return { ...u, blocked: true,  blockedReason: 'manual', blockedAt: new Date().toISOString() };
          case 'unblock':     return { ...u, blocked: false, blockedReason: null, blockedAt: null, opensToday: 0, suspicious: u.fpChanges >= 2 };
          case 'give_micro':  return { ...u, hasMicro: true  };
          case 'revoke_micro':return { ...u, hasMicro: false };
          case 'reset_demo':  return { ...u, usedDemo: false };
          default:            return u;
        }
      }));

      if (action === 'reset_demo') setDemoCount(c => Math.max(0, c - 1));

      const msgs: Record<Action, string> = {
        block: '🚫 Заблокирован', unblock: '✓ Разблокирован',
        give_micro: '✓ Микро выдано', revoke_micro: 'Микро отозвано',
        reset_demo: '✓ Демо выдан повторно',
      };
      showToast(msgs[action]);
    } finally {
      setActioning(null);
    }
  };

  const blockedCount    = useMemo(() => users.filter(u => u.blocked).length, [users]);
  const suspiciousCount = useMemo(() => users.filter(u => u.suspicious && !u.blocked).length, [users]);
  const microCount      = useMemo(() => users.filter(u => u.hasMicro).length, [users]);

  const visible = useMemo(() => users.filter(u => {
    if (filter === 'blocked'    && !u.blocked)                  return false;
    if (filter === 'suspicious' && !u.suspicious && !u.blocked) return false;
    if (filter === 'demo'       && !u.usedDemo)                 return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [u.tgId, u.username, u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [users, filter, search]);

  // ── Экран входа ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a', padding: '20px',
        fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
      }}>
        <div style={{
          background: '#141414', border: '1px solid #222',
          borderRadius: 20, padding: '40px 28px', width: '100%', maxWidth: 340,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🦷</div>
            <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, letterSpacing: '-0.4px' }}>
              OrthoByNekruz
            </div>
            <div style={{ color: '#333', fontSize: 12, marginTop: 4 }}>Admin Panel</div>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password" placeholder="ADMIN_SECRET"
              value={secret} onChange={e => setSecret(e.target.value)}
              autoComplete="current-password"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : '#222'}`,
                background: '#0f0f0f', color: '#fff',
                fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '9px 14px',
                color: '#f87171', fontSize: 13, textAlign: 'center',
              }}>
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading || !secret}
              style={{
                padding: '14px', borderRadius: 12, marginTop: 2,
                background: loading || !secret ? '#1a1a1a' : '#2563eb',
                color: loading || !secret ? '#444' : '#fff',
                border: 'none', fontSize: 15, fontWeight: 700,
                cursor: loading || !secret ? 'default' : 'pointer', minHeight: 50,
              }}
            >
              {loading ? '...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Основная панель ────────────────────────────────────────────────────────
  const TABS: { id: Filter; label: string; count: number; color: string }[] = [
    { id: 'all',        label: 'Все',       count: total,           color: '#3b82f6' },
    { id: 'blocked',    label: '🚫 Блок',  count: blockedCount,    color: '#ef4444' },
    { id: 'suspicious', label: '⚠ Подозр', count: suspiciousCount, color: '#f59e0b' },
    { id: 'demo',       label: '👁 Демо',  count: demoCount,       color: '#a78bfa' },
  ];

  return (
    <div style={{
      minHeight: '100svh', background: '#0a0a0a',
      fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
      color: '#e5e5e5',
    }}>

      {/* Toast снизу */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c1c', border: '1px solid #2a2a2a',
          borderRadius: 12, padding: '11px 22px',
          color: '#e5e5e5', fontSize: 14, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Sticky шапка ── */}
      <div style={{
        background: '#101010', borderBottom: '1px solid #1a1a1a',
        padding: '10px 13px',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 20 }}>🦷</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#ddd' }}>OrthoByNekruz</div>
          <div style={{ color: '#2a2a2a', fontSize: 10 }}>Admin Panel</div>
        </div>
        <span style={{ color: '#2a2a2a', fontSize: 12 }}>{visible.length}/{total}</span>
        <button
          onClick={() => fetchUsers(secret)} disabled={loading}
          style={{
            padding: '7px 12px', borderRadius: 8,
            background: '#1a1a1a', border: '1px solid #222',
            color: loading ? '#2a2a2a' : '#555',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 18, minHeight: 36,
          }}
        >
          {loading ? '⏳' : '↻'}
        </button>
      </div>

      <div style={{ padding: '12px 12px 80px', maxWidth: 680, margin: '0 auto' }}>

        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Всего',  value: total,           color: '#3b82f6' },
            { label: 'Блок',   value: blockedCount,    color: '#ef4444' },
            { label: 'Подозр', value: suspiciousCount, color: '#f59e0b' },
            { label: 'Микро',  value: microCount,      color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#141414', border: '1px solid #1a1a1a',
              borderRadius: 10, padding: '10px 6px', textAlign: 'center',
            }}>
              <div style={{ color: s.color, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: '#2e2e2e', fontSize: 10, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Демо-баннер */}
        <div
          onClick={() => setFilter('demo')}
          style={{
            background: filter === 'demo' ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.04)',
            border: `1px solid ${filter === 'demo' ? 'rgba(167,139,250,0.3)' : 'rgba(167,139,250,0.12)'}`,
            borderRadius: 10, padding: '11px 13px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 10, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 17 }}>👁</span>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 15 }}>{demoCount}</span>
            <span style={{ color: '#4a3a7a', fontSize: 12, marginLeft: 6 }}>использовали демо</span>
          </div>
          <span style={{ color: '#4a3a7a', fontSize: 12 }}>
            {filter === 'demo' ? '✓ активен' : 'показать →'}
          </span>
        </div>

        {/* Фильтры */}
        <div style={{
          display: 'flex', gap: 7, marginBottom: 10,
          overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        } as React.CSSProperties}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
              padding: '7px 14px', borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto',
              border: '1px solid',
              borderColor: filter === tab.id ? tab.color : '#1a1a1a',
              background:  filter === tab.id ? `${tab.color}22` : '#141414',
              color:       filter === tab.id ? tab.color : '#3a3a3a',
              WebkitTapHighlightColor: 'transparent',
            }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: 5, borderRadius: 10, padding: '1px 6px', fontSize: 11,
                  background: filter === tab.id ? `${tab.color}33` : '#1a1a1a',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Поиск */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: '#2a2a2a', fontSize: 14, pointerEvents: 'none',
          }}>🔍</span>
          <input
            placeholder="ID, имя, @username..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 34px 10px 32px',
              borderRadius: 10, border: '1px solid #1a1a1a',
              background: '#111', color: '#ccc',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#444',
              cursor: 'pointer', fontSize: 20, padding: '4px',
            }}>×</button>
          )}
        </div>

        {/* Список */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#222', padding: '60px 0' }}>Загрузка...</div>
        ) : visible.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#222', padding: '50px 0',
            background: '#141414', borderRadius: 12, border: '1px solid #1a1a1a',
          }}>
            {search ? 'Ничего не найдено' : 'Нет пользователей'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {visible.map(u => (
              <UserCard
                key={u.tgId} user={u} actioning={actioning}
                onAction={doAction}
                expanded={expandedIds.has(u.tgId)}
                onToggle={() => toggleExpand(u.tgId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}