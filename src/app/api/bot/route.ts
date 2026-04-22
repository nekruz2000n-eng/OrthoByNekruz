// src/app/api/bot/route.ts
import { Bot, webhookCallback } from 'grammy';
import { NextRequest, NextResponse } from 'next/server';

// Твой токен
const token = '8715766671:AAFcEqobtLSYmYMPSzS2iuOIaHubrgQfOTM';
const bot = new Bot(token);

// ID твоего канала (числовой)
const CHANNEL_ID = '-1003929499461';

// Функция проверки подписки на канал
async function isSubscribed(userId: number) {
  try {
    const member = await bot.api.getChatMember(CHANNEL_ID, userId);
    // Статусы участников, которые считаются подписанными
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    return false;
  }
}

// --- Обработчики команд и сообщений ---
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const subscribed = await isSubscribed(userId);
  if (subscribed) {
    await ctx.reply('✅ Подписка подтверждена! Добро пожаловать.');
    // Здесь ты сможешь сгенерировать и отправить пользователю ссылку с токеном
  } else {
    await ctx.reply(
      '❌ Ты не подписан на наш канал.\nПодпишись: https://t.me/c/3929499461\nПосле подписки нажми /start снова.'
    );
  }
});

bot.on('message', async (ctx) => {
  await ctx.reply('Напиши /start для проверки подписки');
});
// -----------------------------------

// --- Обработчик вебхука для Vercel ---
// Создаем хендлер, который будет принимать update'ы от Telegram
const handleUpdate = webhookCallback(bot, 'std/http');

// Экспортируем функцию для обработки POST-запросов
export async function POST(request: NextRequest) {
  try {
    // Просто передаем запрос в созданный хендлер
    return await handleUpdate(request);
  } catch (error) {
    console.error('Критическая ошибка в вебхуке:', error);
    // Важно: всегда возвращаем ответ, чтобы Telegram не дублировал запрос
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
// -----------------------------------