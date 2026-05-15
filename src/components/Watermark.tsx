"use client";

import React, { useEffect, useState } from 'react';

/**
 * Невидимый водяной знак с tgId юзера.
 *
 * Тайл-паттерн: «id 12345» повторяется по всей странице наклонно. Любой
 * скриншот (включая обрезанный фрагмент) будет содержать идентификатор —
 * его невозможно вырезать, не уничтожив контент. Видимость ~6%, шрифт
 * monospace 13px, наклон −28°. На обычном фоне почти не различимо, но при
 * увеличении скриншота читается чётко.
 *
 * Защита направлена на психологический эффект: если контент окажется в
 * чужом канале/чате, по watermark всегда понятно, кто слил.
 *
 * Не показываем:
 *   - в админке (зачем себе самому)
 *   - до того как известен tgId (initData ещё не пришла)
 */
export const Watermark: React.FC = () => {
  const [tgId, setTgId] = useState<string | null>(null);
  // Глобальный тумблер из админки. По умолчанию включён, пока не пришёл ответ.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/admin-config')
      .then(r => r.json())
      .then(d => {
        if (typeof d.isWatermarkEnabled === 'boolean') setEnabled(d.isWatermarkEnabled);
      })
      .catch(() => { /* недоступен конфиг — оставляем watermark включённым */ });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Пробуем получить ID из нескольких источников
    const tryGetId = () => {
      const fromTg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const fromLs = localStorage.getItem('user_tg_id');
      const id = fromTg || fromLs;
      if (id) {
        setTgId(String(id));
        return true;
      }
      return false;
    };

    if (tryGetId()) return;
    // initData может прийти не сразу — пуллим первые 5 секунд
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      if (tryGetId() || attempts >= 50) clearInterval(iv);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  if (!enabled) return null;
  if (!tgId) return null;

  // SVG-тайл с двумя строками: на скриншоте видно при увеличении.
  // encodeURIComponent — важно: иначе #/&/+ ломают data: URL.
  const tag = `id ${tgId}`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='180'>` +
    `<g transform='rotate(-28 140 90)' font-family='ui-monospace, Menlo, monospace' font-size='13' fill='white' fill-opacity='0.06'>` +
    `<text x='-20' y='40'>${tag}</text>` +
    `<text x='-20' y='130'>${tag}</text>` +
    `</g>` +
    `</svg>`;
  const dataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',     // клики/тачи проходят насквозь
        userSelect: 'none',
        zIndex: 9999,              // поверх контента и модалок — попадёт на любой скриншот
        backgroundImage: dataUri,
        backgroundRepeat: 'repeat',
        // mix-blend-mode даёт читаемость и на тёмном, и на светлом фоне
        mixBlendMode: 'difference',
      }}
    />
  );
};
