/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Хеш коммита текущего деплоя — попадает в клиентский бандл и используется
    // для инвалидации кэша данных предмета (src/lib/subjectData.ts).
    // Vercel выставляет VERCEL_GIT_COMMIT_SHA автоматически на каждом билде;
    // локально (npm run dev) переменной нет — фолбэк на 'dev'.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
};

module.exports = nextConfig;
