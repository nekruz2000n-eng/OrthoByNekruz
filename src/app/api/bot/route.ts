import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const token = process.env.BOT_TOKEN || "";
const bot = new Bot(token);

bot.on('message', async (ctx) => {
  await ctx.reply(`Я тебя вижу! Твой ID: ${ctx.from.id}`);
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ошибка:', error);
    return NextResponse.json({ ok: true });
  }
}