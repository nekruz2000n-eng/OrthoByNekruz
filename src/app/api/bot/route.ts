// src/app/api/bot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Bot, webhookCallback, InlineKeyboard } from 'grammy/web';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// --- Конфигурация ---
const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not set');
const bot = new Bot(token);

const CHANNEL_LINK = 'https://t.me/nzsdental';
const CHANNEL_ID = '@nzsdental';
const SUPPORT_LINK = 'https://t.me/evoeidos';
const SECRET = process.env.SECRET || 'xK9#mP2$qL5@rV8&wN3!zT7';

const redis = Redis.fromEnv();

// --- Функция сокращения ссылки ---
async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const res = await fetch('https://clck.ru/--', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(longUrl)}`
    });
    if (res.ok) return (await res.text()).trim();
  } catch (e) {}
  return longUrl;
}

// --- Проверка подписки ---
async function isSubscribed(userId: number): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

// --- Главное меню после успешной подписки ---
async function sendMainMenu(ctx: any) {
  const keyboard = new InlineKeyboard()
    .text('🔑 Ввести ключ', 'enter_key')
    .row()
    .text('🆘 Получить ключ', 'get_key');
  await ctx.reply('✅ Подписка подтверждена! Теперь ты можешь активировать доступ.', { reply_markup: keyboard });
}

// --- Обработчик команды /start ---
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const keyboard = new InlineKeyboard()
    .text('✅ Да, подписался', 'check_sub')
    .url('📢 Подписаться', CHANNEL_LINK);

  await ctx.reply(
    `Салам! Подписан ли ты на канал ${CHANNEL_LINK}?`,
    { reply_markup: keyboard }
  );
});

// --- Обработка нажатий на кнопки ---
bot.callbackQuery('check_sub', async (ctx) => {
  const userId = ctx.from.id;
  const subscribed = await isSubscribed(userId);
  if (subscribed) {
    await ctx.answerCallbackQuery(); // просто закрываем уведомление
    await sendMainMenu(ctx);
  } else {
    await ctx.answerCallbackQuery({ text: '❌ Ты ещё не подписан!', show_alert: true });
    // Предложим подписаться снова
    const keyboard = new InlineKeyboard()
      .text('✅ Да, подписался', 'check_sub')
      .url('📢 Подписаться', CHANNEL_LINK);
    await ctx.reply('Салам! Подпишись на канал, затем нажми кнопку «Да, подписался».', { reply_markup: keyboard });
  }
});

bot.callbackQuery('enter_key', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '🔑 Отправь мне свой 8-значный ключ одним сообщением.\n\nПример: `16000778`',
    { parse_mode: 'Markdown' }
  );
});

bot.callbackQuery('get_key', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🆘 Если у тебя ещё нет ключа, свяжись со мной: ${SUPPORT_LINK}\n\nПосле получения ключа вернись и нажми «Ввести ключ».`
  );
});

// --- Обработка текстовых сообщений (ввод ключа) ---
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const text = ctx.message.text.trim();

  if (text.startsWith('/')) return;

  if (!/^\d{8}$/.test(text)) {
    await ctx.reply('❌ Ключ должен состоять ровно из 8 цифр. Попробуй ещё раз.');
    return;
  }

  const subscribed = await isSubscribed(userId);
  if (!subscribed) {
    await ctx.reply('❌ Ты не подписан на канал. Подпишись и нажми /start заново.');
    return;
  }

  const keyExists = await redis.sismember('valid_keys', text);
  if (!keyExists) {
    await ctx.reply('❌ Неверный или уже использованный ключ. Доступ не активирован.');
    return;
  }

  await redis.srem('valid_keys', text);
  console.log(`Ключ ${text} использован пользователем ${userId}`);

  const tokenHash = crypto.createHash('md5').update(userId.toString() + SECRET).digest('hex');
  const longUrl = `https://ortho-by-nekruz.vercel.app/?user_id=${userId}&token=${tokenHash}`;
  const shortUrl = await shortenUrl(longUrl);

  await ctx.reply(
    `✅ Ключ активирован!\n\n🔗 Твоя персональная ссылка для доступа:\n${shortUrl}\n\n⚠️ Никому не передавай — она привязана к твоему Telegram ID.\n\nСпасибо, что с нами! Салам.`
  );
});

// --- Обработчик ошибок ---
bot.catch((err) => console.error('Ошибка бота:', err));

// --- Вебхук для Vercel ---
const handleUpdate = webhookCallback(bot, 'std/http');

export async function POST(req: NextRequest) {
  try {
    return await handleUpdate(req);
  } catch (error) {
    console.error('Критическая ошибка вебхука:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Bot is running' });
}