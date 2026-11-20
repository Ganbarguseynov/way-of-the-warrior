import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') || '';
const WEBHOOK_SECRET = Deno.env.get('TG_WEBHOOK_SECRET') || '';
const sb = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

async function send(chatId: number, text: string){
  try{
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  }catch(e){}
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');

  if (req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET){
    return new Response('forbidden', { status: 403 });
  }

  let upd: any = null;
  try { upd = await req.json(); } catch(e){ return new Response('ok'); }

  const msg = upd && upd.message;
  if (!msg || !msg.contact) return new Response('ok');

  const chatId: number = msg.chat.id;
  const fromId: number | undefined = msg.from && msg.from.id;
  const contact = msg.contact;

  if (!fromId || !contact.user_id || contact.user_id !== fromId){
    await send(chatId, 'Нужен твой собственный контакт. Нажми кнопку «Поделиться номером» в игре.');
    return new Response('ok');
  }

  const key = 'tg:' + fromId;

  const res = await sb
    .from('arena_players')
    .update({ phone_verified: true, phone_checked_at: new Date().toISOString() })
    .eq('player_key', key)
    .select('player_key');

  if (res.error || !res.data || res.data.length === 0){
    await send(chatId, 'Не нашёл твой профиль. Открой игру, зайди в «Регион» и попробуй снова.');
  } else {
    await send(chatId, 'Номер подтверждён ✅ Можно возвращаться в игру.');
  }

  return new Response('ok');
});