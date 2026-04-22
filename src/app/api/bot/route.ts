import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

const token = '8715766671:AAFcEqobtLSYmYMPSzS2iuOIaHubrgQfOTM';
const bot = new Bot(token);
const CHANNEL_ID = '-1003929499461';

async function isSubscribed(userId: number) {
  try {
    const member = await bot.api.getChatMember(CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const subscribed = await isSubscribed(userId);
  if (subscribed) {
    await ctx.reply('✅ Подписка подтверждена! Добро пожаловать.');
    // Здесь позже добавишь выдачу ссылки на сайт
  } else {
    await ctx.reply(
      '❌ Ты не подписан на наш канал.\nПодпишись: https://t.me/c/3929499461\nПосле подписки нажми /start снова.'
    );
  }
});

bot.on('message', async (ctx) => {
  await ctx.reply('Напиши /start для проверки подписки');
});

export async function POST(req: Request) {
  const body = await req.json();
  await bot.handleUpdate(body);
  return NextResponse.json({ ok: true });
}