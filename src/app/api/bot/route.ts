import { Bot } from 'grammy';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ТОКЕН (ЗАМЕНИ НА НОВЫЙ ПОСЛЕ ПЕРЕВЫПУСКА)
const token = '8390112746:AAEQMj-cglBXi0cZlqXqKgPjSw5advzxfVs';
const bot = new Bot(token);

// ID канала (числовой)
const CHANNEL_ID = '-1003929499461';

// Функция проверки подписки
async function isSubscribed(userId: number): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(CHANNEL_ID, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error('Ошибка проверки подписки:', error);
    return false;
  }
}

// Команда /start
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  console.log(`/start от ${userId}`);

  const subscribed = await isSubscribed(userId);
  if (subscribed) {
    await ctx.reply('✅ Подписка подтверждена! Ты можешь пользоваться ботом.');
    // Здесь добавь выдачу ссылки на твой сайт
  } else {
    // Ссылка на канал: если у канала нет username, используй https://t.me/c/3929499461
    await ctx.reply(
      '❌ Ты не подписан на наш канал.\n' +
      'Пожалуйста, подпишись: https://t.me/c/3929499461\n' +
      'После подписки нажми /start снова.'
    );
  }
});

bot.on('message', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  await ctx.reply(`Твой ID: ${userId}. Напиши /start для проверки подписки.`);
});

bot.catch((err) => console.error('Ошибка бота:', err));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Update:', JSON.stringify(body).slice(0, 300));
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка обработки:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  const info = await bot.api.getWebhookInfo();
  return NextResponse.json(info);
}