"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Script from 'next/script';

interface User {
  tgId:          string;
  username:      string | null;
  firstName:     string | null;
  lastName:      string | null;
  blocked:       boolean;
  blockedReason: string | null;
  blockedAt:     string | null;
  subjects:      string[];
  hasMicro:      boolean;
  usedDemo:      boolean;
  activatedKey:  string | null;
  registeredAt:  string | null;
  opensToday:    number;
  fpChanges:     number;
  suspicious:    boolean;
  navHidden:     Record<string, string[]>;
}

interface SubjectInfo {
  id:         string;
  label:      string;
  shortLabel: string;
  color:      string;
}

interface RateBlock {
  tgId: string;
  ttl:  number;
}

type Filter = 'all' | 'blocked' | 'suspicious' | 'demo';
type Action = 'block' | 'unblock' | 'reset_demo' | 'toggle_subject' | 'toggle_section' | 'delete_user';

// Управляемые из админки разделы. Сам раздел «Статистика» не выключается
// (там прогресс юзера), но внутри него можно скрыть блок «Проверка готовности».
const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: 'questions', label: 'Вопросы'            },
  { id: 'tests',     label: 'Тесты'              },
  { id: 'tasks',     label: 'Задачи'             },
  { id: 'exam',      label: 'Проверка готовности' },
];

// ── Палитра (Paper) ───────────────────────────────────────────────────────────
const T = {
  bg:          '#F4F1EA',
  surface:     '#FFFFFF',
  surfaceAlt:  '#FAF8F3',
  border:      '#E7E2D6',
  borderStrong:'#D7D1C2',
  text:        '#1F1B14',
  textMuted:   '#6B6558',
  textFaint:   '#9A9485',
  chipBg:      '#F1ECDE',
  accent:      '#1F7A6E',
  accentSoft:  '#E5F1EE',
  danger:      '#B8423A',
  dangerSoft:  '#FBE9E6',
  warn:        '#A0741E',
  warnSoft:    '#F7EED7',
  success:     '#3B7A48',
  successSoft: '#E4EFE3',
  info:        '#3461B5',
  infoSoft:    '#E4ECF8',
  purple:      '#6A4DB4',
  purpleSoft:  '#ECE6F7',
};

const FONT_SANS = '"IBM Plex Sans", -apple-system, "SF Pro Display", system-ui, sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';

// ── Читает initData из Telegram WebApp ────────────────────────────────────────
function getTelegramInitData(): string {
  if (typeof window === 'undefined') return '';
  // @ts-ignore
  return window.Telegram?.WebApp?.initData ?? '';
}

// ── Подключаем Google Fonts (IBM Plex) ────────────────────────────────────────
function useFonts() {
  useEffect(() => {
    const id = 'admin-plex-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap&subset=cyrillic,latin';
    document.head.appendChild(link);
  }, []);
}

// ── Хук: полноэкранный режим TG, подтверждение закрытия, запрет свайпа вниз ──
function useTelegramFullscreen(): number {
  const [topInset, setTopInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.expand?.();
    tg.enableClosingConfirmation?.();
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();

    // Отступ сверху: учитываем системный safe-area + область кнопки закрытия TG
    const safe    = (tg.safeAreaInset?.top          ?? 0) as number;
    const content = (tg.contentSafeAreaInset?.top   ?? 0) as number;
    setTopInset(safe + content);

    return () => {
      tg.disableClosingConfirmation?.();
      if (typeof tg.enableVerticalSwipes === 'function') tg.enableVerticalSwipes();
    };
  }, []);

  return topInset;
}

// ── Хук: снимает блокировку скролла из globals.css ───────────────────────────
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
      bodyBg:          body.style.background,
    };
    html.style.overflow    = 'auto';
    html.style.height      = 'auto';
    html.style.position    = 'static';
    body.style.overflow    = 'auto';
    body.style.height      = 'auto';
    body.style.position    = 'static';
    body.style.touchAction = 'auto';
    body.style.background  = T.bg;
    return () => {
      html.style.overflow    = prev.htmlOverflow;
      html.style.height      = prev.htmlHeight;
      html.style.position    = prev.htmlPosition;
      body.style.overflow    = prev.bodyOverflow;
      body.style.height      = prev.bodyHeight;
      body.style.position    = prev.bodyPosition;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.background  = prev.bodyBg;
    };
  }, []);
}

function fmtTTL(sec: number): string {
  if (sec < 0) return 'истёк';
  if (sec < 60) return `${sec}с`;
  if (sec < 3600) return `${Math.floor(sec / 60)}м`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function displayName(u: User): string {
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ');
  if (parts && u.username) return `${parts} · @${u.username}`;
  if (parts) return parts;
  if (u.username) return `@${u.username}`;
  return 'Без имени';
}

function initials(u: User): string {
  const a = (u.firstName?.[0] || u.username?.[0] || '?').toUpperCase();
  const b = (u.lastName?.[0] || '').toUpperCase();
  return a + b;
}

// ── Чип ───────────────────────────────────────────────────────────────────────
function Chip({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color,
      borderRadius: 6, padding: '2px 7px',
      fontSize: 11, fontWeight: 600, letterSpacing: 0.1,
      flexShrink: 0, lineHeight: 1.4,
    }}>{children}</span>
  );
}

// ── Мета-поле ─────────────────────────────────────────────────────────────────
function Meta({ label, value, color, mono }: {
  label: string; value: string; color?: string; mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        color: T.textFaint, fontSize: 10.5, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        color: color ?? T.text, fontSize: 13, fontWeight: 500,
        fontFamily: mono ? FONT_MONO : FONT_SANS,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</div>
    </div>
  );
}

// ── Кнопка действия ───────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'danger' | 'success' | 'warn' | 'info' | 'neutral';

function ActionBtn({
  onClick, disabled, children, variant = 'neutral', fullWidth,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: BtnVariant;
  fullWidth?: boolean;
}) {
  const variants: Record<BtnVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: T.accent,      fg: '#fff',     border: T.accent },
    danger:  { bg: T.dangerSoft,  fg: T.danger,   border: T.danger + '33' },
    success: { bg: T.successSoft, fg: T.success,  border: T.success + '33' },
    warn:    { bg: T.warnSoft,    fg: T.warn,     border: T.warn + '33' },
    info:    { bg: T.infoSoft,    fg: T.info,     border: T.info + '33' },
    neutral: { bg: T.surface,     fg: T.textMuted,border: T.border },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? T.surfaceAlt : v.bg,
        color: disabled ? T.textFaint : v.fg,
        border: `1px solid ${disabled ? T.border : v.border}`,
        borderRadius: 10, padding: '9px 13px',
        fontSize: 13, fontWeight: 600, letterSpacing: 0.1,
        cursor: disabled ? 'default' : 'pointer',
        flex: fullWidth ? '1 1 0' : '0 0 auto',
        whiteSpace: 'nowrap', minHeight: 38,
        opacity: disabled ? 0.6 : 1,
        fontFamily: FONT_SANS,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

// ── Карточка пользователя ─────────────────────────────────────────────────────
function UserCard({
  user, actioning, onAction, expanded, onToggle, availableSubjects, onCopy,
}: {
  user: User;
  actioning: string | null;
  onAction: (tgId: string, action: Action, subjectId?: string, enabled?: boolean, reason?: string, section?: string) => void;
  expanded: boolean;
  onToggle: () => void;
  availableSubjects: SubjectInfo[];
  onCopy: (text: string, label: string) => void;
}) {
  const busy        = actioning === user.tgId;
  const name        = displayName(user);
  const hasFullKey  = user.activatedKey && user.activatedKey !== 'trial';
  const isTrial     = user.activatedKey === 'trial';

  // «Новенький» — регистрация менее 24 ч назад
  const isFresh = !!user.registeredAt &&
    (Date.now() - Date.parse(user.registeredAt) < 24 * 3600 * 1000);

  const statusColor = user.blocked ? T.danger
    : user.suspicious ? T.warn
    : isFresh ? T.info
    : T.success;
  const avatarBg    = user.blocked ? T.dangerSoft
    : user.suspicious ? T.warnSoft
    : isFresh ? T.infoSoft
    : T.accentSoft;
  const avatarFg    = user.blocked ? T.danger
    : user.suspicious ? T.warn
    : isFresh ? T.info
    : T.accent;

  // Модалка причины блокировки
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Long-press на ID → копировать
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);
  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onCopy(user.tgId, 'ID скопирован');
    }, 550);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const onIdClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // не разворачивать карточку
    if (longPressed.current) {
      longPressed.current = false; // только что был long-press, клик игнорируем
    }
  };

  const tgChatHref = user.username
    ? `https://t.me/${user.username}`
    : `tg://user?id=${user.tgId}`;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${user.blocked ? T.danger + '33' : user.suspicious ? T.warn + '33' : T.border}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: expanded ? `0 6px 20px ${T.text}0F` : 'none',
      position: 'relative',
    }}>
      {/* статус-полоска слева */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: statusColor,
      }} />

      {/* шапка */}
      <div
        onClick={onToggle}
        style={{
          padding: '12px 14px 12px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 11,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: avatarBg, color: avatarFg,
          fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: 0.2,
        }}>{initials(user)}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          }}>
            <div style={{
              fontSize: 14.5, fontWeight: 600, color: T.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }}>{name}</div>
            {user.blocked && <Chip bg={T.dangerSoft} color={T.danger}>blocked</Chip>}
            {!user.blocked && user.suspicious && <Chip bg={T.warnSoft} color={T.warn}>подозр</Chip>}
            {!user.blocked && !user.suspicious && isFresh && <Chip bg={T.infoSoft} color={T.info}>🆕 new</Chip>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span
              onMouseDown={startPress}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={startPress}
              onTouchEnd={cancelPress}
              onTouchCancel={cancelPress}
              onClick={onIdClick}
              title="Удерживай, чтобы скопировать"
              style={{
                fontFamily: FONT_MONO, fontSize: 11,
                color: T.textFaint, letterSpacing: 0.2,
                cursor: 'copy', userSelect: 'none',
                padding: '1px 4px', margin: '-1px -4px',
                borderRadius: 4,
                WebkitTapHighlightColor: 'transparent',
              }}
            >id {user.tgId}</span>
            {hasFullKey && <Chip bg={T.accentSoft} color={T.accent}>ключ</Chip>}
            {isTrial    && <Chip bg={T.warnSoft}   color={T.warn}>trial</Chip>}
            {availableSubjects
              .filter(s => s.id !== 'ortho' && user.subjects.includes(s.id))
              .map(s => (
                <Chip key={s.id} bg={T.successSoft} color={T.success}>{s.shortLabel}</Chip>
              ))}
            {user.usedDemo && <Chip bg={T.purpleSoft} color={T.purple}>демо</Chip>}
            {user.opensToday >= 3 && (
              <Chip
                bg={user.opensToday >= 5 ? T.dangerSoft : T.warnSoft}
                color={user.opensToday >= 5 ? T.danger : T.warn}
              >
                {user.opensToday} откр
              </Chip>
            )}
          </div>
        </div>

        <span style={{
          color: T.textFaint, fontSize: 13, alignSelf: 'center',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          display: 'inline-block', flexShrink: 0,
        }}>▾</span>
      </div>

      {/* раскрытое */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${T.border}`,
          background: T.surfaceAlt,
          padding: '14px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px',
          }}>
            <Meta label="Зарегистрирован" value={fmtDate(user.registeredAt)} mono />
            {user.activatedKey && (
              <Meta label="Ключ"
                value={user.activatedKey === 'trial' ? 'триал' : `···${user.activatedKey.slice(-4)}`}
                mono />
            )}
            <Meta label="Открытий сегодня" value={String(user.opensToday)}
              color={user.opensToday >= 5 ? T.danger : user.opensToday >= 3 ? T.warn : undefined} />
            <Meta label="Смен fingerprint" value={String(user.fpChanges)}
              color={user.fpChanges >= 3 ? T.danger : user.fpChanges >= 1 ? T.warn : undefined} />
            {user.blocked && (
              <Meta label="Заблокирован" value={fmtDate(user.blockedAt)} color={T.danger} />
            )}
            {user.blocked && user.blockedReason && user.blockedReason !== 'manual' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Meta label="Причина блокировки" value={user.blockedReason} color={T.danger} />
              </div>
            )}
          </div>

          {/* доступ к предметам */}
          <div>
            <div style={{
              fontSize: 11, color: T.textMuted, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
            }}>Доступ к предметам</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {availableSubjects.map(s => {
                const enabled = user.subjects.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => onAction(user.tgId, 'toggle_subject', s.id, !enabled)}
                    disabled={busy}
                    style={{
                      padding: '7px 12px', borderRadius: 10,
                      fontSize: 12.5, fontWeight: 600,
                      border: `1px solid ${enabled ? T.success + '55' : T.border}`,
                      background: enabled ? T.successSoft : T.surface,
                      color: enabled ? T.success : T.textMuted,
                      cursor: busy ? 'default' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontFamily: FONT_SANS, opacity: busy ? 0.6 : 1,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 4,
                      background: enabled ? T.success : T.chipBg,
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}>{enabled ? '✓' : ''}</span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* разделы навигации (per-subject, только для доступных предметов) */}
          {user.subjects.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, color: T.textMuted, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
              }}>Разделы навигации</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableSubjects
                  .filter(s => user.subjects.includes(s.id))
                  .map(subj => {
                    const hidden = new Set<string>(user.navHidden?.[subj.id] || []);
                    return (
                      <div key={subj.id} style={{
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: '8px 10px',
                      }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: T.text,
                          marginBottom: 6,
                        }}>{subj.shortLabel}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {NAV_SECTIONS.map(sec => {
                            const enabled = !hidden.has(sec.id);
                            return (
                              <button
                                key={sec.id}
                                onClick={() => onAction(user.tgId, 'toggle_section', subj.id, !enabled, undefined, sec.id)}
                                disabled={busy}
                                style={{
                                  padding: '5px 10px', borderRadius: 8,
                                  fontSize: 12, fontWeight: 600,
                                  border: `1px solid ${enabled ? T.accent + '55' : T.border}`,
                                  background: enabled ? T.accentSoft : T.surfaceAlt,
                                  color: enabled ? T.accent : T.textFaint,
                                  cursor: busy ? 'default' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontFamily: FONT_SANS, opacity: busy ? 0.6 : 1,
                                  textDecoration: enabled ? 'none' : 'line-through',
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              >
                                <span style={{
                                  width: 12, height: 12, borderRadius: 3,
                                  background: enabled ? T.accent : T.chipBg,
                                  color: '#fff', fontSize: 9, fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  lineHeight: 1,
                                }}>{enabled ? '✓' : ''}</span>
                                {sec.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* действия */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {user.blocked ? (
              <ActionBtn variant="success" disabled={busy} fullWidth
                onClick={() => onAction(user.tgId, 'unblock')}>
                {busy ? '...' : 'Разблокировать'}
              </ActionBtn>
            ) : (
              <ActionBtn variant="danger" disabled={busy} fullWidth
                onClick={() => { setBlockReason(''); setBlockOpen(true); }}>
                {busy ? '...' : 'Заблокировать'}
              </ActionBtn>
            )}
            {user.usedDemo && (
              <ActionBtn variant="warn" disabled={busy} fullWidth
                onClick={() => onAction(user.tgId, 'reset_demo')}>
                {busy ? '...' : 'Выдать демо повторно'}
              </ActionBtn>
            )}
            <a
              href={tgChatHref}
              target="_blank"
              rel="noreferrer"
              style={{
                background: T.infoSoft, color: T.info,
                border: `1px solid ${T.info}33`,
                borderRadius: 10, padding: '9px 13px',
                fontSize: 13, fontWeight: 600, letterSpacing: 0.1,
                textDecoration: 'none', minHeight: 38,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                flex: '1 1 0', whiteSpace: 'nowrap',
                fontFamily: FONT_SANS,
                WebkitTapHighlightColor: 'transparent',
              }}
              onClick={e => e.stopPropagation()}
            >
              ✉ {user.username ? `@${user.username}` : 'Написать в TG'}
            </a>
          </div>

          {/* удаление навсегда */}
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            style={{
              marginTop: 8, width: '100%',
              background: 'transparent', color: T.danger,
              border: `1px dashed ${T.danger}66`,
              borderRadius: 10, padding: '9px',
              fontSize: 12.5, fontWeight: 600, letterSpacing: 0.1,
              cursor: busy ? 'default' : 'pointer',
              fontFamily: FONT_SANS, opacity: busy ? 0.5 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            🗑 Удалить пользователя навсегда
          </button>
        </div>
      )}

      {/* ─── Модалка причины блокировки ─── */}
      {blockOpen && (
        <div
          onClick={e => { e.stopPropagation(); setBlockOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(31,27,20,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 18, backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: 18, width: '100%', maxWidth: 380,
              boxShadow: `0 20px 60px ${T.text}30`,
              fontFamily: FONT_SANS,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              Заблокировать пользователя
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
              {name}
            </div>
            <label style={{
              fontSize: 11, fontWeight: 600, color: T.textMuted,
              textTransform: 'uppercase', letterSpacing: 0.5,
              display: 'block', marginBottom: 6,
            }}>Причина (необязательно)</label>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value.slice(0, 200))}
              autoFocus
              placeholder="Например: 2 аккаунта с одной IP / просил вернуть деньги без оснований…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.surfaceAlt, color: T.text,
                fontSize: 14, fontFamily: FONT_SANS,
                outline: 'none', resize: 'none',
              }}
            />
            <div style={{
              fontSize: 11, color: T.textFaint,
              textAlign: 'right', marginTop: 4, marginBottom: 14,
            }}>{blockReason.length}/200</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="neutral" fullWidth onClick={() => setBlockOpen(false)}>
                Отмена
              </ActionBtn>
              <ActionBtn
                variant="danger"
                fullWidth
                disabled={busy}
                onClick={() => {
                  setBlockOpen(false);
                  onAction(user.tgId, 'block', undefined, undefined, blockReason.trim() || undefined);
                }}
              >
                Заблокировать
              </ActionBtn>
            </div>
          </div>
        </div>
      )}

      {/* ─── Модалка подтверждения удаления ─── */}
      {deleteOpen && (
        <div
          onClick={e => { e.stopPropagation(); setDeleteOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(31,27,20,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 18, backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: 18, width: '100%', maxWidth: 380,
              boxShadow: `0 20px 60px ${T.text}30`,
              fontFamily: FONT_SANS,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: T.danger, marginBottom: 4 }}>
              Удалить пользователя навсегда?
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>
              {name}
            </div>
            <div style={{ fontSize: 12.5, color: T.text, marginBottom: 14, lineHeight: 1.5 }}>
              Все данные пользователя будут <b>безвозвратно стёрты</b> из базы:
              доступы, прогресс, история. Карточка исчезнет из админки.
              Действие необратимо.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn variant="neutral" fullWidth onClick={() => setDeleteOpen(false)}>
                Отмена
              </ActionBtn>
              <ActionBtn
                variant="danger"
                fullWidth
                disabled={busy}
                onClick={() => {
                  setDeleteOpen(false);
                  onAction(user.tgId, 'delete_user');
                }}
              >
                Удалить навсегда
              </ActionBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat-плитка ───────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '12px 10px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontSize: 24, fontWeight: 700, color: T.text,
          letterSpacing: -0.5, lineHeight: 1, fontFamily: FONT_SANS,
        }}>{value}</span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: accent,
          display: 'inline-block',
        }} />
      </div>
      <div style={{
        color: T.textMuted, fontSize: 11, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>{label}</div>
    </div>
  );
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function AdminPage() {
  useFonts();
  useAdminScroll();
  const topInset = useTelegramFullscreen();

  const [secret,             setSecret]             = useState('');
  const [authed,             setAuthed]             = useState(false);
  const [users,              setUsers]              = useState<User[]>([]);
  const [availableSubjects,  setAvailableSubjects]  = useState<SubjectInfo[]>([]);
  const [loading,            setLoading]            = useState(false);
  const [filter,             setFilter]             = useState<Filter>('all');
  const [search,             setSearch]             = useState('');
  const [debouncedSearch,    setDebouncedSearch]    = useState('');
  const [error,              setError]              = useState('');
  const [total,              setTotal]              = useState(0);
  const [demoCount,          setDemoCount]          = useState(0);
  const [actioning,          setActioning]          = useState<string | null>(null);
  const [toast,              setToast]              = useState<string | null>(null);
  // expandedIds восстанавливаются из sessionStorage, чтобы после ↻ refresh карточки не схлопывались
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = sessionStorage.getItem('admin_expanded_ids');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Debounce строки поиска (200ms) — не перефильтровывать список на каждый символ
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Сохраняем раскрытые карточки в sessionStorage при каждом изменении
  useEffect(() => {
    try {
      sessionStorage.setItem('admin_expanded_ids', JSON.stringify([...expandedIds]));
    } catch { /* private mode / quota */ }
  }, [expandedIds]);

  // ── Блокировки входа (rate-limit) ─────────────────────────────────────────
  const [rateBlocks,         setRateBlocks]         = useState<RateBlock[]>([]);
  const [rateBlocksLoading,  setRateBlocksLoading]  = useState(false);
  const [rateBlocksExpanded, setRateBlocksExpanded] = useState(false);
  const [clearingTgId,       setClearingTgId]       = useState<string | null>(null);

  // ── Глобальные настройки (демо-кнопка, watermark) ─────────────────────────
  const [isDemoEnabled,      setIsDemoEnabled]      = useState(true);
  const [isDemoLoading,      setIsDemoLoading]      = useState(false);
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState(true);
  const [isWatermarkLoading, setIsWatermarkLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin-config')
      .then(res => res.json())
      .then(data => {
        if (typeof data.isDemoEnabled === 'boolean')      setIsDemoEnabled(data.isDemoEnabled);
        if (typeof data.isWatermarkEnabled === 'boolean') setIsWatermarkEnabled(data.isWatermarkEnabled);
      })
      .catch(err => console.error('Ошибка загрузки конфига:', err));
  }, []);

  const toggleDemoButton = async () => {
    const initData = getTelegramInitData();
    if (!initData) { showToast('Нет доступа: не в Telegram'); return; }

    setIsDemoLoading(true);
    try {
      const newValue = !isDemoEnabled;
      const res = await fetch('/api/admin-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDemoEnabled: newValue, initData, secret }),
      });
      if (res.ok) {
        setIsDemoEnabled(newValue);
        showToast(newValue ? '✓ Демо-кнопка включена для всех' : 'Демо-кнопка скрыта');
      } else if (res.status === 403) {
        showToast('Нет прав');
      } else {
        showToast('Ошибка при переключении');
      }
    } catch (error) {
      showToast('Ошибка сети');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const toggleWatermark = async () => {
    const initData = getTelegramInitData();
    if (!initData) { showToast('Нет доступа: не в Telegram'); return; }

    setIsWatermarkLoading(true);
    try {
      const newValue = !isWatermarkEnabled;
      const res = await fetch('/api/admin-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isWatermarkEnabled: newValue, initData, secret }),
      });
      if (res.ok) {
        setIsWatermarkEnabled(newValue);
        showToast(newValue ? '✓ Водяной знак включён' : 'Водяной знак отключён');
      } else if (res.status === 403) {
        showToast('Нет прав');
      } else {
        showToast('Ошибка при переключении');
      }
    } catch (error) {
      showToast('Ошибка сети');
    } finally {
      setIsWatermarkLoading(false);
    }
  };

  const fetchRateBlocks = useCallback(async () => {
    setRateBlocksLoading(true);
    try {
      const r = await fetch('/api/admin-rate-blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'list', secret }),
      });
      if (r.ok) {
        const data = await r.json();
        setRateBlocks(data.blocks ?? []);
      }
    } catch {
      showToast('Ошибка загрузки блокировок');
    } finally {
      setRateBlocksLoading(false);
    }
  }, [secret]);

  const clearRateBlock = async (tgId: string) => {
    setClearingTgId(tgId);
    try {
      const r = await fetch('/api/admin-rate-blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'clear', tgId, secret }),
      });
      if (r.ok) {
        setRateBlocks(prev => prev.filter(b => b.tgId !== tgId));
        showToast('✓ Блокировка снята');
      } else {
        showToast('Ошибка снятия блокировки');
      }
    } catch {
      showToast('Ошибка сети');
    } finally {
      setClearingTgId(null);
    }
  };

  // Копирование в буфер с тостом
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('✓ ' + label);
    } catch {
      // fallback для старых браузеров
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('✓ ' + label); }
      catch { showToast('Не удалось скопировать'); }
      document.body.removeChild(ta);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_secret');
    if (saved) setSecret(saved);
  }, []);

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

  // ── POST: получить список пользователей ───────────────────────────────────
  const fetchUsers = useCallback(async (s: string) => {
    const initData = getTelegramInitData();
    if (!initData) { setError('Вход только через Telegram Mini App'); return; }

    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin-users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret: s, initData }),
      });

      if (r.status === 403 || r.status === 401) {
        setError('Нет доступа: неверный пароль или Telegram ID');
        setAuthed(false);
        return;
      }
      if (!r.ok) { setError('Ошибка сервера'); return; }

      const data = await r.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setDemoCount(data.demoCount ?? 0);
      setAvailableSubjects(data.availableSubjects ?? []);

      sessionStorage.setItem('admin_secret', s);
      setAuthed(true);

      // Параллельно грузим блокировки входа
      fetch('/api/admin-rate-blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'list', secret: s }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setRateBlocks(data.blocks ?? []); })
        .catch(() => {});
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;

    const initData = getTelegramInitData();
    if (!initData) {
      setError('Откройте панель через Telegram — вход из браузера заблокирован');
      return;
    }
    fetchUsers(secret);
  };

  // ── POST: действие над пользователем ──────────────────────────────────────
  const doAction = async (
    tgId: string,
    action: Action,
    subjectId?: string,
    enabled?: boolean,
    reason?: string,
    section?: string,
  ) => {
    const initData = getTelegramInitData();
    if (!initData) { showToast('Нет доступа: не в Telegram'); return; }

    setActioning(tgId);
    try {
      const body: Record<string, unknown> = { secret, initData, action, tgId };
      if (action === 'toggle_subject' && subjectId !== undefined) {
        body.subject = subjectId;
        body.enable  = enabled;
      }
      if (action === 'toggle_section' && subjectId !== undefined && section !== undefined) {
        body.subject = subjectId;
        body.section = section;
        body.enable  = enabled;
      }
      if (action === 'block' && reason) {
        body.reason = reason;
      }

      const r = await fetch('/api/admin-users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!r.ok) { showToast('Ошибка действия'); return; }

      // Удаление — убираем пользователя из списка целиком
      if (action === 'delete_user') {
        setUsers(prev => prev.filter(u => u.tgId !== tgId));
        setTotal(t => Math.max(0, t - 1));
        showToast('🗑 Пользователь удалён');
        return;
      }

      setUsers(prev => prev.map(u => {
        if (u.tgId !== tgId) return u;
        switch (action) {
          case 'block':
            return { ...u, blocked: true, blockedReason: reason || 'manual', blockedAt: new Date().toISOString() };
          case 'unblock':
            return { ...u, blocked: false, blockedReason: null, blockedAt: null, opensToday: 0, suspicious: u.fpChanges >= 2 };
          case 'reset_demo':
            return { ...u, usedDemo: false };
          case 'toggle_subject': {
            if (!subjectId) return u;
            const newSubjects = enabled
              ? Array.from(new Set([...u.subjects, subjectId]))
              : u.subjects.filter(s => s !== subjectId);
            return { ...u, subjects: newSubjects, hasMicro: newSubjects.includes('micro') };
          }
          case 'toggle_section': {
            if (!subjectId || !section) return u;
            const navHidden = { ...(u.navHidden || {}) };
            const set = new Set<string>(navHidden[subjectId] || []);
            if (enabled) set.delete(section); else set.add(section);
            if (set.size === 0) delete navHidden[subjectId];
            else navHidden[subjectId] = [...set];
            return { ...u, navHidden };
          }
          default:
            return u;
        }
      }));

      if (action === 'reset_demo') setDemoCount(c => Math.max(0, c - 1));

      let msg = '';
      switch (action) {
        case 'block':          msg = '🚫 Заблокирован'; break;
        case 'unblock':        msg = '✓ Разблокирован'; break;
        case 'reset_demo':     msg = '✓ Демо выдан повторно'; break;
        case 'toggle_subject': {
          const subj  = availableSubjects.find(s => s.id === subjectId);
          const label = subj?.shortLabel || subjectId;
          msg = enabled ? `✓ ${label} выдано` : `${label} отозвано`;
          break;
        }
        case 'toggle_section': {
          const sectionLabel = NAV_SECTIONS.find(s => s.id === section)?.label || section;
          const subj  = availableSubjects.find(s => s.id === subjectId);
          const subjLabel = subj?.shortLabel || subjectId;
          msg = enabled ? `✓ «${sectionLabel}» включён в ${subjLabel}` : `«${sectionLabel}» скрыт в ${subjLabel}`;
          break;
        }
      }
      if (msg) showToast(msg);
    } finally {
      setActioning(null);
    }
  };

  const blockedCount    = useMemo(() => users.filter(u => u.blocked).length, [users]);
  const suspiciousCount = useMemo(() => users.filter(u => u.suspicious && !u.blocked).length, [users]);
  const microCount      = useMemo(() => users.filter(u => u.subjects.some(s => s !== 'ortho')).length, [users]);

  const visible = useMemo(() => {
    const filtered = users.filter(u => {
      if (filter === 'blocked'    && !u.blocked)                  return false;
      if (filter === 'suspicious' && !u.suspicious && !u.blocked) return false;
      if (filter === 'demo'       && !u.usedDemo)                 return false;
      const q = debouncedSearch.trim().toLowerCase();
      if (q) {
        const hay = [u.tgId, u.username, u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Новые регистрации — сверху. Без даты — в конец.
    return [...filtered].sort((a, b) => {
      const ta = a.registeredAt ? Date.parse(a.registeredAt) : 0;
      const tb = b.registeredAt ? Date.parse(b.registeredAt) : 0;
      return tb - ta;
    });
  }, [users, filter, debouncedSearch]);

  // ─── ЭКРАН ВХОДА ───────────────────────────────────────────────────────────
  const loginScreen = (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg, padding: '20px',
      fontFamily: FONT_SANS, color: T.text,
    }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: '32px 24px 26px', width: '100%', maxWidth: 360,
        boxShadow: `0 4px 20px ${T.text}08`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: -0.5,
          }}>O</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>OrthoByNekruz</div>
            <div style={{
              fontSize: 11, color: T.textMuted, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}>Admin panel</div>
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{
              fontSize: 11, color: T.textMuted, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7,
            }}>Секретный ключ</div>
            <input
              type="password" placeholder="ADMIN_SECRET"
              value={secret} onChange={e => setSecret(e.target.value)}
              autoComplete="current-password"
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 12,
                border: `1px solid ${error ? T.danger + '66' : T.borderStrong}`,
                background: T.surfaceAlt, color: T.text,
                fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1.5,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: T.dangerSoft, border: `1px solid ${T.danger}33`,
              borderRadius: 10, padding: '10px 13px',
              color: T.danger, fontSize: 13, lineHeight: 1.4,
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading || !secret}
            style={{
              padding: '14px', borderRadius: 12,
              background: loading || !secret ? T.surfaceAlt : T.accent,
              color: loading || !secret ? T.textFaint : '#fff',
              border: `1px solid ${loading || !secret ? T.border : T.accent}`,
              fontSize: 15, fontWeight: 700, letterSpacing: 0.2,
              cursor: loading || !secret ? 'default' : 'pointer',
              minHeight: 50, fontFamily: FONT_SANS,
            }}
          >
            {loading ? '...' : 'Войти в панель'}
          </button>

          <div style={{
            marginTop: 4, padding: '11px 13px',
            background: T.infoSoft, borderRadius: 10,
            display: 'flex', gap: 9, alignItems: 'flex-start',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: '50%', background: T.info, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0, lineHeight: 1,
            }}>i</span>
            <div style={{ fontSize: 12, color: T.info, lineHeight: 1.45 }}>
              Вход только из Telegram Mini App. Браузер заблокирован.
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  // ─── ОСНОВНАЯ ПАНЕЛЬ ───────────────────────────────────────────────────────
  const mainPanel = (
    <div style={{
      height: '100svh',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: T.bg, fontFamily: FONT_SANS, color: T.text,
    }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: T.text, border: 'none',
          borderRadius: 12, padding: '11px 22px',
          color: '#fff', fontSize: 14, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>{toast}</div>
      )}

      {/* шапка */}
      <div style={{
        padding: `${12 + topInset}px 16px 12px`,
        display: 'flex', alignItems: 'center', gap: 11,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 15,
        }}>O</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, letterSpacing: -0.2 }}>
            Пользователи
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
            <span style={{ color: T.text, fontWeight: 600 }}>{visible.length}</span> из {total}
          </div>
        </div>
        <button
          onClick={() => fetchUsers(secret)} disabled={loading}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: T.surfaceAlt, border: `1px solid ${T.border}`,
            color: loading ? T.textFaint : T.textMuted,
            fontSize: 16, cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{loading ? '⏳' : '↻'}</button>
      </div>

      <div style={{
        padding: '14px 14px 80px', maxWidth: 680, margin: '0 auto',
        width: '100%', boxSizing: 'border-box',
        flex: 1, overflowY: 'auto',
      }}>

        {/* демо-вход */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: '13px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: T.purpleSoft,
            color: T.purple, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>D</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 2 }}>
              Демо-вход
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.4 }}>
              {isDemoEnabled ? 'Кнопка отображается на экране входа' : 'Кнопка полностью скрыта'}
            </div>
          </div>
          <button
            onClick={toggleDemoButton}
            disabled={isDemoLoading}
            aria-label="Toggle demo"
            style={{
              width: 44, height: 26, borderRadius: 999,
              background: isDemoEnabled ? T.accent : T.borderStrong,
              border: 'none', position: 'relative', flexShrink: 0,
              cursor: isDemoLoading ? 'default' : 'pointer',
              padding: 0, transition: 'background 0.15s',
              opacity: isDemoLoading ? 0.6 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: isDemoEnabled ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.15s',
            }} />
          </button>
        </div>

        {/* водяной знак */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: '13px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: T.infoSoft,
            color: T.info, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>W</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 2 }}>
              Водяной знак
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.4 }}>
              {isWatermarkEnabled
                ? 'tgId юзера наложен на все экраны (защита от скриншотов)'
                : 'Водяной знак отключён для всех'}
            </div>
          </div>
          <button
            onClick={toggleWatermark}
            disabled={isWatermarkLoading}
            aria-label="Toggle watermark"
            style={{
              width: 44, height: 26, borderRadius: 999,
              background: isWatermarkEnabled ? T.accent : T.borderStrong,
              border: 'none', position: 'relative', flexShrink: 0,
              cursor: isWatermarkLoading ? 'default' : 'pointer',
              padding: 0, transition: 'background 0.15s',
              opacity: isWatermarkLoading ? 0.6 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: isWatermarkEnabled ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.15s',
            }} />
          </button>
        </div>

        {/* блокировки входа */}
        <div style={{
          background: T.surface, border: `1px solid ${rateBlocks.length > 0 ? T.danger + '44' : T.border}`,
          borderRadius: 14, marginBottom: 14, overflow: 'hidden',
        }}>
          <div
            onClick={() => {
              if (!rateBlocksExpanded && rateBlocks.length === 0) fetchRateBlocks();
              setRateBlocksExpanded(v => !v);
            }}
            style={{
              padding: '13px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: rateBlocks.length > 0 ? T.dangerSoft : T.surfaceAlt,
              color: rateBlocks.length > 0 ? T.danger : T.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}>🔒</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 2 }}>
                Блокировки входа
                {rateBlocks.length > 0 && (
                  <span style={{
                    marginLeft: 8, background: T.dangerSoft, color: T.danger,
                    borderRadius: 6, padding: '1px 7px', fontSize: 12, fontWeight: 700,
                  }}>{rateBlocks.length}</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.4 }}>
                {rateBlocks.length === 0
                  ? 'Нет активных блокировок по ключу'
                  : `${rateBlocks.length} студент${rateBlocks.length === 1 ? '' : rateBlocks.length < 5 ? 'а' : 'ов'} заблокирован${rateBlocks.length === 1 ? '' : 'о'} после ошибок ввода`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={e => { e.stopPropagation(); fetchRateBlocks(); }}
                disabled={rateBlocksLoading}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: T.surfaceAlt, border: `1px solid ${T.border}`,
                  color: rateBlocksLoading ? T.textFaint : T.textMuted,
                  fontSize: 14, cursor: rateBlocksLoading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >{rateBlocksLoading ? '⏳' : '↻'}</button>
              <span style={{
                color: T.textFaint, fontSize: 13,
                transform: rateBlocksExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s', display: 'inline-block',
              }}>▾</span>
            </div>
          </div>

          {rateBlocksExpanded && (
            <div style={{ borderTop: `1px solid ${T.border}`, background: T.surfaceAlt }}>
              {rateBlocksLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: T.textFaint, fontSize: 13 }}>
                  Загрузка...
                </div>
              ) : rateBlocks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  Нет активных блокировок
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {rateBlocks.map((b, i) => {
                    const knownUser = users.find(u => u.tgId === b.tgId);
                    const busy = clearingTgId === b.tgId;
                    return (
                      <div key={b.tgId} style={{
                        padding: '10px 14px',
                        borderTop: i === 0 ? 'none' : `1px solid ${T.border}`,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: T.text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {knownUser ? displayName(knownUser) : (
                              <span style={{ fontFamily: FONT_MONO, color: T.textMuted }}>id {b.tgId}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            {knownUser && (
                              <span style={{
                                fontFamily: FONT_MONO, fontSize: 10.5, color: T.textFaint,
                              }}>id {b.tgId}</span>
                            )}
                            <span style={{
                              background: T.dangerSoft, color: T.danger,
                              borderRadius: 5, padding: '1px 6px',
                              fontSize: 11, fontWeight: 600,
                            }}>ещё {fmtTTL(b.ttl)}</span>
                          </div>
                        </div>
                        <ActionBtn
                          variant="success"
                          disabled={busy}
                          onClick={() => clearRateBlock(b.tgId)}
                        >
                          {busy ? '...' : 'Снять'}
                        </ActionBtn>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* stat-плитки */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14,
        }}>
          <StatTile label="Всего"   value={total}           accent={T.info} />
          <StatTile label="Блок"    value={blockedCount}    accent={T.danger} />
          <StatTile label="Подозр"  value={suspiciousCount} accent={T.warn} />
          <StatTile label="Микро"   value={microCount}      accent={T.success} />
        </div>

        {/* демо-баннер */}
        <div
          onClick={() => setFilter('demo')}
          style={{
            background: filter === 'demo' ? T.purpleSoft : T.purpleSoft + '88',
            border: `1px solid ${filter === 'demo' ? T.purple + '55' : T.purple + '22'}`,
            borderRadius: 12, padding: '11px 13px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 14, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ color: T.purple, fontWeight: 700, fontSize: 15 }}>{demoCount}</span>
            <span style={{ color: T.purple, opacity: 0.75, fontSize: 12.5, marginLeft: 6 }}>
              использовали демо-доступ
            </span>
          </div>
          <span style={{ color: T.purple, fontSize: 12, fontWeight: 600 }}>
            {filter === 'demo' ? '✓ активен' : 'фильтр →'}
          </span>
        </div>

        {/* pill-фильтры */}
        <div style={{
          display: 'flex', gap: 7, marginBottom: 12,
          overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        } as React.CSSProperties}>
          {[
            { id: 'all' as Filter,        label: 'Все',        count: total,           accent: T.accent  },
            { id: 'blocked' as Filter,    label: 'Блок',       count: blockedCount,    accent: T.danger  },
            { id: 'suspicious' as Filter, label: 'Подозрит.',  count: suspiciousCount, accent: T.warn    },
            { id: 'demo' as Filter,       label: 'Демо',       count: demoCount,       accent: T.purple  },
          ].map(tab => {
            const active = filter === tab.id;
            return (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
                padding: '7px 13px', borderRadius: 999,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto',
                border: `1px solid ${active ? tab.accent : T.border}`,
                background: active ? tab.accent : T.surface,
                color: active ? '#fff' : T.textMuted,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: FONT_SANS,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.22)' : T.chipBg,
                    color: active ? '#fff' : T.textMuted,
                    borderRadius: 8, padding: '1px 7px', minWidth: 18, textAlign: 'center',
                  }}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* поиск */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{
            position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
            color: T.textFaint, fontSize: 14, pointerEvents: 'none',
          }}>⌕</span>
          <input
            placeholder="ID, имя или @username"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 34px 11px 34px',
              borderRadius: 11, border: `1px solid ${T.border}`,
              background: T.surface, color: T.text, fontSize: 14, outline: 'none',
              fontFamily: FONT_SANS,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: T.textFaint,
              cursor: 'pointer', fontSize: 20, padding: '4px', lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: T.textFaint, padding: '60px 0' }}>Загрузка...</div>
        ) : visible.length === 0 ? (
          <div style={{
            textAlign: 'center', color: T.textMuted, padding: '50px 0',
            background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
          }}>
            {search ? 'Ничего не найдено' : 'Нет пользователей'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map(u => (
              <UserCard
                key={u.tgId} user={u} actioning={actioning}
                onAction={doAction}
                expanded={expandedIds.has(u.tgId)}
                onToggle={() => toggleExpand(u.tgId)}
                availableSubjects={availableSubjects}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      {!authed ? loginScreen : mainPanel}
    </>
  );
}
