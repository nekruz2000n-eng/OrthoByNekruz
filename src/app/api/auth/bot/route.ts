import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

const bot = new Bot(process.env.BOT_TOKEN || "");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Получено сообщение:", body);
    
    // Бот просто повторит любое твоё слово
    if (body.message) {
      await bot.api.sendMessage(body.message.from.id, "Я тебя слышу! Твой текст: " + body.message.text);
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ошибка бота:", error);
    return NextResponse.json({ ok: true }); // Возвращаем ok, чтобы Telegram не спамил запросами
  }
}