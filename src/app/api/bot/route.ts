import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN не задан в переменных окружения');
}

const bot = new Bot(token!);

// Обработчик команды /start
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id ?? 'неизвестно';
  console.log(`Получена команда /start от ${userId}`);
  await ctx.reply(`Привет! Твой ID: ${userId}. Бот работает.`);
});

// Обработчик обычных сообщений
bot.on('message', async (ctx) => {
  const userId = ctx.from?.id ?? 'неизвестно';
  const text = ctx.message?.text ?? 'не текст';
  console.log(`Получено сообщение от ${userId}: ${text}`);
  await ctx.reply(`Ты написал: ${text}`);
});

bot.catch((err) => {
  console.error('Ошибка в боте:', err);
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Получен update от Telegram:', JSON.stringify(body).substring(0, 500));
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка при обработке update:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

export async function GET() {
  try {
    const webhookInfo = await bot.api.getWebhookInfo();
    return NextResponse.json(webhookInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}