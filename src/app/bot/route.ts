import { Bot, InlineKeyboard } from 'grammy';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN!);
const ADMIN_ID = process.env.ADMIN_ID!;
const SITE_URL = 'https://ortho-by-nekruz.vercel.app';
const CHANNEL_ID = '-1003929499461';

// Команда /give для админа
bot.command('give', async (ctx) => {
  const fromId = String(ctx.from?.id);
  
  if (fromId !== ADMIN_ID) {
    return ctx.reply('У вас нет прав администратора.');
  }

  const studentId = ctx.match; // Берет ID после команды /give
  if (!studentId) {
    return ctx.reply('Использование: /give [Telegram_ID]');
  }

  try {
    // 1. Проверка подписки на канал
    const member = await ctx.api.getChatMember(CHANNEL_ID, Number(studentId));
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);

    if (!isMember) {
      return ctx.reply(`Студент (${studentId}) не подписан на канал.`);
    }

    // 2. Берем ключ из базы
    const key = await kv.spop('valid_keys');
    if (!key) {
      return ctx.reply('Ошибка: Ключи в базе данных закончились!');
    }

    // 3. Формируем ссылку и отправляем студенту
    const loginUrl = `${SITE_URL}/?key=${key}&tgid=${studentId}`;
    
    await ctx.api.sendMessage(studentId, 
      `🚀 Твой доступ к OrthoByNekruz готов!\n\nНажми кнопку ниже, чтобы войти в приложение.`,
      {
        reply_markup: new InlineKeyboard().url('🚀 Войти в приложение', loginUrl)
      }
    );

    await ctx.reply(`✅ Ключ ${key} успешно выдан студенту ${studentId}`);
  } catch (error) {
    console.error(error);
    await ctx.reply('Произошла ошибка при проверке подписки или выдаче ключа.');
  }
});

// Обработчик входящих запросов от Telegram
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Grammy обрабатывает обновление
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}