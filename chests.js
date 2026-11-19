/* ============================================================
   chests.js — сундуки за победы (VER 5)
   • Прокачка выдаётся конкретной карте, а не в общий котёл.
   • Награда показывается по одной штуке: карта, карта, монеты.
   • За каждую настоящую победу — серебряный сундук.
   • Редко — более ценный сундук, по одному типу на арену.
   • Изредка сюрприз: сундук на ступень выше.
   • Сундук нажимается: пустой слот — запуск таймера, готовый — открытие.
   ────────────────────────────────────────────────────────────
   Подключение:
     главная:    <script src="chests.js?v=5"></script>
     экран боя:  <script src="chests.js?v=5"></script>
                 (лобби там нет — блок не появится сам, только начисление)
   ============================================================ */
(function (global) {
'use strict';

const KEY       = 'chessChests';
const CARD_KEY  = 'chessCardUnits';
const COINS_KEY = 'cr_coins';
const GEMS_KEY  = 'cr_gems';
const SLOTS     = 4;

const PREMIUM_CHANCE  = 0.12;
const SURPRISE_CHANCE = 0.04;
const GEMS_PER_HOUR   = 2;
const TIME_MULT       = 1;

const CARDS = [
  { id:'f', name:'Ярость',       icon:'⚡'  },
  { id:'s', name:'Щит',          icon:'🛡️' },
  { id:'c', name:'Рокировка',    icon:'🔄'  },
  { id:'u', name:'Превращение',  icon:'👑'  },
  { id:'g', name:'Подкрепление', icon:'➕'  },
  { id:'x', name:'Чистка',       icon:'🗡️' },
  { id:'z', name:'Заморозка',    icon:'❄️' },
  { id:'l', name:'Перевербовка', icon:'🤝'  },
  { id:'b', name:'Блокада',      icon:'🧱'  },
  { id:'e', name:'Взрыв',        icon:'💣'  }
];

const CHESTS = [
  { name:'Серебряный',  rarity:'Обычный',     hours:3,  coins:[120,260],  cards:[1,1], unit:[15,30],
    pal:{ w:['#9aa4b4','#4b5563'], m:['#f8fafc','#94a3b8'], glow:'#cbd5e1' } },
  { name:'Золотой',     rarity:'Редкий',      hours:6,  coins:[300,520],  cards:[1,2], unit:[20,40],
    pal:{ w:['#b45309','#6b2f0b'], m:['#fef3c7','#f59e0b'], glow:'#fbbf24' } },
  { name:'Кристальный', rarity:'Редкий',      hours:9,  coins:[450,750],  cards:[2,2], unit:[25,50],
    pal:{ w:['#1d4f91','#0b2a55'], m:['#e0f2fe','#38bdf8'], glow:'#7dd3fc' } },
  { name:'Магический',  rarity:'Эпический',   hours:12, coins:[650,1000], cards:[2,3], unit:[35,65],
    pal:{ w:['#6d28d9','#2e1065'], m:['#f5d0fe','#c084fc'], glow:'#a78bfa' } },
  { name:'Королевский', rarity:'Эпический',   hours:16, coins:[900,1400], cards:[2,3], unit:[45,80],
    pal:{ w:['#9d174d','#4a0722'], m:['#fbcfe8','#ec4899'], glow:'#f472b6' } },
  { name:'Драконий',    rarity:'Эпический',   hours:20, coins:[1300,1900],cards:[3,3], unit:[55,95],
    pal:{ w:['#c2410c','#6b2508'], m:['#fed7aa','#f97316'], glow:'#f97316' } },
  { name:'Теневой',     rarity:'Легендарный', hours:24, coins:[1800,2600],cards:[3,3], unit:[70,110],
    pal:{ w:['#334155','#0b1120'], m:['#cbd5e1','#475569'], glow:'#64748b' } },
  { name:'Небесный',    rarity:'Легендарный', hours:30, coins:[2400,3400],cards:[3,4], unit:[85,130],
    pal:{ w:['#0284c7','#0a3d62'], m:['#e0f2fe','#7dd3fc'], glow:'#38bdf8' } },
  { name:'Адский',      rarity:'Легендарный', hours:36, coins:[3200,4500],cards:[4,4], unit:[100,155],
    pal:{ w:['#991b1b','#3f0909'], m:['#fecaca','#f59e0b'], glow:'#ef4444' } },
  { name:'Легендарный', rarity:'Легендарный', hours:48, coins:[4500,6500],cards:[4,4], unit:[120,190],
    pal:{ w:['#eab308','#713f12'], m:['#fffbeb','#facc15'], glow:'#facc15' } }
];
const TOP = CHESTS.length - 1;

function arenaOf(cups){
  if (global.Arena && typeof Arena.arenaOf === 'function') return Arena.arenaOf(cups);
  return Math.min(10, Math.floor(Math.max(0, cups) / 1000) + 1);
}

let uid = 0;
function chestSvg(c, w){
  const p = c.pal, id = 'chg' + (++uid), h = Math.round(w * 0.92);
  const rivets = [[13,50],[87,50],[13,80],[87,80],[23,12],[76,12],[23,80],[76,80]];
  let rv = '';
  for (let i = 0; i < rivets.length; i++){
    rv += '<circle cx="'+rivets[i][0]+'" cy="'+rivets[i][1]+'" r="1.4" fill="#0b0f1a" opacity=".75"/>';
  }
  return '<svg class="chest-svg" viewBox="0 0 100 92" width="'+w+'" height="'+h+'" aria-hidden="true">' +
    '<defs>' +
      '<linearGradient id="'+id+'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+p.w[0]+'"/><stop offset="1" stop-color="'+p.w[1]+'"/></linearGradient>' +
      '<linearGradient id="'+id+'m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+p.m[0]+'"/><stop offset="1" stop-color="'+p.m[1]+'"/></linearGradient>' +
    '</defs>' +
    '<ellipse cx="50" cy="89" rx="40" ry="3.5" fill="#000" opacity=".5"/>' +
    '<rect x="8" y="42" width="84" height="41" rx="5" fill="url(#'+id+'w)" stroke="#0b0f1a" stroke-width="1.6"/>' +
    '<path d="M8 58H92M8 74H92" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/>' +
    '<path d="M8 42V28Q8 7 50 7Q92 7 92 28V42Z" fill="url(#'+id+'w)" stroke="#0b0f1a" stroke-width="1.6"/>' +
    '<path d="M7 25Q14 13 50 12Q86 13 93 25" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/>' +
    '<rect x="19" y="6" width="9" height="78" rx="1.5" fill="url(#'+id+'m)" stroke="#0b0f1a" stroke-width="1"/>' +
    '<rect x="72" y="6" width="9" height="78" rx="1.5" fill="url(#'+id+'m)" stroke="#0b0f1a" stroke-width="1"/>' +
    '<rect x="6" y="39" width="88" height="6.5" rx="1.5" fill="url(#'+id+'m)" stroke="#0b0f1a" stroke-width="1"/>' +
    rv +
    '<rect x="41" y="34" width="18" height="20" rx="3.5" fill="url(#'+id+'m)" stroke="#0b0f1a" stroke-width="1.2"/>' +
    '<circle cx="50" cy="42" r="3.2" fill="#0b0f1a"/>' +
    '<path d="M48.4 43H51.6L52.4 50H47.6Z" fill="#0b0f1a"/>' +
    '<circle cx="31" cy="20" r="2" fill="#fff" opacity=".7"/>' +
  '</svg>';
}

function load(){
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(a) && a.length === SLOTS) return a;
  } catch (e){}
  return [null, null, null, null];
}
let slots = load();
let lastResultKey = null;

function save(){ try { localStorage.setItem(KEY, JSON.stringify(slots)); } catch (e){} }
function num(key){
  const n = parseInt(localStorage.getItem(key) || '0', 10);
  return isFinite(n) ? n : 0;
}
function setNum(key, n){ try { localStorage.setItem(key, String(Math.max(0, n))); } catch (e){} }
function rnd(range){ return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1)); }

function readCardUnits(){
  try {
    const o = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (e){ return {}; }
}
function addCardUnits(id, n){
  const o = readCardUnits();
  o[id] = (parseInt(o[id] || 0, 10) || 0) + n;
  try { localStorage.setItem(CARD_KEY, JSON.stringify(o)); } catch (e){}
}
function cardUnitsOf(id){
  return parseInt(readCardUnits()[id] || 0, 10) || 0;
}

function note(msg, color){
  if (typeof global.toast === 'function'){ global.toast(msg); return; }
  let t = document.getElementById('chToast');
  if (!t){
    t = document.createElement('div');
    t.id = 'chToast';
    t.className = 'ch-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.borderColor = color || '#34c759';
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

function isOpening(){
  return slots.some(function(s){ return s && s.st === 'open'; });
}

function rollPremium(arena){
  const maxT = Math.min(arena - 1, TOP);
  if (maxT < 1) return -1;
  if (Math.random() >= PREMIUM_CHANCE) return -1;
  let total = 0;
  for (let t = 1; t <= maxT; t++) total += (maxT - t + 1);
  let r = Math.random() * total;
  for (let t = 1; t <= maxT; t++){
    r -= (maxT - t + 1);
    if (r < 0) return t;
  }
  return 1;
}

function freeSlot(){ return slots.indexOf(null); }

function onWin(beforeCups){
  const arena = arenaOf(beforeCups);
  const premium = rollPremium(arena);

  const i = freeSlot();
  if (i < 0){
    save(); render();
    note('Все 4 ячейки заняты — сундук не получен', '#ffb300');
    return { silver:false, premium:-1 };
  }
  slots[i] = { t:0, st:'idle' };

  let prem = -1;
  if (premium > 0){
    const j = freeSlot();
    if (j >= 0){ slots[j] = { t:premium, st:'idle' }; prem = premium; }
  }

  save(); render();
  if (prem > 0) note('🎁 Серебряный + ' + CHESTS[prem].name + ' сундук!', CHESTS[prem].pal.glow);
  else note('🎁 Получен серебряный сундук', CHESTS[0].pal.glow);
  return { silver:true, premium:prem };
}

function startOpen(i){
  const s = slots[i];
  if (!s || s.st !== 'idle') return;
  if (isOpening()){
    note('Одновременно открывается только один сундук', '#ffb300');
    return;
  }
  s.st = 'open';
  s.end = Date.now() + CHESTS[s.t].hours * 3600000 * TIME_MULT;
  save(); render();
}

function gemCost(remainingMs){
  const hours = remainingMs / 3600000;
  return Math.max(1, Math.ceil(hours * GEMS_PER_HOUR));
}

function skip(i){
  const s = slots[i];
  if (!s || s.st !== 'open') return;
  const rem = s.end - Date.now();
  if (rem <= 0) return;
  const cost = gemCost(rem);
  const gems = num(GEMS_KEY);
  if (gems < cost){
    note('Нужно ' + cost + ' 💎, у тебя ' + gems, '#f4665e');
    return;
  }
  setNum(GEMS_KEY, gems - cost);
  s.end = Date.now();
  save(); render();
  if (typeof global.updateTopbar === 'function') global.updateTopbar();
  note('Сундук готов к открытию', '#43e97b');
}

function buildReward(tier){
  const c = CHESTS[tier];
  const want = rnd(c.cards);
  const taken = [];
  const items = [];

  for (let k = 0; k < want && taken.length < CARDS.length; k++){
    const pool = CARDS.filter(function(x){ return taken.indexOf(x.id) < 0; });
    if (!pool.length) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    taken.push(pick.id);
    items.push({
      type: 'card',
      id: pick.id,
      name: pick.name,
      icon: pick.icon,
      units: rnd(c.unit)
    });
  }

  items.push({ type:'coins', amount: rnd(c.coins) });
  return items;
}

function claim(i){
  const s = slots[i];
  if (!s || s.st !== 'open') return;
  if (Date.now() < s.end) return;

  let tier = s.t;
  let surprise = false;
  if (tier < TOP && Math.random() < SURPRISE_CHANCE){
    tier = tier + 1;
    surprise = true;
  }

  const items = buildReward(tier);

  items.forEach(function(it){
    if (it.type === 'card') addCardUnits(it.id, it.units);
    else if (it.type === 'coins') setNum(COINS_KEY, num(COINS_KEY) + it.amount);
  });

  slots[i] = null;
  save(); render();

  try {
    global.dispatchEvent(new CustomEvent('chests:grant', { detail:{ items:items } }));
  } catch (e){}

  showReward(tier, items, surprise);
  if (typeof global.updateTopbar === 'function') global.updateTopbar();
}

let rvItems = [];
let rvIdx = -1;

function showReward(tier, items, surprise){
  const ov = document.getElementById('chReward');
  if (!ov){
    const names = items.map(function(it){
      return it.type === 'card' ? (it.name + ' +' + it.units) : ('🪙 +' + it.amount);
    });
    note('🎁 ' + names.join(' · '), CHESTS[tier].pal.glow);
    return;
  }

  const c = CHESTS[tier];
  ov.querySelector('.chr-icon').innerHTML = chestSvg(c, 120);
  const nm = ov.querySelector('.chr-name');
  nm.textContent = c.name + ' сундук';
  nm.style.color = c.pal.glow;

  ov.querySelector('.chr-surprise').innerHTML = surprise
    ? '<div class="chr-sur">⭐ СЮРПРИЗ! Сундук оказался ценнее</div>'
    : '';

  rvItems = items.slice();
  rvIdx = -1;

  ov.classList.add('open');
  nextReveal();
}

function nextReveal(){
  const ov = document.getElementById('chReward');
  if (!ov) return;

  const box = ov.querySelector('.chr-list');
  const btn = ov.querySelector('.chr-ok');
  if (!box || !btn) return;

  rvIdx++;

  if (rvIdx >= rvItems.length){
    box.innerHTML = '<div class="chr-done">Всё получено</div>';
    btn.textContent = 'Забрать';
    btn.dataset.done = '1';
    return;
  }

  const it = rvItems[rvIdx];

  if (it.type === 'card'){
    box.innerHTML =
      '<div class="chr-item">' +
        '<div class="chr-ic">' + it.icon + '</div>' +
        '<div class="chr-t">' + it.name + '</div>' +
        '<div class="chr-s">+' + it.units + ' прокачки этой карте</div>' +
        '<div class="chr-step">' + (rvIdx + 1) + ' / ' + rvItems.length + '</div>' +
      '</div>';
  } else {
    box.innerHTML =
      '<div class="chr-item">' +
        '<div class="chr-ic">🪙</div>' +
        '<div class="chr-t">Монеты</div>' +
        '<div class="chr-s">+' + it.amount + '</div>' +
        '<div class="chr-step">' + (rvIdx + 1) + ' / ' + rvItems.length + '</div>' +
      '</div>';
  }

  const last = (rvIdx === rvItems.length - 1);
  btn.textContent = last ? 'Забрать' : 'Дальше';
  btn.dataset.done = last ? '1' : '0';
}

function showResultChest(res){
  const ov = document.getElementById('overlay');
  if (!ov || !res) return;
  const box = ov.querySelector('.ov');
  const btn = document.getElementById('ovBtn');
  if (!box || !btn) return;

  const old = document.getElementById('chResult');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'chResult';
  el.className = 'chr-res';

  if (!res.silver){
    el.innerHTML = '<div class="chr-res-t">Сундук не получен</div>' +
      '<div class="chr-res-s">Все 4 ячейки заняты. Освободи место.</div>';
  } else {
    let html = '<div class="chr-res-art">' + chestSvg(CHESTS[0], 84) + '</div>' +
      '<div class="chr-res-t">Получен серебряный сундук</div>' +
      '<div class="chr-res-s">Открой его в главном меню, когда таймер закончится (' + CHESTS[0].hours + ' ч)</div>';
    if (res.premium > 0){
      const p = CHESTS[res.premium];
      html += '<div class="chr-res-prem" style="--c:' + p.pal.glow + '">' +
        '<div class="chr-res-art sm">' + chestSvg(p, 52) + '</div>' +
        '<div><div class="chr-res-pt">Редкая находка!</div>' +
        '<div class="chr-res-pn" style="color:' + p.pal.glow + '">' + p.name + ' сундук</div></div>' +
        '</div>';
    }
    el.innerHTML = html;
  }
  box.insertBefore(el, btn);
}

function fmt(ms){
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return h + 'ч ' + String(m).padStart(2,'0') + 'м';
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function slotHtml(s, i){
  if (!s){
    return '<div class="ch-slot empty"><div class="ch-plus">+</div><div class="ch-tx">Пусто</div></div>';
  }
  const c = CHESTS[s.t];
  const rem = s.st === 'open' ? s.end - Date.now() : 0;
  const ready = s.st === 'open' && rem <= 0;
  let state, btn, act = '';

  if (s.st === 'idle'){
    state = '<span class="ch-rar">' + c.rarity + '</span>';
    btn = '<button class="ch-btn" data-act="start" data-i="' + i + '">Открыть · ' + c.hours + 'ч</button>';
    act = ' data-act="start" data-i="' + i + '"';
  } else if (!ready){
    state = '<span class="ch-time" data-end="' + s.end + '">' + fmt(rem) + '</span>';
    btn = '<button class="ch-btn gem" data-act="skip" data-i="' + i + '">💎 <span class="ch-gem" data-end="' + s.end + '">' + gemCost(rem) + '</span></button>';
  } else {
    state = '<span class="ch-ready-t">Готов!</span>';
    btn = '<button class="ch-btn ready" data-act="claim" data-i="' + i + '">Открыть</button>';
    act = ' data-act="claim" data-i="' + i + '"';
  }

  const artCls = 'ch-art' + (s.st === 'open' && !ready ? ' opening' : '') + (ready ? ' ready' : '');
  return '<div class="ch-slot' + (ready ? ' is-ready' : '') + '" style="--c:' + c.pal.glow + '">' +
    '<div class="ch-glow"></div>' +
    '<div class="' + artCls + '"' + act + '>' + chestSvg(c, 58) + '</div>' +
    '<div class="ch-nm">' + c.name + '</div>' +
    '<div class="ch-st">' + state + '</div>' +
    btn +
    '</div>';
}

function render(){
  const box = document.getElementById('chSlots');
  if (!box) return;
  box.innerHTML = slots.map(slotHtml).join('');
}

function tick(){
  let needRender = false;
  slots.forEach(function(s){
    if (s && s.st === 'open' && Date.now() >= s.end) needRender = true;
  });
  if (needRender){ render(); return; }

  document.querySelectorAll('.ch-time').forEach(function(el){
    const end = parseInt(el.getAttribute('data-end'), 10);
    el.textContent = fmt(end - Date.now());
  });
  document.querySelectorAll('.ch-gem').forEach(function(el){
    const end = parseInt(el.getAttribute('data-end'), 10);
    const rem = end - Date.now();
    if (rem > 0) el.textContent = gemCost(rem);
  });
}

function injectStyle(){
  if (document.getElementById('chStyle')) return;
  const st = document.createElement('style');
  st.id = 'chStyle';
  st.textContent = [
    '#chWrap{width:min(95vw,400px);margin:10px auto 0;padding:8px 8px 10px;border-radius:14px;background:linear-gradient(180deg,#1f4a94,#122c63);border:2px solid #4b78c8;box-shadow:0 4px 0 #061433}',
    '#chWrap h3{margin:0 0 8px;font-size:12px;font-weight:900;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:6px}',
    '#chWrap h3 small{font-size:9.5px;color:#9fc4ff;font-weight:700;white-space:nowrap}',
    '#chSlots{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
    '.ch-slot{position:relative;border-radius:12px;padding:6px 3px 6px;height:128px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;overflow:hidden;background:linear-gradient(180deg,#16336e,#0a1d44);border:2px solid var(--c,#4b78c8);box-shadow:0 3px 0 #040d22,inset 0 1px 0 rgba(255,255,255,.15)}',
    '.ch-slot.empty{border:2px dashed #3d5f9f;box-shadow:none;justify-content:center;color:#6d8cc4;background:rgba(2,6,23,.35)}',
    '.ch-plus{font-size:22px;font-weight:900;opacity:.6;line-height:1}',
    '.ch-tx{font-size:10px;font-weight:800}',
    '.ch-glow{position:absolute;inset:-30%;background:radial-gradient(circle,var(--c,#fff) 0%,transparent 60%);opacity:.14;pointer-events:none}',
    '.ch-slot.is-ready .ch-glow{opacity:.5;animation:chPulse .8s ease-in-out infinite alternate}',
    '@keyframes chPulse{from{transform:scale(.9)}to{transform:scale(1.1)}}',
    '.ch-art{position:relative;z-index:1;height:62px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 4px 4px rgba(0,0,0,.6))}',
    '.ch-art[data-act]{cursor:pointer}',
    '.ch-art.opening{animation:chBob 2.2s ease-in-out infinite}',
    '.ch-art.ready{animation:chShake .55s ease-in-out infinite}',
    '@keyframes chBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    '@keyframes chShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}',
    '.ch-nm{font-size:9.5px;font-weight:900;color:#fff;position:relative;z-index:1;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.ch-st{font-size:8.5px;font-weight:900;color:#ffe27a;min-height:12px;position:relative;z-index:1;font-variant-numeric:tabular-nums;line-height:1.2}',
    '.ch-rar{color:var(--c,#cbd5e1)}',
    '.ch-ready-t{color:#86efac}',
    '.ch-btn{width:100%;border:0;border-radius:7px;padding:4px 1px;font-size:8.5px;font-weight:900;color:#3b1f00;cursor:pointer;background:linear-gradient(180deg,#ffe27a,#ffb300);box-shadow:0 2px 0 #b45309;position:relative;z-index:1;white-space:nowrap;overflow:hidden}',
    '.ch-btn:active{transform:translateY(1px)}',
    '.ch-btn.gem{color:#fff;background:linear-gradient(180deg,#7dd3fc,#2563eb);box-shadow:0 2px 0 #1e3a8a}',
    '.ch-btn.ready{color:#fff;background:linear-gradient(180deg,#5ef08a,#1f9e42);box-shadow:0 2px 0 #0e6b2c}',

    '#chReward{position:fixed;inset:0;z-index:9800;display:none;align-items:center;justify-content:center;background:rgba(3,10,30,.8);padding:20px}',
    '#chReward.open{display:flex}',
    '.chr-box{width:100%;max-width:330px;text-align:center;padding:20px 18px;border-radius:18px;background:linear-gradient(180deg,#1f4a94,#0f2656);border:2px solid #4b78c8;box-shadow:0 10px 40px rgba(0,0,0,.7);animation:chPop .35s ease-out}',
    '@keyframes chPop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}',
    '.chr-icon{display:flex;justify-content:center;animation:chLid .7s cubic-bezier(.2,1.3,.4,1)}',
    '@keyframes chLid{0%{transform:scale(.4) rotate(-6deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}',
    '.chr-name{font-size:19px;font-weight:900;margin:8px 0 8px;text-shadow:0 3px 0 #061433}',
    '.chr-sur{font-size:12px;font-weight:900;color:#3b1f00;background:linear-gradient(180deg,#ffe27a,#ffb300);border-radius:10px;padding:7px 8px;margin-bottom:10px;box-shadow:0 3px 0 #b45309}',
    '.chr-list{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;min-height:132px;justify-content:center}',

    '.chr-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 8px;border-radius:12px;background:rgba(2,6,23,.5);border:2px solid #3f67b8;animation:chrIn .28s ease-out}',
    '@keyframes chrIn{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}',
    '.chr-ic{font-size:40px;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.6))}',
    '.chr-t{font-size:16px;font-weight:900;color:#fff}',
    '.chr-s{font-size:13px;font-weight:900;color:#ffe27a}',
    '.chr-step{font-size:10px;font-weight:800;color:#9fc4ff;letter-spacing:.5px}',
    '.chr-done{font-size:15px;font-weight:900;color:#86efac;padding:20px 8px}',

    '.chr-ok{width:100%;padding:12px;border:0;border-radius:12px;font-size:15px;font-weight:900;color:#3b1f00;background:linear-gradient(180deg,#ffe27a,#ffb300);box-shadow:0 4px 0 #b45309;cursor:pointer}',

    '.chr-res{margin:12px 0 4px;padding:12px 10px;border-radius:14px;background:linear-gradient(180deg,#16336e,#0a1d44);border:2px solid #4b78c8;box-shadow:0 4px 0 #040d22;text-align:center}',
    '.chr-res-art{display:flex;justify-content:center;animation:chLid .7s cubic-bezier(.2,1.3,.4,1)}',
    '.chr-res-art.sm{animation:none}',
    '.chr-res-t{font-size:15px;font-weight:900;color:#fff;margin-top:6px}',
    '.chr-res-s{font-size:11.5px;color:#9fc4ff;margin-top:4px;line-height:1.35}',
    '.chr-res-prem{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px;border-radius:12px;background:rgba(2,6,23,.45);border:2px solid var(--c,#fbbf24);text-align:left}',
    '.chr-res-pt{font-size:10px;font-weight:900;color:#ffe27a;text-transform:uppercase;letter-spacing:.5px}',
    '.chr-res-pn{font-size:14px;font-weight:900;margin-top:2px}',
    '.ch-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-120px);background:linear-gradient(135deg,#22437f,#122a5e);color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;z-index:9900;border:3px solid #34c759;transition:transform .35s;font-size:13px;text-align:center;max-width:86vw}',
    '.ch-toast.show{transform:translateX(-50%) translateY(0)}'
  ].join('\n');
  document.head.appendChild(st);
}

function findAnchor(){
  const lobby = document.getElementById('lobby');
  if (lobby){
    const rule = document.getElementById('ruleBox');
    if (rule && rule.parentNode === lobby) return { host:lobby, before:rule.nextSibling };
    return { host:lobby, before:null };
  }
  const play = document.getElementById('playBtn') || document.querySelector('.play-btn');
  if (play && play.parentNode) return { host:play.parentNode, before:play };
  const nav = document.querySelector('.bottom-nav,.nav');
  if (nav && nav.parentNode) return { host:nav.parentNode, before:nav };
  return { host:document.body, before:null };
}

function build(){
  injectStyle();

  if (!document.getElementById('chSlots')){
    const a = findAnchor();
    const wrap = document.createElement('div');
    wrap.id = 'chWrap';
    wrap.innerHTML =
      '<h3>🎁 Сундуки за победы <small>1 открыт · 4 ячейки</small></h3>' +
      '<div id="chSlots"></div>';
    a.host.insertBefore(wrap, a.before);
  }

  const wrap = document.getElementById('chWrap');

  if (!document.getElementById('chReward')){
    const ov = document.createElement('div');
    ov.id = 'chReward';
    ov.innerHTML =
      '<div class="chr-box">' +
        '<div class="chr-icon"></div>' +
        '<div class="chr-name"></div>' +
        '<div class="chr-surprise"></div>' +
        '<div class="chr-list"></div>' +
        '<button class="chr-ok">Дальше</button>' +
      '</div>';
    document.body.appendChild(ov);

    ov.querySelector('.chr-ok').onclick = function(){
      if (this.dataset.done === '1'){ ov.classList.remove('open'); return; }
      nextReveal();
    };
  }

  if (wrap && !wrap.dataset.wired){
    wrap.dataset.wired = '1';
    wrap.addEventListener('click', function(e){
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const i = parseInt(b.getAttribute('data-i'), 10);
      const act = b.getAttribute('data-act');
      if (act === 'start') startOpen(i);
      else if (act === 'skip') skip(i);
      else if (act === 'claim') claim(i);
    });
  }

  render();
  setInterval(tick, 1000);
}

function hookResult(){
  if (!global.Net || typeof Net.on !== 'function') return;

  Net.on('result', function (r){
    if (!r || r.friendly) return;
    if (r.winner !== r.mySide) return;

    const key = [r.before, r.after, r.mySide, r.winner].join('|');
    if (key === lastResultKey) return;
    lastResultKey = key;

    const res = onWin(r.before || 0);
    setTimeout(function(){ showResultChest(res); }, 150);
  });
}

function start(){
  build();
  hookResult();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

global.Chests = {
  CHESTS: CHESTS,
  CARDS: CARDS,
  PREMIUM_CHANCE: PREMIUM_CHANCE,
  SURPRISE_CHANCE: SURPRISE_CHANCE,
  cardUnits: cardUnitsOf,
  render: render,
  onWin: onWin
};

})(window);