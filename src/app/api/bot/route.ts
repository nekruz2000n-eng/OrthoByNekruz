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
  console.log(`Получена команда /start от ${ctx.from.id}`);
  await ctx.reply(`Привет! Твой ID: ${ctx.from.id}. Бот работает.`);
});

// Обработчик обычных сообщений
bot.on('message', async (ctx) => {
  console.log(`Получено сообщение от ${ctx.from.id}: ${ctx.message.text}`);
  await ctx.reply(`Ты написал: ${ctx.message.text}`);
});

// Глобальный обработчик ошибок
bot.catch((err) => {
  console.error('Ошибка в боте:', err);
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Получен update от Telegram:', JSON.stringify(body).substring(0, 500));
    
    // Обрабатываем обновление через grammy
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка при обработке update:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

// Проверка вебхука (опционально, можно вызвать один раз)
export async function GET() {
  const webhookInfo = await bot.api.getWebhookInfo();
  return NextResponse.json(webhookInfo);
}