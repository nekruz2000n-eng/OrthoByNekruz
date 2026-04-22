import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Проверяем наличие токена
const token = process.env.BOT_TOKEN || "";
const bot = new Bot(token);

// Эхо-ответ для проверки связи
bot.on('message', async (ctx) => {
  await ctx.reply(`Связь установлена! Твой ID: ${ctx.from.id}`);
});

export async function POST(request: Request) {
  try {
    // Получаем данные от Telegram
    const body = await request.json();
    
    // Передаем их в grammy для обработки
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка бота:', error.message);
    // Возвращаем 200, чтобы Telegram не мучал нас повторами при ошибках кода
    return NextResponse.json({ ok: true });
  }
}