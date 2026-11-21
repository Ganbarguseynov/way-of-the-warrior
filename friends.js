/* ============================================================
   friends.js — друзья и вызовы на дружескую партию (VER 6)
   Входящий вызов приходит через Realtime, опрос — запасной вариант.
   Вызов живёт, пока отправитель шлёт пульс; пульс не старше 90 секунд.
   ============================================================ */
(function (global) {
'use strict';

const SB_URL = 'https://qnpriwfxzuoymoumdtrl.supabase.co';
const SB_KEY = 'sb_publishable_1jTWcnb3WvNMi79DXYU7Tw_RWKIVcsF';

const ALIVE_MS = 90000;
const BEAT_MS = 3000;
const POLL_MS = 5000;

const MODE_KEY = 'arenaMode';
const MODE_IDS = ['classic','nocards','noelixir','pure'];

const Friends = {
  sb: null,
  _seen: {},
  _timer: null,
  _beatTimer: null,
  _beatId: null,
  _rt: null
};

Friends.client = function (){
  if (!Friends.sb) Friends.sb = global.supabase.createClient(SB_URL, SB_KEY);
  return Friends.sb;
};

Friends.key = function (){
  const tgId = localStorage.getItem('tgId');
  if (tgId) return 'tg:' + tgId;

  const email = localStorage.getItem('currentEmail') || localStorage.getItem('linkedEmail');
  if (email) return 'email:' + email.toLowerCase();

  let anon = localStorage.getItem('arenaAnonId');
  if (!anon){
    anon = 'anon:' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('arenaAnonId', anon);
  }
  return anon;
};

Friends.name = function (){
  return localStorage.getItem('userName') || 'Игрок';
};

Friends.cups = function (){
  return parseInt(localStorage.getItem('cr_trophies') || '0', 10) || 0;
};

Friends.arenaOf = function (c){
  return Math.min(10, Math.floor(Math.max(0, c) / 1000) + 1);
};

Friends.mode = function (){
  let v = null;
  try { v = localStorage.getItem(MODE_KEY); } catch (e){}
  return MODE_IDS.indexOf(v) >= 0 ? v : 'classic';
};

Friends.setMode = function (id){
  if (MODE_IDS.indexOf(id) < 0) return false;
  try { localStorage.setItem(MODE_KEY, id); } catch (e){ return false; }
  return true;
};

Friends.MODE_IDS = MODE_IDS;

function uuid(){
  if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c){
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function heartAge(row){
  if (!row || !row.heartbeat) return Infinity;
  return Date.now() - new Date(row.heartbeat).getTime();
}

function normalizeMode(row){
  if (!row.mode || MODE_IDS.indexOf(row.mode) < 0) row.mode = 'classic';
  return row;
}

/* ---------------- друзья ---------------- */

Friends.list = async function (){
  const sb = Friends.client();
  const res = await sb
    .from('arena_friends')
    .select('*')
    .eq('owner_key', Friends.key())
    .order('created_at', { ascending: false });

  if (res.error) return [];
  return res.data || [];
};

Friends.find = async function (nick){
  const sb = Friends.client();
  const q = String(nick || '').trim();
  if (q.length < 2) return [];

  const res = await sb
    .from('arena_players')
    .select('player_key,display_name,cups')
    .ilike('display_name', '%' + q + '%')
    .order('cups', { ascending: false })
    .limit(10);

  if (res.error) return [];
  return res.data || [];
};

Friends.add = async function (friendKey, friendName){
  const sb = Friends.client();
  const res = await sb.rpc('arena_add_friend', {
    p_owner:  Friends.key(),
    p_friend: friendKey,
    p_name:   friendName || 'Игрок'
  });
  return !res.error;
};

Friends.remove = async function (friendKey){
  const sb = Friends.client();
  const res = await sb.rpc('arena_remove_friend', {
    p_owner:  Friends.key(),
    p_friend: friendKey
  });
  return !res.error;
};

/* ---------------- пульс отправителя ---------------- */

Friends.startBeat = function (id){
  Friends.stopBeat();
  Friends._beatId = id;

  function beat(){
    if (!Friends._beatId) return;
    Friends.client().rpc('challenge_heartbeat', {
      p_id:   Friends._beatId,
      p_from: Friends.key()
    }).then(function(){}).catch(function(){});
  }

  beat();
  Friends._beatTimer = setInterval(beat, BEAT_MS);
};

Friends.stopBeat = function (){
  if (Friends._beatTimer){
    clearInterval(Friends._beatTimer);
    Friends._beatTimer = null;
  }
  Friends._beatId = null;
};

/* ---------------- вызовы ---------------- */

Friends.incoming = async function (){
  const sb = Friends.client();
  const res = await sb
    .from('arena_challenges')
    .select('*')
    .eq('to_key', Friends.key())
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (res.error) return [];

  return (res.data || [])
    .filter(function (c){ return heartAge(c) < ALIVE_MS; })
    .map(normalizeMode);
};

Friends.status = async function (id){
  const sb = Friends.client();
  const res = await sb
    .from('arena_challenges')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (res.error || !res.data) return null;

  const row = normalizeMode(res.data);

  if (row.status !== 'pending') return row;
  if (heartAge(row) >= ALIVE_MS) return null;

  return row;
};

Friends.answer = async function (id, status){
  const sb = Friends.client();
  const res = await sb.rpc('challenge_answer', {
    p_id:     id,
    p_to:     Friends.key(),
    p_status: status
  });

  if (res.error) return { ok:false, accepted:false };

  return {
    ok:       !!(res.data && res.data.ok),
    accepted: !!(res.data && res.data.accepted)
  };
};

Friends.cancel = async function (id){
  const sb = Friends.client();
  const res = await sb.rpc('challenge_cancel', {
    p_id:   id,
    p_from: Friends.key()
  });
  return !res.error;
};

Friends.cancelBeacon = function (id){
  try {
    fetch(SB_URL + '/rest/v1/rpc/challenge_cancel', {
      method: 'POST',
      keepalive: true,
      headers: {
        'apikey':        SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ p_id: id, p_from: Friends.key() })
    });
  } catch (e){}
};

/* ---------------- отправка вызова ---------------- */

Friends.invite = async function (toKey, toName, toCups, mode){
  const sb = Friends.client();
  const id = uuid();
  const arena = Math.min(Friends.arenaOf(Friends.cups()), Friends.arenaOf(toCups || 0));
  const md = (MODE_IDS.indexOf(mode) >= 0) ? mode : Friends.mode();

  const withMode = await sb.rpc('challenge_send', {
    p_id:    id,
    p_from:  Friends.key(),
    p_name:  Friends.name(),
    p_cups:  Friends.cups(),
    p_to:    toKey,
    p_arena: arena,
    p_mode:  md
  });

  if (!withMode.error) return { id: id, arena: arena, mode: md };

  const plain = await sb.rpc('challenge_send', {
    p_id:    id,
    p_from:  Friends.key(),
    p_name:  Friends.name(),
    p_cups:  Friends.cups(),
    p_to:    toKey,
    p_arena: arena
  });

  if (plain.error) return null;
  return { id: id, arena: arena, mode: md };
};

/* ---------------- переход в бой ---------------- */

Friends.play = function (id, role, oppKey, oppName, oppCups, arena, mode){
  const md = (MODE_IDS.indexOf(mode) >= 0) ? mode : Friends.mode();

  const q =
    '?ch=' + encodeURIComponent(id) +
    '&role=' + encodeURIComponent(role) +
    '&opp=' + encodeURIComponent(oppKey || '') +
    '&name=' + encodeURIComponent(oppName || 'Соперник') +
    '&cups=' + encodeURIComponent(String(oppCups || 0)) +
    '&arena=' + encodeURIComponent(String(arena || 1)) +
    '&mode=' + encodeURIComponent(md);

  global.location.href = 'chess-arena.html' + q;
};

/* ---------------- получение входящих ---------------- */

function deliver(list, cb){
  for (let i = 0; i < list.length; i++){
    const c = list[i];
    if (Friends._seen[c.id]) continue;
    Friends._seen[c.id] = true;
    try { cb(c); } catch (e){}
  }
}

Friends.stopWatch = function (){
  if (Friends._timer){ clearInterval(Friends._timer); Friends._timer = null; }
  if (Friends._rt){
    try { Friends.client().removeChannel(Friends._rt).catch(function(){}); } catch (e){}
    Friends._rt = null;
  }
};

Friends.watch = function (cb){
  Friends.stopWatch();

  const key = Friends.key();

  try {
    const ch = Friends.client().channel('friends_' + key);
    ch.on('postgres_changes', {
      event: '*', schema: 'public', table: 'arena_challenges',
      filter: 'to_key=eq.' + key
    }, function (payload){
      const row = payload && (payload.new || payload.record);
      if (!row || row.status !== 'pending') return;
      if (heartAge(row) >= ALIVE_MS) return;
      deliver([normalizeMode(row)], cb);
    });
    ch.subscribe();
    Friends._rt = ch;
  } catch (e){}

  function pull(){
    Friends.incoming().then(function (list){ deliver(list, cb); }).catch(function(){});
  }

  pull();
  Friends._timer = setInterval(pull, POLL_MS);

  return Friends.stopWatch;
};

Friends.forget = function (id){
  delete Friends._seen[id];
};

global.Friends = Friends;

})(window);