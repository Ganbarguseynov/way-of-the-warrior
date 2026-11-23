/* ============================================================
   Sport Royale — exercises.js
   Дополнение к app.js. Ничего в app.js не меняет.
   Добавляет: списки упражнений, свои упражнения с фото,
   конструктор тренировок с таймерами, анализ сожжённых калорий.
   Данные лежат в profile (cachedProfile + Supabase user_links.profile).
   ============================================================ */
(function () {
  'use strict';

  var TG = (window.Telegram && window.Telegram.WebApp) || null;

  /* ---------- утилиты ---------- */
  function alertUser(m) {
    try { if (TG && TG.showAlert) { TG.showAlert(m); return; } } catch (e) {}
    alert(m);
  }
  function lsJSON(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function dkey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function logged() { return !!(localStorage.getItem('tgId') || localStorage.getItem('linkedEmail') || localStorage.getItem('currentEmail')); }

  function prof() {
    if (typeof currentProfileData !== 'undefined' && currentProfileData) return currentProfileData;
    var p = lsJSON('cachedProfile', {});
    return p || {};
  }
  function persist() {
    var p = prof();
    try { localStorage.setItem('cachedProfile', JSON.stringify(p)); } catch (e) {}
    try {
      if (typeof saveProgressToCloud === 'function') {
        var xp = parseInt(localStorage.getItem('cachedXP') || 0, 10);
        var burned = parseInt(localStorage.getItem('cachedBurned') || 0, 10);
        saveProgressToCloud(
          localStorage.getItem('tgId'),
          localStorage.getItem('linkedEmail') || localStorage.getItem('currentEmail'),
          localStorage.getItem('userName') || 'Атлет',
          p, xp, burned
        );
      }
    } catch (e) { console.log('sync error', e); }
  }

  function getCustom() { var p = prof(); if (!Array.isArray(p.custom_exercises)) p.custom_exercises = []; return p.custom_exercises; }
  function getLists() { var p = prof(); if (!Array.isArray(p.exercise_lists)) p.exercise_lists = []; return p.exercise_lists; }
  function getLog() { var p = prof(); if (!Array.isArray(p.workout_log)) p.workout_log = []; return p.workout_log; }

  /* ---------- базовая библиотека ---------- */
  var BASE = [
    { id: 'b_squat', name: 'Приседания', rate: 8, minutes: 2, rest: 60, prep: 30 },
    { id: 'b_push', name: 'Отжимания', rate: 7, minutes: 2, rest: 60, prep: 30 },
    { id: 'b_plank', name: 'Планка', rate: 5, minutes: 1, rest: 45, prep: 20 },
    { id: 'b_lunge', name: 'Выпады', rate: 7, minutes: 2, rest: 60, prep: 30 },
    { id: 'b_run', name: 'Бег', rate: 12, minutes: 10, rest: 120, prep: 60 },
    { id: 'b_rope', name: 'Скакалка', rate: 13, minutes: 3, rest: 60, prep: 30 },
    { id: 'b_pull', name: 'Подтягивания', rate: 8, minutes: 2, rest: 90, prep: 30 },
    { id: 'b_crunch', name: 'Скручивания', rate: 6, minutes: 2, rest: 45, prep: 20 },
    { id: 'b_burpee', name: 'Берпи', rate: 12, minutes: 2, rest: 90, prep: 30 },
    { id: 'b_press', name: 'Жим гантелей', rate: 6, minutes: 3, rest: 90, prep: 30 }
  ];

  function allExercises() {
    var out = BASE.slice();
    getCustom().forEach(function (e) {
      out.push({ id: e.id, name: e.name, rate: e.rate, minutes: e.minutes, rest: e.rest, prep: e.prep, photo: e.photo, custom: true });
    });
    return out;
  }
  function findEx(id) {
    var a = allExercises();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function kcalOf(e, sets) { return Math.round(num(e.rate, 0) * num(e.minutes, 0) * (sets || 1)); }

  /* ---------- стили (только новые классы exb-) ---------- */
  function injectStyles() {
    if (document.getElementById('exb-styles')) return;
    var s = document.createElement('style');
    s.id = 'exb-styles';
    s.textContent = [
      '.exb-card{background:#1c1c1e;border:1px solid #2c2c2e;border-radius:12px;padding:12px;margin-bottom:10px;}',
      '.exb-row{display:flex;align-items:center;gap:10px;}',
      '.exb-thumb{width:46px;height:46px;border-radius:10px;object-fit:cover;background:#2c2c2e;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:18px;color:#8e8e93;}',
      '.exb-name{font-size:14px;font-weight:700;color:#fff;}',
      '.exb-sub{font-size:11px;color:#8e8e93;margin-top:2px;}',
      '.exb-kcal{font-size:13px;font-weight:700;color:#ff9f0a;white-space:nowrap;}',
      '.exb-actions{display:flex;gap:6px;margin-left:auto;}',
      '.exb-ibtn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;padding:6px 9px;font-size:12px;cursor:pointer;}',
      '.exb-ibtn.red{background:rgba(255,59,48,0.15);border-color:#ff3b30;color:#ff3b30;}',
      '.exb-ibtn.green{background:rgba(52,199,89,0.15);border-color:#34c759;color:#34c759;}',
      '.exb-empty{text-align:center;color:#8e8e93;font-size:12px;padding:12px 0;}',
      '.exb-timer{background:#1c1c1e;border:1px solid #2c2c2e;border-radius:16px;padding:18px;text-align:center;margin-bottom:12px;}',
      '.exb-phase{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8e8e93;}',
      '.exb-clock{font-size:52px;font-weight:800;color:#fff;line-height:1.1;font-variant-numeric:tabular-nums;}',
      '.exb-phase-work .exb-clock{color:#34c759;}',
      '.exb-phase-rest .exb-clock{color:#5ac8fa;}',
      '.exb-phase-prep .exb-clock{color:#ffcc00;}',
      '.exb-exname{font-size:17px;font-weight:700;color:#fff;margin-bottom:6px;}',
      '.exb-progress{height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-top:10px;}',
      '.exb-progress > div{height:100%;background:#34c759;width:0;transition:width .3s;}',
      '.exb-preview{width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-bottom:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- модалка ввода ---------- */
  function exPrompt(title, placeholder, def, cb) {
    var m = document.createElement('div');
    m.className = 'custom-modal active';
    m.innerHTML =
      '<div class="custom-modal-content">' +
        '<button class="custom-modal-close">✖</button>' +
        '<h3 style="margin-top:0;text-align:center;font-size:16px;">' + title + '</h3>' +
        '<div class="form-group"><input type="text" id="ex-prompt-input" value="' + (def || '') + '" placeholder="' + (placeholder || '') + '"></div>' +
        '<button class="btn" style="margin-top:10px;" id="ex-prompt-ok">OK</button>' +
      '</div>';
    document.body.appendChild(m);
    var inp = m.querySelector('#ex-prompt-input');
    function close() { m.remove(); }
    m.querySelector('.custom-modal-close').onclick = close;
    m.querySelector('#ex-prompt-ok').onclick = function () {
      var v = inp.value.trim(); close(); if (v) cb(v);
    };
    setTimeout(function () { inp.focus(); }, 120);
  }

  /* ---------- экраны ---------- */
  function injectScreens() {
    if (document.getElementById('ex-screen')) return;
    var host = document.createElement('div');
    host.innerHTML = [
      /* ЭКРАН УПРАЖНЕНИЙ */
      '<div id="ex-screen" class="screen"><div class="inner-screen">',
      '<button class="back-btn" onclick="closeScreen(\'ex-screen\')">← Назад</button>',
      '<h1 style="text-align:center;margin-bottom:12px;">🏋️ Упражнения</h1>',
      '<div style="display:flex;gap:8px;margin-bottom:14px;">',
      '<button class="btn" style="margin:0;flex:1;font-size:13px;padding:12px 8px;" onclick="exOpenEditor()">+ Своё упражнение</button>',
      '<button class="btn" style="margin:0;flex:1;font-size:13px;padding:12px 8px;background:#34c759;" onclick="exCreateList()">+ Новый список</button>',
      '</div>',
      '<button class="btn" style="margin:0 0 14px 0;background:#ff9f0a;color:#000;font-weight:700;" onclick="exOpenAnalysis()">📈 Анализ сожжённых калорий</button>',
      '<h3 style="margin:0 0 8px;font-size:15px;">Мои списки</h3><div id="ex-lists-box"></div>',
      '<h3 style="margin:16px 0 8px;font-size:15px;">Мои упражнения</h3><div id="ex-mine-box"></div>',
      '<h3 style="margin:16px 0 8px;font-size:15px;">Библиотека</h3><div id="ex-base-box"></div>',
      '</div></div>',

      /* РЕДАКТОР УПРАЖНЕНИЯ */
      '<div id="ex-editor-screen" class="screen"><div class="inner-screen">',
      '<button class="back-btn" onclick="closeScreen(\'ex-editor-screen\')">← Назад</button>',
      '<h1 id="ex-editor-title" style="text-align:center;margin-bottom:16px;">Новое упражнение</h1>',
      '<div class="form-group"><label>Название</label><input type="text" id="ex-f-name" placeholder="Напр. Жим лёжа"></div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">',
      '<div class="form-group" style="margin:0;"><label>Ккал / мин</label><input type="number" step="0.5" id="ex-f-rate" placeholder="8"></div>',
      '<div class="form-group" style="margin:0;"><label>Время, мин</label><input type="number" step="1" id="ex-f-dur" placeholder="3"></div>',
      '<div class="form-group" style="margin:0;"><label>Отдых, сек</label><input type="number" id="ex-f-rest" placeholder="60"></div>',
      '<div class="form-group" style="margin:0;"><label>Подготовка, сек</label><input type="number" id="ex-f-prep" placeholder="30"></div>',
      '</div>',
      '<div class="form-group"><label>Заметка</label><input type="text" id="ex-f-note" placeholder="Техника, вес снаряда..."></div>',
      '<div style="margin:14px 0;"><label style="font-size:13px;color:#8e8e93;">Фото (необязательно)</label>',
      '<div id="ex-f-photo-box" style="margin-top:8px;"></div>',
      '<input type="file" accept="image/*" id="ex-f-photo" onchange="exOnPhoto(this)" style="margin-top:8px;color:#fff;font-size:12px;"></div>',
      '<button class="btn" id="ex-f-save" onclick="exSaveExercise()">Сохранить</button>',
      '</div></div>',

      /* СПИСОК */
      '<div id="ex-list-screen" class="screen"><div class="inner-screen">',
      '<button class="back-btn" onclick="closeScreen(\'ex-list-screen\')">← Назад</button>',
      '<h1 id="ex-list-title" style="text-align:center;margin-bottom:12px;">Список</h1>',
      '<div style="display:flex;gap:8px;margin-bottom:14px;">',
      '<button class="btn" style="margin:0;flex:1;font-size:13px;padding:12px 8px;" onclick="exAddToList()">+ Упражнение</button>',
      '<button class="btn" style="margin:0;flex:1;font-size:13px;padding:12px 8px;background:#34c759;" onclick="exStartWorkout()">▶ Начать</button>',
      '</div>',
      '<div id="ex-list-box"></div>',
      '</div></div>',

      /* ТРЕНИРОВКА */
      '<div id="ex-work-screen" class="screen"><div class="inner-screen">',
      '<button class="back-btn" onclick="exLeaveWorkout()">← Выйти</button>',
      '<h1 style="text-align:center;margin-bottom:12px;">🔥 Тренировка</h1>',
      '<div id="ex-work-timer"></div>',
      '<div id="ex-work-plan"></div>',
      '</div></div>',

      /* АНАЛИЗ */
      '<div id="ex-analysis-screen" class="screen"><div class="inner-screen">',
      '<button class="back-btn" onclick="closeScreen(\'ex-analysis-screen\')">← Назад</button>',
      '<h1 style="text-align:center;margin-bottom:12px;">📈 Анализ калорий</h1>',
      '<div style="background:#1c1c1e;padding:15px;border-radius:12px;margin-bottom:12px;">',
      '<div style="display:flex;gap:10px;margin-bottom:10px;">',
      '<div style="flex:1;"><label style="font-size:11px;color:#8e8e93;">От</label><input type="date" id="exa-from" style="width:100%;padding:6px;border-radius:6px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:12px;" onchange="exRenderAnalysis()"></div>',
      '<div style="flex:1;"><label style="font-size:11px;color:#8e8e93;">До</label><input type="date" id="exa-to" style="width:100%;padding:6px;border-radius:6px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:12px;" onchange="exRenderAnalysis()"></div>',
      '</div>',
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">',
      '<button class="quick-btn" onclick="exSetPeriod(7)">7 дней</button>',
      '<button class="quick-btn" onclick="exSetPeriod(30)">30 дней</button>',
      '<button class="quick-btn" onclick="exSetPeriod(\'month\')">Этот месяц</button>',
      '</div></div>',
      '<div id="exa-cards" class="summary-box" style="border-color:#ff9f0a;background:rgba(255,159,10,0.1);"></div>',
      '<div id="exa-corr" style="font-size:12px;color:#8e8e93;margin:10px 0;line-height:1.5;"></div>',
      '<div class="chart-container"><canvas id="exa-chart1"></canvas></div>',
      '<div class="chart-container" style="margin-top:10px;"><canvas id="exa-chart2"></canvas></div>',
      '<div class="chart-container" style="margin-top:10px;"><canvas id="exa-chart3"></canvas></div>',
      '<div class="chart-container" style="margin-top:10px;"><canvas id="exa-chart4"></canvas></div>',
      '<h3 style="margin:18px 0 8px;font-size:15px;">История тренировок</h3><div id="exa-log"></div>',
      '</div></div>'
    ].join('');
    while (host.firstChild) document.body.appendChild(host.firstChild);
  }

  function injectDashboardButton() {
    var row = document.querySelector('.dash-subrow');
    if (!row || document.getElementById('exb-dash-btn')) return;
    var b = document.createElement('button');
    b.id = 'exb-dash-btn';
    b.className = 'analysis-btn';
    b.style.cssText = 'border-color:#ff9f0a;color:#ff9f0a;background:rgba(255,159,10,0.2);';
    b.innerHTML = '🏋️ Тренировки';
    b.onclick = function () { exOpen(); };
    row.appendChild(b);
  }

  /* ---------- экран упражнений ---------- */
  function exOpen() {
    if (!logged()) { alertUser('Сначала войдите в аккаунт.'); return; }
    injectDashboardButton();
    renderExercisesScreen();
    if (typeof openScreen === 'function') openScreen('ex-screen');
  }

  function renderExercisesScreen() {
    var lists = getLists(), custom = getCustom();

    var lb = document.getElementById('ex-lists-box');
    if (lb) {
      if (!lists.length) lb.innerHTML = '<div class="exb-empty">Списков пока нет. Создайте первый — например «День ног».</div>';
      else lb.innerHTML = lists.map(function (l) {
        var total = (l.items || []).reduce(function (s, it) {
          var e = findEx(it.exId); return s + (e ? kcalOf(e, it.sets) : 0);
        }, 0);
        return '<div class="exb-card"><div class="exb-row">' +
          '<div class="exb-thumb">📋</div>' +
          '<div style="min-width:0;"><div class="exb-name">' + esc(l.name) + '</div>' +
          '<div class="exb-sub">' + (l.items || []).length + ' упр. · ≈' + total + ' ккал</div></div>' +
          '<div class="exb-actions">' +
          '<button class="exb-ibtn green" onclick="exOpenList(\'' + l.id + '\')">Открыть</button>' +
          '<button class="exb-ibtn red" onclick="exDeleteList(\'' + l.id + '\')">✕</button>' +
          '</div></div></div>';
      }).join('');
    }

    var mb = document.getElementById('ex-mine-box');
    if (mb) {
      if (!custom.length) mb.innerHTML = '<div class="exb-empty">Своих упражнений пока нет. Нажмите «+ Своё упражнение».</div>';
      else mb.innerHTML = custom.map(function (e) { return exCardHTML(e, true); }).join('');
    }

    var bb = document.getElementById('ex-base-box');
    if (bb) bb.innerHTML = BASE.map(function (e) { return exCardHTML(e, false); }).join('');
  }

  function exCardHTML(e, mine) {
    var img = e.photo
      ? '<img class="exb-thumb" src="' + e.photo + '" alt="">'
      : '<div class="exb-thumb">🏋️</div>';
    var sub = num(e.rate, 0) + ' ккал/мин · ' + num(e.minutes, 0) + ' мин · отдых ' + num(e.rest, 0) + 'с · подг. ' + num(e.prep, 0) + 'с';
    var acts = mine
      ? '<button class="exb-ibtn" onclick="exOpenEditor(\'' + e.id + '\')">✎</button>' +
        '<button class="exb-ibtn red" onclick="exDeleteExercise(\'' + e.id + '\')">✕</button>'
      : '<button class="exb-ibtn" onclick="exQuickAdd(\'' + e.id + '\')">+</button>';
    return '<div class="exb-card"><div class="exb-row">' + img +
      '<div style="min-width:0;flex:1;"><div class="exb-name">' + esc(e.name) + '</div>' +
      '<div class="exb-sub">' + sub + '</div></div>' +
      '<div class="exb-kcal">' + kcalOf(e, 1) + '</div>' +
      '<div class="exb-actions">' + acts + '</div>' +
      '</div></div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ---------- создание / редактирование упражнения ---------- */
  var editId = null, photoDraft = null;

  function exOpenEditor(id) {
    editId = id || null;
    photoDraft = null;
    var e = id ? getCustom().filter(function (x) { return x.id === id; })[0] : null;
    document.getElementById('ex-editor-title').innerText = e ? 'Изменить упражнение' : 'Новое упражнение';
    document.getElementById('ex-f-name').value = e ? e.name : '';
    document.getElementById('ex-f-rate').value = e ? e.rate : '';
    document.getElementById('ex-f-dur').value = e ? e.minutes : '';
    document.getElementById('ex-f-rest').value = e ? e.rest : 60;
    document.getElementById('ex-f-prep').value = e ? e.prep : 30;
    document.getElementById('ex-f-note').value = e && e.note ? e.note : '';
    photoDraft = e && e.photo ? e.photo : null;
    renderPhotoPreview();
    document.getElementById('ex-f-photo').value = '';
    if (typeof openScreen === 'function') openScreen('ex-editor-screen');
  }

  function renderPhotoPreview() {
    var box = document.getElementById('ex-f-photo-box');
    if (!box) return;
    box.innerHTML = photoDraft
      ? '<img class="exb-preview" src="' + photoDraft + '"><button class="exb-ibtn red" onclick="exClearPhoto()">Удалить фото</button>'
      : '<div class="exb-empty" style="padding:6px 0;">Фото не выбрано</div>';
  }

  function exClearPhoto() { photoDraft = null; renderPhotoPreview(); }

  function exOnPhoto(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var max = 420, w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { photoDraft = c.toDataURL('image/jpeg', 0.6); } catch (e) { photoDraft = null; }
        renderPhotoPreview();
      };
      img.onerror = function () { alertUser('Не удалось прочитать фото.'); };
      img.src = ev.target.result;
    };
    r.onerror = function () { alertUser('Не удалось прочитать файл.'); };
    r.readAsDataURL(f);
  }

  function exSaveExercise() {
    var name = document.getElementById('ex-f-name').value.trim();
    var rate = num(document.getElementById('ex-f-rate').value, 0);
    var dur = num(document.getElementById('ex-f-dur').value, 0);
    var rest = num(document.getElementById('ex-f-rest').value, 60);
    var prep = num(document.getElementById('ex-f-prep').value, 30);
    var note = document.getElementById('ex-f-note').value.trim();

    if (!name) { alertUser('Введите название упражнения.'); return; }
    if (rate <= 0 || dur <= 0) { alertUser('Укажите ккал/мин и время больше нуля.'); return; }

    var list = getCustom();
    if (editId) {
      var e = list.filter(function (x) { return x.id === editId; })[0];
      if (e) { e.name = name; e.rate = rate; e.minutes = dur; e.rest = rest; e.prep = prep; e.note = note; e.photo = photoDraft; }
    } else {
      list.push({ id: 'c_' + uid(), name: name, rate: rate, minutes: dur, rest: rest, prep: prep, note: note, photo: photoDraft });
    }
    persist();
    editId = null; photoDraft = null;
    renderExercisesScreen();
    closeScreen('ex-editor-screen');
    alertUser('Сохранено.');
  }

  function exDeleteExercise(id) {
    if (!confirm('Удалить это упражнение? Оно исчезнет и из списков.')) return;
    var p = prof();
    p.custom_exercises = getCustom().filter(function (e) { return e.id !== id; });
    getLists().forEach(function (l) { l.items = (l.items || []).filter(function (it) { return it.exId !== id; }); });
    persist();
    renderExercisesScreen();
  }

  /* ---------- списки ---------- */
  function exCreateList() {
    exPrompt('Название списка', 'Напр. День ног', '', function (name) {
      getLists().push({ id: 'l_' + uid(), name: name, items: [] });
      persist();
      renderExercisesScreen();
    });
  }

  function exDeleteList(id) {
    if (!confirm('Удалить список?')) return;
    var p = prof();
    p.exercise_lists = getLists().filter(function (l) { return l.id !== id; });
    persist();
    renderExercisesScreen();
  }

  var currentListId = null;

  function exOpenList(id) {
    currentListId = id;
    var l = getLists().filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    document.getElementById('ex-list-title').innerText = l.name;
    renderListScreen();
    if (typeof openScreen === 'function') openScreen('ex-list-screen');
  }

  function renderListScreen() {
    var l = getLists().filter(function (x) { return x.id === currentListId; })[0];
    var box = document.getElementById('ex-list-box');
    if (!l || !box) return;
    var items = l.items || [];
    if (!items.length) { box.innerHTML = '<div class="exb-empty">Пусто. Добавьте упражнения кнопкой «+ Упражнение».</div>'; return; }
    var totalKcal = 0, totalMin = 0;
    items.forEach(function (it) {
      var e = findEx(it.exId);
      if (!e) return;
      totalKcal += kcalOf(e, it.sets);
      totalMin += num(e.minutes, 0) * it.sets;
    });
    var html = items.map(function (it, i) {
      var e = findEx(it.exId);
      if (!e) return '';
      var img = e.photo ? '<img class="exb-thumb" src="' + e.photo + '">' : '<div class="exb-thumb">🏋️</div>';
      return '<div class="exb-card"><div class="exb-row">' + img +
        '<div style="min-width:0;flex:1;"><div class="exb-name">' + esc(e.name) + '</div>' +
        '<div class="exb-sub">' + it.sets + ' × ' + num(e.minutes, 0) + ' мин · отдых ' + num(e.rest, 0) + 'с</div></div>' +
        '<div class="exb-kcal">' + kcalOf(e, it.sets) + ' ккал</div>' +
        '<div class="exb-actions">' +
        '<button class="exb-ibtn" onclick="exSets(\'' + i + '\',-1)">−</button>' +
        '<button class="exb-ibtn" onclick="exSets(\'' + i + '\',1)">+</button>' +
        '<button class="exb-ibtn red" onclick="exRemoveItem(\'' + i + '\')">✕</button>' +
        '</div></div></div>';
    }).join('');
    box.innerHTML = '<div class="summary-box" style="margin-bottom:12px;"><div class="summary-title">Итого: ' + totalKcal +
      ' ккал · ~' + Math.round(totalMin) + ' мин</div></div>' + html;
  }

  function exSets(i, d) {
    var l = getLists().filter(function (x) { return x.id === currentListId; })[0];
    if (!l || !l.items[i]) return;
    l.items[i].sets = Math.max(1, num(l.items[i].sets, 1) + d);
    persist(); renderListScreen();
  }

  function exRemoveItem(i) {
    var l = getLists().filter(function (x) { return x.id === currentListId; })[0];
    if (!l) return;
    l.items.splice(i, 1);
    persist(); renderListScreen();
  }

  function exAddToList() {
    if (!currentListId) return;
    var all = allExercises();
    var opts = all.map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + '</option>'; }).join('');
    var m = document.createElement('div');
    m.className = 'custom-modal active';
    m.innerHTML =
      '<div class="custom-modal-content">' +
      '<button class="custom-modal-close">✖</button>' +
      '<h3 style="margin-top:0;text-align:center;font-size:16px;">Добавить в список</h3>' +
      '<div class="form-group"><label>Упражнение</label><select id="ex-add-sel" style="width:100%;padding:10px;border-radius:8px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:15px;">' + opts + '</select></div>' +
      '<div class="form-group"><label>Подходов</label><input type="number" id="ex-add-sets" value="3" min="1" style="width:100%;padding:10px;border-radius:8px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:15px;"></div>' +
      '<button class="btn" id="ex-add-ok" style="margin-top:10px;">Добавить</button>' +
      '</div>';
    document.body.appendChild(m);
    function close() { m.remove(); }
    m.querySelector('.custom-modal-close').onclick = close;
    m.querySelector('#ex-add-ok').onclick = function () {
      var exId = m.querySelector('#ex-add-sel').value;
      var sets = Math.max(1, num(m.querySelector('#ex-add-sets').value, 1));
      var l = getLists().filter(function (x) { return x.id === currentListId; })[0];
      if (l) { l.items.push({ exId: exId, sets: sets }); persist(); renderListScreen(); }
      close();
    };
  }

  /* быстрый переход: добавить упражнение в существующий список / новый */
  function exQuickAdd(exId) {
    var lists = getLists();
    if (!lists.length) {
      exPrompt('Название нового списка', 'Напр. День ног', '', function (name) {
        getLists().push({ id: 'l_' + uid(), name: name, items: [{ exId: exId, sets: 3 }] });
        persist(); renderExercisesScreen();
        alertUser('Упражнение добавлено в новый список «' + name + '».');
      });
      return;
    }
    var opts = lists.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('');
    var m = document.createElement('div');
    m.className = 'custom-modal active';
    m.innerHTML =
      '<div class="custom-modal-content">' +
      '<button class="custom-modal-close">✖</button>' +
      '<h3 style="margin-top:0;text-align:center;font-size:16px;">В какой список?</h3>' +
      '<div class="form-group"><select id="ex-q-sel" style="width:100%;padding:10px;border-radius:8px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:15px;">' + opts + '</select></div>' +
      '<div class="form-group"><label>Подходов</label><input type="number" id="ex-q-sets" value="3" min="1" style="width:100%;padding:10px;border-radius:8px;background:#2c2c2e;color:#fff;border:1px solid #3a3a3c;font-size:15px;"></div>' +
      '<button class="btn" id="ex-q-ok" style="margin-top:10px;">Добавить</button>' +
      '</div>';
    document.body.appendChild(m);
    function close() { m.remove(); }
    m.querySelector('.custom-modal-close').onclick = close;
    m.querySelector('#ex-q-ok').onclick = function () {
      var lid = m.querySelector('#ex-q-sel').value;
      var sets = Math.max(1, num(m.querySelector('#ex-q-sets').value, 1));
      getLists().forEach(function (l) { if (l.id === lid) l.items.push({ exId: exId, sets: sets }); });
      persist(); renderExercisesScreen(); close();
    };
  }

  /* ============================================================
     ТАЙМЕР ТРЕНИРОВКИ
     ============================================================ */
  var TM = null, TM_INTERVAL = null;

  function exStartWorkout() {
    var l = getLists().filter(function (x) { return x.id === currentListId; })[0];
    if (!l || !l.items || !l.items.length) { alertUser('В списке нет упражнений.'); return; }
    var queue = [];
    l.items.forEach(function (it) {
      var e = findEx(it.exId);
      if (!e) return;
      for (var s = 0; s < it.sets; s++) queue.push({ ex: e, setNo: s + 1, sets: it.sets });
    });
    if (!queue.length) { alertUser('Не удалось собрать план.'); return; }

    TM = {
      name: l.name, queue: queue, i: 0, phase: 'prep',
      left: num(queue[0].ex.prep, 30), paused: false,
      kcal: 0, done: 0, elapsed: 0, finished: false
    };
    renderWorkoutScreen();
    if (typeof openScreen === 'function') openScreen('ex-work-screen');
    startTick();
  }

  function startTick() {
    stopTick();
    TM_INTERVAL = setInterval(function () {
      if (!TM || TM.finished || TM.paused) { if (TM) { TM.elapsed += 0; } return; }
      TM.elapsed++;
      TM.left--;
      if (TM.left <= 0) nextPhase();
      renderTimerOnly();
    }, 1000);
  }
  function stopTick() { if (TM_INTERVAL) { clearInterval(TM_INTERVAL); TM_INTERVAL = null; } }

  function nextPhase() {
    if (!TM) return;
    var cur = TM.queue[TM.i];
    if (TM.phase === 'prep') {
      TM.phase = 'work';
      TM.left = Math.max(1, Math.round(num(cur.ex.minutes, 1) * 60));
    } else if (TM.phase === 'work') {
      TM.kcal += num(cur.ex.rate, 0) * num(cur.ex.minutes, 0);
      TM.done++;
      var isLastSet = cur.setNo >= cur.sets;
      var isLastEx = TM.i >= TM.queue.length - 1;
      if (isLastSet && isLastEx) { finishWorkout(); return; }
      TM.phase = 'rest';
      TM.left = Math.max(1, num(cur.ex.rest, 60));
    } else if (TM.phase === 'rest') {
      TM.i++;
      var nx = TM.queue[TM.i];
      if (!nx) { finishWorkout(); return; }
      TM.phase = 'prep';
      TM.left = Math.max(1, num(nx.ex.prep, 30));
    }
    renderWorkoutScreen();
  }

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function phaseLabel() {
    if (!TM) return '';
    if (TM.phase === 'prep') return 'Подготовка';
    if (TM.phase === 'work') return 'Работа';
    return 'Отдых';
  }

  function renderTimerOnly() {
    var box = document.getElementById('ex-work-timer');
    if (!box || !TM) return;
    var cur = TM.queue[TM.i] || TM.queue[TM.queue.length - 1];
    var clock = box.querySelector('.exb-clock');
    if (clock) clock.innerText = mmss(TM.left);
    var pr = box.querySelector('.exb-progress > div');
    if (pr) pr.style.width = Math.round(TM.done / TM.queue.length * 100) + '%';
    var pn = box.querySelector('.exb-exname');
    if (pn) pn.innerText = cur.ex.name + ' · подход ' + cur.setNo + '/' + cur.sets;
  }

  function renderWorkoutScreen() {
    if (!TM) return;
    var cur = TM.queue[TM.i] || TM.queue[TM.queue.length - 1];
    var totalPlanned = TM.queue.reduce(function (s, q) { return s + num(q.ex.rate, 0) * num(q.ex.minutes, 0); }, 0);
    var timer = document.getElementById('ex-work-timer');
    timer.innerHTML =
      '<div class="exb-timer exb-phase-' + TM.phase + '">' +
      '<div class="exb-phase">' + phaseLabel() + '</div>' +
      '<div class="exb-clock">' + mmss(TM.left) + '</div>' +
      '<div class="exb-exname">' + esc(cur.ex.name) + ' · подход ' + cur.setNo + '/' + cur.sets + '</div>' +
      '<div class="exb-sub">Сожжено: <b style="color:#ff9f0a">' + Math.round(TM.kcal) + '</b> из ~' + Math.round(totalPlanned) + ' ккал · ' + mmss(TM.elapsed) + '</div>' +
      '<div class="exb-progress"><div style="width:' + Math.round(TM.done / TM.queue.length * 100) + '%"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;">' +
      '<button class="exb-ibtn" style="flex:1;padding:10px;" onclick="exTogglePause()">' + (TM.paused ? '▶ Продолжить' : '⏸ Пауза') + '</button>' +
      '<button class="exb-ibtn" style="flex:1;padding:10px;" onclick="exSkipPhase()">⏭ Дальше</button>' +
      '<button class="exb-ibtn red" style="flex:1;padding:10px;" onclick="exFinishNow()">Завершить</button>' +
      '</div></div>';

    var plan = document.getElementById('ex-work-plan');
    plan.innerHTML = TM.queue.map(function (q, idx) {
      var mark = idx < TM.i || (idx === TM.i && TM.phase === 'rest') ? '✅' : (idx === TM.i ? '▶' : '•');
      return '<div class="exb-card" style="padding:8px 12px;"><div class="exb-row">' +
        '<div style="width:16px;text-align:center;font-size:12px;color:#8e8e93;">' + mark + '</div>' +
        '<div style="min-width:0;flex:1;"><div class="exb-name" style="font-size:13px;">' + esc(q.ex.name) + '</div>' +
        '<div class="exb-sub">подход ' + q.setNo + '/' + q.sets + ' · ' + Math.round(num(q.ex.rate, 0) * num(q.ex.minutes, 0)) + ' ккал</div></div>' +
        '</div></div>';
    }).join('');
  }

  function exTogglePause() { if (TM) { TM.paused = !TM.paused; renderWorkoutScreen(); } }
  function exSkipPhase() { if (TM && !TM.finished) { TM.left = 0; nextPhase(); } }
  function exFinishNow() {
    if (!TM) return;
    if (!confirm('Завершить тренировку сейчас?')) return;
    finishWorkout();
  }

  function finishWorkout() {
    stopTick();
    if (!TM) return;
    TM.finished = true;
    var kcal = Math.round(TM.kcal);
    var minutes = Math.round(TM.elapsed / 60);

    getLog().unshift({
      id: 'w_' + uid(),
      date: dkey(new Date()),
      name: TM.name || 'Тренировка',
      kcal: kcal,
      minutes: minutes,
      sets: TM.done
    });
    var p = prof();
    if (p.workout_log.length > 400) p.workout_log.length = 400;

    var nb = parseInt(localStorage.getItem('cachedBurned') || 0, 10) + kcal;
    localStorage.setItem('cachedBurned', String(nb));
    var bEl = document.getElementById('burned-total');
    if (bEl) bEl.innerText = nb + ' ккал';

    persist();

    if (typeof showMotivationToast === 'function') {
      showMotivationToast('Тренировка завершена! 🔥', 'Сожжено ' + kcal + ' ккал за ' + minutes + ' мин. Так держать!', '🔥');
    } else {
      alertUser('Готово! Сожжено ' + kcal + ' ккал.');
    }

    TM = null;
    document.getElementById('ex-work-timer').innerHTML = '';
    document.getElementById('ex-work-plan').innerHTML = '';
    renderExercisesScreen();
    closeScreen('ex-work-screen');
  }

  function exLeaveWorkout() {
    if (TM && !TM.finished) {
      if (!confirm('Выйти без сохранения результата?')) return;
    }
    stopTick();
    TM = null;
    closeScreen('ex-work-screen');
  }

  /* ============================================================
     АНАЛИЗ
     ============================================================ */
  var charts = {};

  function exOpenAnalysis() {
    var to = new Date(), from = new Date();
    from.setDate(to.getDate() - 6);
    document.getElementById('exa-from').value = dkey(from);
    document.getElementById('exa-to').value = dkey(to);
    if (typeof openScreen === 'function') openScreen('ex-analysis-screen');
    setTimeout(exRenderAnalysis, 120);
  }

  function exSetPeriod(range) {
    var now = new Date();
    var toEl = document.getElementById('exa-to'), fromEl = document.getElementById('exa-from');
    toEl.value = dkey(now);
    if (range === 'month') {
      fromEl.value = dkey(new Date(now.getFullYear(), now.getMonth(), 1));
    } else {
      var a = new Date(now); a.setDate(now.getDate() - (range - 1));
      fromEl.value = dkey(a);
    }
    exRenderAnalysis();
  }

  function pearson(xs, ys) {
    var px = [], py = [];
    for (var i = 0; i < xs.length; i++) {
      if (xs[i] != null && ys[i] != null) { px.push(xs[i]); py.push(ys[i]); }
    }
    var n = px.length;
    if (n < 3) return null;
    var mx = 0, my = 0;
    for (var j = 0; j < n; j++) { mx += px[j]; my += py[j]; }
    mx /= n; my /= n;
    var nume = 0, dx = 0, dy = 0;
    for (var k = 0; k < n; k++) {
      var a = px[k] - mx, b = py[k] - my;
      nume += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;
    return nume / Math.sqrt(dx * dy);
  }

  function corrWord(r) {
    if (r == null) return 'мало данных';
    var a = Math.abs(r);
    var lvl = a < 0.2 ? 'очень слабая' : a < 0.4 ? 'слабая' : a < 0.6 ? 'умеренная' : a < 0.8 ? 'заметная' : 'сильная';
    return lvl + (r < 0 ? ' обратная' : ' прямая') + ' (' + r.toFixed(2) + ')';
  }

  function exRenderAnalysis() {
    if (typeof Chart === 'undefined') return;
    var from = document.getElementById('exa-from').value;
    var to = document.getElementById('exa-to').value;
    if (!from || !to) return;

    var foodHist = lsJSON('foodHistory', {});
    var waterHist = lsJSON('waterHistory', {});
    var weights = lsJSON('weightHistory', []);
    var log = getLog();

    var labels = [], burned = [], eaten = [], water = [], weight = [];
    var lastW = null;

    for (var d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      var key = dkey(d);
      labels.push(key.split('-').slice(1).reverse().join('.'));

      var b = 0;
      log.forEach(function (w) { if (w.date === key) b += num(w.kcal, 0); });
      burned.push(Math.round(b));

      var e = 0;
      (foodHist[key] || []).forEach(function (x) {
        e += num(x.calories_100g != null ? x.calories_100g : x.calories, 0);
      });
      eaten.push(Math.round(e));

      var w2 = 0;
      (waterHist[key] || []).forEach(function (x) { w2 += num(x.amount, 0); });
      water.push(Math.round(w2));

      var found = null;
      for (var i = 0; i < weights.length; i++) {
        if (weights[i].dateRaw === key) { found = num(weights[i].weight, null); break; }
      }
      if (found != null) lastW = found;
      weight.push(lastW);
    }

    /* карточки */
    var sumB = burned.reduce(function (a, b) { return a + b; }, 0);
    var sumE = eaten.reduce(function (a, b) { return a + b; }, 0);
    var sumW = water.reduce(function (a, b) { return a + b; }, 0);
    var days = labels.length || 1;
    var wStart = weight.filter(function (v) { return v != null; })[0];
    var wEnd = weight.filter(function (v) { return v != null; }).slice(-1)[0];
    var wDiff = (wStart != null && wEnd != null) ? (wEnd - wStart) : null;

    var cards = document.getElementById('exa-cards');
    cards.innerHTML =
      '<div class="summary-title">Сожжено: ' + sumB + ' ккал за ' + labels.length + ' дн.</div>' +
      '<div class="summary-grid">' +
      '<div><span style="color:#ff9f0a;font-weight:bold;font-size:16px;">' + Math.round(sumB / days) + '</span><br><span style="font-size:10px;color:#8e8e93;">Ккал/день</span></div>' +
      '<div><span style="color:#ff3b30;font-weight:bold;font-size:16px;">' + sumE + '</span><br><span style="font-size:10px;color:#8e8e93;">Съедено</span></div>' +
      '<div><span style="color:#5ac8fa;font-weight:bold;font-size:16px;">' + sumW + '</span><br><span style="font-size:10px;color:#8e8e93;">Вода, мл</span></div>' +
      '<div><span style="color:#fff;font-weight:bold;font-size:16px;">' + (wDiff == null ? '—' : (wDiff > 0 ? '+' : '') + wDiff.toFixed(1)) + '</span><br><span style="font-size:10px;color:#8e8e93;">Вес, кг</span></div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:12px;color:#fff;">Баланс (съедено − сожжено): <b style="color:' + (sumE - sumB > 0 ? '#ff3b30' : '#34c759') + '">' + (sumE - sumB) + ' ккал</b></div>';

    /* корреляции */
    var balance = labels.map(function (_, i) { return eaten[i] - burned[i]; });
    document.getElementById('exa-corr').innerHTML =
      'Сожжённые ↔ вес: <b style="color:#fff;">' + corrWord(pearson(burned, weight)) + '</b><br>' +
      'Сожжённые ↔ еда: <b style="color:#fff;">' + corrWord(pearson(burned, eaten)) + '</b><br>' +
      'Сожжённые ↔ вода: <b style="color:#fff;">' + corrWord(pearson(burned, water)) + '</b><br>' +
      'Баланс калорий в среднем: <b style="color:#fff;">' + Math.round(balance.reduce(function (a, b) { return a + b; }, 0) / days) + ' ккал/день</b>';

    var grid = { color: 'rgba(255,255,255,0.08)' };
    var ticks = { color: '#8e8e93', font: { size: 10 } };

    function mk(id, cfg) {
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(document.getElementById(id).getContext('2d'), cfg);
    }

    mk('exa-chart1', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Сожжено', data: burned, backgroundColor: '#ff9f0a', borderRadius: 4, yAxisID: 'y' },
          { label: 'Съедено', data: eaten, type: 'line', borderColor: '#ff3b30', backgroundColor: '#ff3b3033', borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false, yAxisID: 'y' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff', font: { size: 10 } } }, title: { display: true, text: 'Сожжено vs Съедено (ккал)', color: '#fff' } },
        scales: { x: { ticks: ticks, grid: grid }, y: { beginAtZero: true, ticks: ticks, grid: grid } }
      }
    });

    mk('exa-chart2', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'Баланс', data: balance, borderColor: '#af52de', backgroundColor: '#af52de33', borderWidth: 2, pointRadius: 2, tension: 0.3, fill: true }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: 'Баланс калорий (съедено − сожжено)', color: '#fff' } },
        scales: { x: { ticks: ticks, grid: grid }, y: { ticks: ticks, grid: grid } }
      }
    });

    mk('exa-chart3', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Сожжено', data: burned, backgroundColor: 'rgba(255,159,10,0.65)', borderRadius: 4, yAxisID: 'y' },
          { label: 'Вес, кг', data: weight, type: 'line', borderColor: '#ffcc00', borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff', font: { size: 10 } } }, title: { display: true, text: 'Сожжённые калории и вес', color: '#fff' } },
        scales: {
          x: { ticks: ticks, grid: grid },
          y: { beginAtZero: true, position: 'left', ticks: ticks, grid: grid },
          y1: { position: 'right', ticks: ticks, grid: { drawOnChartArea: false } }
        }
      }
    });

    mk('exa-chart4', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Вода, мл', data: water, backgroundColor: 'rgba(90,200,250,0.55)', borderRadius: 4, yAxisID: 'y' },
          { label: 'Сожжено', data: burned, type: 'line', borderColor: '#ff9f0a', borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff', font: { size: 10 } } }, title: { display: true, text: 'Вода и сожжённые калории', color: '#fff' } },
        scales: {
          x: { ticks: ticks, grid: grid },
          y: { beginAtZero: true, position: 'left', ticks: ticks, grid: grid },
          y1: { beginAtZero: true, position: 'right', ticks: ticks, grid: { drawOnChartArea: false } }
        }
      }
    });

    /* история тренировок */
    var inRange = log.filter(function (w) { return w.date >= from && w.date <= to; });
    var logBox = document.getElementById('exa-log');
    if (!inRange.length) {
      logBox.innerHTML = '<div class="exb-empty">За этот период тренировок нет. Запустите тренировку из списка — и здесь появится статистика.</div>';
    } else {
      logBox.innerHTML = inRange.map(function (w) {
        return '<div class="exb-card" style="padding:10px 12px;"><div class="exb-row">' +
          '<div class="exb-thumb" style="width:38px;height:38px;">🔥</div>' +
          '<div style="min-width:0;flex:1;"><div class="exb-name" style="font-size:13px;">' + esc(w.name) + '</div>' +
          '<div class="exb-sub">' + w.date.split('-').reverse().join('.') + ' · ' + (w.minutes || 0) + ' мин · ' + (w.sets || 0) + ' подходов</div></div>' +
          '<div class="exb-kcal">' + num(w.kcal, 0) + ' ккал</div>' +
          '</div></div>';
      }).join('');
    }
  }

  /* ---------- инициализация ---------- */
  function init() {
    injectStyles();
    injectScreens();
    injectDashboardButton();
  }

  window.exOpen = exOpen;
  window.exOpenEditor = exOpenEditor;
  window.exSaveExercise = exSaveExercise;
  window.exDeleteExercise = exDeleteExercise;
  window.exOnPhoto = exOnPhoto;
  window.exClearPhoto = exClearPhoto;
  window.exCreateList = exCreateList;
  window.exDeleteList = exDeleteList;
  window.exOpenList = exOpenList;
  window.exAddToList = exAddToList;
  window.exQuickAdd = exQuickAdd;
  window.exSets = exSets;
  window.exRemoveItem = exRemoveItem;
  window.exStartWorkout = exStartWorkout;
  window.exTogglePause = exTogglePause;
  window.exSkipPhase = exSkipPhase;
  window.exFinishNow = exFinishNow;
  window.exLeaveWorkout = exLeaveWorkout;
  window.exOpenAnalysis = exOpenAnalysis;
  window.exSetPeriod = exSetPeriod;
  window.exRenderAnalysis = exRenderAnalysis;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();