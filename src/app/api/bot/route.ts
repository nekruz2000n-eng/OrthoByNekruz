import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const token = process.env.BOT_TOKEN || "";

// Создаем экземпляр бота ВНЕ функции POST, чтобы он не пересоздавался постоянно
const bot = new Bot(token);

// Обработка команды /start
bot.command('start', async (ctx) => {
  try {
    await ctx.reply('Система OrthoByNekruz на связи! Я тебя вижу.');
  } catch (err) {
    console.error("Ошибка при ответе на /start:", err);
  }
});

// Ответ на любое сообщение
bot.on('message', async (ctx) => {
  await ctx.reply(`Твой ID: ${ctx.from.id}. Отправь /start для проверки.`);
});

export async function POST(request: Request) {
  if (!token) {
    console.error("BOT_TOKEN отсутствует в переменных окружения!");
    return NextResponse.json({ error: 'No token' }, { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const body = await request.json();
    
    // Передаем обновление в grammy
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка в POST обработчике:', error.message);
    // Возвращаем 200, чтобы Телеграм не спамил запросами при ошибке кода
    return NextResponse.json({ ok: true });
  }
}