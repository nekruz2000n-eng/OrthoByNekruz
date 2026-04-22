// pages/api/bot.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// --- Конфигурация ---
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is not set');

const CHANNEL_LINK = 'https://t.me/nzsdental';
const CHANNEL_USERNAME = 'nzsdental';
const SUPPORT_LINK = 'https://t.me/evoeidos';
const SECRET = process.env.SECRET || 'xK9#mP2$qL5@rV8&wN3!zT7';

const redis = Redis.fromEnv();

// --- Функция запроса к Telegram API ---
async function callTelegram(method: string, params: any = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

// --- Проверка подписки ---
async function isSubscribed(userId: number): Promise<boolean> {
  try {
    const result = await callTelegram('getChatMember', {
      chat_id: `@${CHANNEL_USERNAME}`,
      user_id: userId,
    });
    if (!result.ok) return false;
    const status = result.result.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch {
    return false;
  }
}

// --- Отправка сообщения ---
async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: replyMarkup,
  });
}

// --- Сокращение ссылки ---
async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const res = await fetch('https://clck.ru/--', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(longUrl)}`,
    });
    if (res.ok) return (await res.text()).trim();
  } catch {}
  return longUrl;
}

// --- Главное меню (кнопки) ---
function getMainMenu() {
  return {
    inline_keyboard: [
      [{ text: '🔑 Ввести ключ', callback_data: 'enter_key' }],
      [{ text: '🆘 Получить ключ', callback_data: 'get_key' }],
    ],
  };
}

function getSubscribeMenu() {
  return {
    inline_keyboard: [
      [{ text: '✅ Да, подписался', callback_data: 'check_sub' }],
      [{ text: '📢 Подписаться', url: CHANNEL_LINK }],
    ],
  };
}

// --- Обработка команд и сообщений ---
async function handleUpdate(update: any) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';

    if (text === '/start') {
      await sendMessage(chatId, `Салам! Подписан ли ты на канал ${CHANNEL_LINK}?`, getSubscribeMenu());
      return;
    }

    // Обработка ввода ключа (8 цифр)
    if (/^\d{8}$/.test(text.trim())) {
      const key = text.trim();
      const subscribed = await isSubscribed(userId);
      if (!subscribed) {
        await sendMessage(chatId, '❌ Ты не подписан на канал. Подпишись и нажми /start заново.');
        return;
      }
      const keyExists = await redis.sismember('valid_keys', key);
      if (!keyExists) {
        await sendMessage(chatId, '❌ Неверный или уже использованный ключ. Доступ не активирован.');
        return;
      }
      await redis.srem('valid_keys', key);
      console.log(`Ключ ${key} использован пользователем ${userId}`);

      const tokenHash = crypto.createHash('md5').update(userId.toString() + SECRET).digest('hex');
      const longUrl = `https://ortho-by-nekruz.vercel.app/?user_id=${userId}&token=${tokenHash}`;
      const shortUrl = await shortenUrl(longUrl);
      await sendMessage(
        chatId,
        `✅ Ключ активирован!\n\n🔗 Твоя персональная ссылка для доступа:\n${shortUrl}\n\n⚠️ Никому не передавай — она привязана к твоему Telegram ID.\n\nСпасибо, что с нами! Салам.`
      );
      return;
    }

    // Если не команда и не ключ
    if (!text.startsWith('/')) {
      await sendMessage(chatId, 'Напиши /start, чтобы начать.');
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (data === 'check_sub') {
      const subscribed = await isSubscribed(userId);
      if (subscribed) {
        await callTelegram('answerCallbackQuery', { callback_query_id: query.id });
        await sendMessage(chatId, '✅ Подписка подтверждена! Теперь ты можешь активировать доступ.', getMainMenu());
      } else {
        await callTelegram('answerCallbackQuery', {
          callback_query_id: query.id,
          text: '❌ Ты ещё не подписан!',
          show_alert: true,
        });
        await sendMessage(chatId, 'Салам! Подпишись на канал, затем нажми кнопку «Да, подписался».', getSubscribeMenu());
      }
    } else if (data === 'enter_key') {
      await callTelegram('answerCallbackQuery', { callback_query_id: query.id });
      await sendMessage(chatId, '🔑 Отправь мне свой 8-значный ключ одним сообщением.\n\nПример: `16000778`');
    } else if (data === 'get_key') {
      await callTelegram('answerCallbackQuery', { callback_query_id: query.id });
      await sendMessage(chatId, `🆘 Если у тебя ещё нет ключа, свяжись со мной: ${SUPPORT_LINK}\n\nПосле получения ключа вернись и нажми «Ввести ключ».`);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running' });
  }

  try {
    await handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Ошибка вебхука:', error);
    res.status(200).json({ ok: false });
  }
}