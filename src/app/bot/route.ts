import { Bot, InlineKeyboard } from 'grammy';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Берем переменные. Если их нет (при сборке), используем заглушки.
const token = process.env.BOT_TOKEN || "";
const ADMIN_ID = process.env.ADMIN_ID || "";
const SITE_URL = 'https://ortho-by-nekruz.vercel.app';
const CHANNEL_ID = '-1003929499461';

// Инициализируем бота только если есть токен
const bot = token ? new Bot(token) : null;

if (bot) {
  // Команда /give для выдачи ключей
  bot.command('give', async (ctx) => {
    const fromId = String(ctx.from?.id);
    
    // Проверка, что пишет именно админ
    if (fromId !== ADMIN_ID) {
      return ctx.reply('У вас нет прав администратора.');
    }

    const studentId = ctx.match;
    if (!studentId) {
      return ctx.reply('Использование: /give [Telegram_ID]');
    }

    try {
      // 1. Проверка подписки
      const member = await ctx.api.getChatMember(CHANNEL_ID, Number(studentId));
      const isMember = ['member', 'administrator', 'creator'].includes(member.status);

      if (!isMember) {
        return ctx.reply(`⚠️ Студент (${studentId}) не подписан на канал.`);
      }

      // 2. Достаем ключ из базы
      const key = await kv.spop('valid_keys');
      
      if (!key) {
        return ctx.reply('❌ Ошибка: Ключи в базе закончились!');
      }

      // 3. Отправляем ссылку студенту
      const loginUrl = `${SITE_URL}/?key=${key}&tgid=${studentId}`;
      
      await ctx.api.sendMessage(studentId, 
        `🚀 Твой доступ к OrthoByNekruz готов!\n\nНажми на кнопку ниже, чтобы войти.`,
        {
          reply_markup: new InlineKeyboard().url('🚀 Войти в приложение', loginUrl)
        }
      );

      await ctx.reply(`✅ Ключ ${key} успешно выдан студенту ${studentId}`);

    } catch (error: any) {
      console.error(error);
      await ctx.reply('Ошибка: ' + error.message);
    }
  });

  // Ответ на любое другое сообщение или /start
  bot.on('message', async (ctx) => {
    await ctx.reply('Бот активен. Используйте /give [ID] для выдачи доступа.');
  });
}

// Обработчик Webhook для Vercel
export async function POST(request: Request) {
  if (!bot) {
    return NextResponse.json({ error: 'Bot token is missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}