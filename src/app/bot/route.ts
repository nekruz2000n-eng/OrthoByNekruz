import { Bot, InlineKeyboard } from 'grammy';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Это заставляет Vercel обрабатывать запрос каждый раз, а не брать из кэша
export const dynamic = 'force-dynamic';

const token = process.env.BOT_TOKEN || "";
const ADMIN_ID = process.env.ADMIN_ID || "";
const SITE_URL = 'https://ortho-by-nekruz.vercel.app';
const CHANNEL_ID = '-1003929499461';

const bot = token ? new Bot(token) : null;

if (bot) {
  bot.command('give', async (ctx) => {
    // Лог в консоль Vercel, чтобы мы видели, кто пишет
    console.log("ID написавшего:", ctx.from?.id, "Ожидаемый ADMIN_ID:", ADMIN_ID);
    
    const fromId = String(ctx.from?.id);
    
    if (fromId !== String(ADMIN_ID).trim()) {
      return ctx.reply(`У вас нет прав. Ваш ID: ${fromId}`);
    }

    const studentId = ctx.match?.trim();
    if (!studentId) {
      return ctx.reply('Использование: /give [Telegram_ID]');
    }

    try {
      const member = await ctx.api.getChatMember(CHANNEL_ID, Number(studentId));
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);

      if (!isMember) {
        return ctx.reply(`⚠️ Студент (${studentId}) не подписан на канал.`);
      }

      const key = await kv.spop('valid_keys');
      
      if (!key) {
        return ctx.reply('❌ Ошибка: Ключи в базе закончились! Добавьте их командой SADD valid_keys [ключ]');
      }

      const loginUrl = `${SITE_URL}/?key=${key}&tgid=${studentId}`;
      
      await ctx.api.sendMessage(studentId, 
        `🚀 Твой доступ к OrthoByNekruz готов!\n\nНажми на кнопку ниже, чтобы войти.`,
        {
          reply_markup: new InlineKeyboard().url('🚀 Войти в приложение', loginUrl)
        }
      );

      await ctx.reply(`✅ Ключ ${key} успешно выдан студенту ${studentId}`);

    } catch (error: any) {
      console.error("Ошибка в команде give:", error);
      await ctx.reply('Ошибка: ' + error.message);
    }
  });

  bot.on('message', async (ctx) => {
    await ctx.reply(`Бот активен. Твой Telegram ID: ${ctx.from.id}\nДля выдачи ключа используй: /give [ID]`);
  });
}

export async function POST(request: Request) {
  if (!bot) {
    return NextResponse.json({ error: 'Bot token is missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    // Очень важно дождаться обработки
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ ok: true }); // Возвращаем 200, чтобы ТГ не слал повторы при ошибках кода
  }
}