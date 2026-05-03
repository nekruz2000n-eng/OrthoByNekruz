// src/lib/fingerprint.ts
// Собирает device fingerprint на стороне клиента.
// Не использует сторонних библиотек — только Web API.

export interface FingerprintData {
  hash: string;       // итоговый хэш для сравнения
  signals: string;    // читаемая строка сигналов (для лога)
}

// Простой FNV-1a хэш — работает без crypto в браузере
function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Canvas fingerprint — рендерит текст и фигуры, снимает пиксели
// Разные GPU/драйверы/ОС дают чуть разный результат
function canvasFingerprint(): string {
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    const ctx = c.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.font      = '11pt Arial';
    ctx.fillText('OrthoByNekruz🦷', 2, 15);

    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.font      = '18pt Times New Roman';
    ctx.fillText('ortho', 4, 45);

    return fnv1a(c.toDataURL());
  } catch {
    return 'canvas-err';
  }
}

// WebGL renderer — уникален для каждой связки GPU+драйвер
function webglFingerprint(): string {
  try {
    const c   = document.createElement('canvas');
    const gl  = c.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';

    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbgInfo) return 'no-dbg';

    const vendor   = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL)   || '';
    const renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '';
    return fnv1a(`${vendor}|${renderer}`);
  } catch {
    return 'webgl-err';
  }
}

export async function collectFingerprint(): Promise<FingerprintData> {
  const signals = [
    // Экран
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    `dpr:${devicePixelRatio}`,
    // Язык и таймзона
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Платформа
    navigator.platform,
    // Аппаратура
    `cores:${navigator.hardwareConcurrency ?? 'n'}`,
    `mem:${(navigator as any).deviceMemory ?? 'n'}`,
    // Тачскрин
    `touch:${navigator.maxTouchPoints}`,
    // Canvas + WebGL (самые стабильные сигналы)
    `cv:${canvasFingerprint()}`,
    `gl:${webglFingerprint()}`,
  ].join('|');

  return {
    hash:    fnv1a(signals),
    signals,                    // передаём на сервер для лога
  };
}