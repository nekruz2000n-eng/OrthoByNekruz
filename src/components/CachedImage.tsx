"use client";

import React, { useState, useEffect, forwardRef } from 'react';

// ── Кэш картинок вопросов в Cache API ───────────────────────────────────────
// Картинки (/images/*.png) кэшируются так же, как аудио: один раз скачиваются,
// дальше отдаются из Cache API — мгновенно и без обращения к сети (работает
// даже офлайн). Имя кэша фиксированное: картинка `1.png` по смыслу неизменна.
// Если заменишь файл, оставив имя, — бампни версию (v1 → v2).
const IMG_CACHE = 'question-images-v3';

async function resolveImage(src: string): Promise<string> {
  if (!src || typeof caches === 'undefined') return src;
  try {
    const cache = await caches.open(IMG_CACHE);
    let hit = await cache.match(src);
    if (!hit) {
      const resp = await fetch(src);
      if (resp.ok) {
        await cache.put(src, resp.clone());
        hit = resp;
      }
    }
    if (hit) {
      const blob = await hit.blob();
      return URL.createObjectURL(blob);
    }
  } catch { /* кэш недоступен — отдаём обычный путь */ }
  return src;
}

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * <img> с кэшированием через Cache API. Картинка показывается сразу по
 * обычному пути, а в фоне кладётся в кэш; при следующих открытиях берётся
 * уже из кэша. API-совместим с обычным <img> (можно передавать ref).
 */
export const CachedImage = forwardRef<HTMLImageElement, Props>(({ src, ...rest }, ref) => {
  const [resolved, setResolved] = useState<string>(src);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setResolved(src); // мгновенный показ, пока резолвим кэш
    resolveImage(src).then(url => {
      if (cancelled) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      if (url.startsWith('blob:')) objectUrl = url;
      setResolved(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img ref={ref} src={resolved} {...rest} />;
});

CachedImage.displayName = 'CachedImage';
