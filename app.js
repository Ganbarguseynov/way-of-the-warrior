// Sport Royale - Main Application
const SUPABASE_URL = 'https://qnpriwfxzuoymoumdtrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1jTWcnb3WvNMi79DXYU7Tw_RWKIVcsF';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentUser = null;
let userStats = { xp: 0, level: 1, totalCalories: 0, totalWorkouts: 0, streak: 0 };
let exercises = [
  { id: 1, name: 'Приседания', calories: 8, difficulty: 'средняя', duration: 30, rest: 60, prep: 30, image: null, custom: false },
  { id: 2, name: 'Отжимания', calories: 7, difficulty: 'средняя', duration: 20, rest: 60, prep: 30, image: null, custom: false },
  { id: 3, name: 'Бег', calories: 12, difficulty: 'высокая', duration: 60, rest: 60, prep: 30, image: null, custom: false },
  { id: 4, name: 'Прыжки', calories: 10, difficulty: 'высокая', duration: 45, rest: 60, prep: 30, image: null, custom: false },
  { id: 5, name: 'Планка', calories: 6, difficulty: 'средняя', duration: 40, rest: 60, prep: 30, image: null, custom: false }
];

let currentWorkout = [];
let foodDiary = JSON.parse(localStorage.getItem('foodDiary')) || [];
let waterDiary = JSON.parse(localStorage.getItem('waterDiary')) || [];
let weightDiary = JSON.parse(localStorage.getItem('weightDiary')) || [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
});

async function checkAuth() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      currentUser = user;
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('mainContent').style.display = 'flex';
      await loadUserRecord();
      showMainScreen();
    } else {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
    }
  } catch (err) {
    document.getElementById('authScreen').style.display = 'flex';
  }
}

async function loginWithTelegram() {
  const user = tg.initDataUnsafe.user;
  if (!user) { alert('Telegram недоступен'); return; }

  const email = `telegram_${user.id}@sportapp.local`;
  const password = `tg_${user.id}`;

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && error.status === 400) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (!signUpError) {
      currentUser = signUpData.user;
      await createUserRecord();
      await checkAuth();
    }
  } else if (!error && data.user) {
    currentUser = data.user;
    await checkAuth();
  }
}

async function handleEmailAuth() {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;

  if (!email || !password) { alert('Заполните поля'); return; }

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && error.status === 400) {
    const { data: signUpData } = await supabase.auth.signUp({ email, password });
    if (signUpData.user) {
      currentUser = signUpData.user;
      await createUserRecord();
      await checkAuth();
    }
  } else if (data.user) {
    currentUser = data.user;
    await checkAuth();
  }
}

async function createUserRecord() {
  await supabase.from('users').insert([{ id: currentUser.id, email: currentUser.email, xp: 0, level: 1 }]);
}

async function loadUserRecord() {
  const { data } = await supabase.from('users').select('*').eq('id', currentUser.id).single();
  if (data) {
    userStats = { xp: data.xp || 0, level: data.level || 1, totalCalories: data.total_calories || 0, totalWorkouts: data.total_workouts || 0, streak: data.streak || 0 };
  }
  await loadCustomExercises();
}

async function loadCustomExercises() {
  if (!currentUser) return;
  const { data } = await supabase.from('custom_exercises').select('*').eq('user_id', currentUser.id);
  if (data) {
    data.forEach(ex => {
      exercises.push({ id: ex.id, name: ex.name, calories: ex.calories, difficulty: ex.difficulty, duration: ex.duration, rest: ex.rest || 60, prep: ex.prep || 30, image: ex.image_url, custom: true });
    });
  }
}

async function saveProgressToCloud() {
  if (!currentUser) return;
  await supabase.from('users').update({ xp: userStats.xp, level: userStats.level, total_calories: userStats.totalCalories, total_workouts: userStats.totalWorkouts, streak: userStats.streak }).eq('id', currentUser.id);
}

function showMainScreen() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('mainScreen').style.display = 'flex';
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const levelEl = document.getElementById('displayLevel');
  const xpEl = document.getElementById('displayXP');
  const caloriesEl = document.getElementById('displayCalories');
  if (levelEl) levelEl.textContent = userStats.level;
  if (xpEl) xpEl.textContent = `${userStats.xp}/${userStats.level * 100}`;
  if (caloriesEl) caloriesEl.textContent = userStats.totalCalories;
}

// ЭКРАН УПРАЖНЕНИЙ
function showExerciseScreen() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('exerciseScreen').style.display = 'block';
  renderExercises();
}

function renderExercises() {
  const container = document.getElementById('exercisesList');
  if (!container) return;
  container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      ${ex.image ? `<img src="${ex.image}" alt="${ex.name}">` : '<div>Фото</div>'}
      <h3>${ex.name}</h3>
      <p>Калории: ${ex.calories} | ${ex.difficulty}</p>
      <p>Время: ${ex.duration}м | Отдых: ${ex.rest}с | Подготовка: ${ex.prep}с</p>
      ${ex.custom ? `<button onclick="deleteExercise(${ex.id})">Удалить</button>` : ''}
    </div>
  `).join('');
}

function showAddExerciseModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:8px;width:90%;max-width:400px;">
      <h3>Добавить упражнение</h3>
      <input type="text" id="exerciseName" placeholder="Название" style="width:100%;padding:8px;margin:10px 0;">
      <input type="number" id="exerciseCalories" placeholder="Калории" style="width:100%;padding:8px;margin:10px 0;" min="1">
      <select id="exerciseDifficulty" style="width:100%;padding:8px;margin:10px 0;">
        <option>низкая</option><option selected>средняя</option><option>высокая</option>
      </select>
      <input type="number" id="exerciseDuration" placeholder="Длительность (мин)" style="width:100%;padding:8px;margin:10px 0;" min="1">
      <input type="number" id="exerciseRest" placeholder="Отдых (сек)" style="width:100%;padding:8px;margin:10px 0;" value="60">
      <input type="number" id="exercisePrep" placeholder="Подготовка (сек)" style="width:100%;padding:8px;margin:10px 0;" value="30">
      <input type="file" id="exercisePhoto" accept="image/*" style="width:100%;margin:10px 0;">
      <button onclick="saveNewExercise()" style="width:100%;padding:10px;background:#4CAF50;color:white;border:none;margin:10px 0;">Сохранить</button>
      <button onclick="document.querySelector('.modal').remove()" style="width:100%;padding:10px;background:#ccc;">Отмена</button>
    </div>
  `;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
  document.body.appendChild(modal);
}

async function saveNewExercise() {
  const name = document.getElementById('exerciseName').value;
  const calories = parseInt(document.getElementById('exerciseCalories').value);
  const difficulty = document.getElementById('exerciseDifficulty').value;
  const duration = parseInt(document.getElementById('exerciseDuration').value);
  const rest = parseInt(document.getElementById('exerciseRest').value) || 60;
  const prep = parseInt(document.getElementById('exercisePrep').value) || 30;
  const photoFile = document.getElementById('exercisePhoto').files[0];

  if (!name || !calories || !duration) { alert('Заполните обязательные поля'); return; }

  let photoURL = null;
  if (photoFile && currentUser) {
    const filename = `exercises/${currentUser.id}/${Date.now()}_${photoFile.name}`;
    const { error } = await supabase.storage.from('exercise-photos').upload(filename, photoFile);
    if (!error) {
      const { data } = supabase.storage.from('exercise-photos').getPublicUrl(filename);
      photoURL = data.publicUrl;
    }
  }

  if (currentUser) {
    const { data } = await supabase.from('custom_exercises').insert([{ user_id: currentUser.id, name, calories, difficulty, duration, rest, prep, image_url: photoURL }]).select();
    if (data) {
      exercises.push({ id: data[0].id, name, calories, difficulty, duration, rest, prep, image: photoURL, custom: true });
    }
  }

  document.querySelector('.modal').remove();
  renderExercises();
}

function deleteExercise(id) {
  exercises = exercises.filter(e => e.id !== id);
  if (currentUser) supabase.from('custom_exercises').delete().eq('id', id);
  renderExercises();
}

// КОНСТРУКТОР ТРЕНИРОВОК
function showWorkoutBuilder() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('workoutScreen').style.display = 'block';
  renderAvailableExercises();
  updateWorkoutDisplay();
}

function renderAvailableExercises() {
  const container = document.getElementById('availableExercises');
  if (!container) return;
  container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      <h3>${ex.name}</h3>
      <p>Калории: ${ex.calories}</p>
      <button onclick="addToWorkout(${ex.id})">Добавить</button>
    </div>
  `).join('');
}

function addToWorkout(id) {
  const ex = exercises.find(e => e.id === id);
  if (ex) currentWorkout.push({...ex});
  updateWorkoutDisplay();
}

function updateWorkoutDisplay() {
  const list = document.getElementById('workoutList');
  const cal = document.getElementById('totalCalories');
  const time = document.getElementById('totalTime');
  if (!list) return;
  const totalCal = currentWorkout.reduce((s, e) => s + e.calories, 0);
  const totalTime = currentWorkout.reduce((s, e) => s + e.duration, 0);
  cal.textContent = totalCal;
  time.textContent = totalTime;
  list.innerHTML = currentWorkout.map((ex, idx) => `<div>${ex.name} (${ex.calories}ккал)<button onclick="removeFromWorkout(${idx})">✕</button></div>`).join('');
}

function removeFromWorkout(idx) {
  currentWorkout.splice(idx, 1);
  updateWorkoutDisplay();
}

async function completeWorkout() {
  if (!currentUser) { alert('Авторизуйтесь'); return; }
  if (currentWorkout.length === 0) { alert('Добавьте упражнения'); return; }

  const totalCal = currentWorkout.reduce((s, e) => s + e.calories, 0);
  const totalTime = currentWorkout.reduce((s, e) => s + e.duration, 0);
  
  userStats.totalCalories += totalCal;
  userStats.totalWorkouts += 1;
  userStats.xp += Math.floor(totalCal / 2);

  if (userStats.xp >= userStats.level * 100) {
    userStats.level += 1;
    userStats.xp = 0;
  }

  await supabase.from('workouts').insert([{ user_id: currentUser.id, exercises: JSON.stringify(currentWorkout), calories: totalCal, duration: totalTime, completed_at: new Date() }]);
  await saveProgressToCloud();
  
  currentWorkout = [];
  alert(`Тренировка завершена! +${totalCal} ккал`);
  showMainScreen();
}

// ДНЕВНИКИ
function showWeightScreen() {
  if (!currentUser) { alert('Авторизуйтесь'); return; }
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('weightScreen').style.display = 'block';
  loadWeightHistory();
  setTimeout(() => plotWeightChart(), 100);
}

function addWeight() {
  if (!currentUser) return;
  const weight = parseFloat(document.getElementById('weightInput').value);
  if (!weight) return;
  const entry = { date: new Date().toISOString(), weight };
  weightDiary.push(entry);
  localStorage.setItem('weightDiary', JSON.stringify(weightDiary));
  supabase.from('weight_diary').insert([{ user_id: currentUser.id, weight, recorded_at: new Date() }]);
  document.getElementById('weightInput').value = '';
  loadWeightHistory();
  plotWeightChart();
}

function loadWeightHistory() {
  const container = document.getElementById('weightHistory');
  if (!container) return;
  container.innerHTML = weightDiary.slice().reverse().map(e => {
    const date = new Date(e.date).toLocaleDateString('ru-RU');
    return `<div>${date}: ${e.weight} кг</div>`;
  }).join('');
}

function plotWeightChart() {
  const canvas = document.getElementById('weightChart');
  if (!canvas || weightDiary.length === 0) return;
  const ctx = canvas.getContext('2d');
  const sorted = weightDiary.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const weights = sorted.map(e => e.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((e, i) => {
    const x = (i / (sorted.length - 1 || 1)) * (canvas.width - 20) + 10;
    const y = canvas.height - ((e.weight - minW) / range) * (canvas.height - 40) - 20;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function showFoodScreen() {
  if (!currentUser) { alert('Авторизуйтесь'); return; }
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('foodScreen').style.display = 'block';
  loadFoodHistory();
  setTimeout(() => plotFoodChart(), 100);
}

function addFood() {
  if (!currentUser) return;
  const name = document.getElementById('foodName').value;
  const calories = parseInt(document.getElementById('foodCalories').value);
  if (!name || !calories) return;
  const entry = { date: new Date().toISOString(), name, calories };
  foodDiary.push(entry);
  localStorage.setItem('foodDiary', JSON.stringify(foodDiary));
  supabase.from('food_diary').insert([{ user_id: currentUser.id, name, calories, recorded_at: new Date() }]);
  document.getElementById('foodName').value = '';
  document.getElementById('foodCalories').value = '';
  loadFoodHistory();
  plotFoodChart();
}

function loadFoodHistory() {
  const container = document.getElementById('foodHistory');
  if (!container) return;
  const today = new Date().toDateString();
  const todayFood = foodDiary.filter(e => new Date(e.date).toDateString() === today);
  const totalCal = todayFood.reduce((s, e) => s + e.calories, 0);
  container.innerHTML = `<div>Сегодня: ${totalCal} ккал</div>` + foodDiary.slice().reverse().map(e => {
    const date = new Date(e.date).toLocaleDateString('ru-RU');
    return `<div>${date}: ${e.name} (${e.calories} ккал)</div>`;
  }).join('');
}

function plotFoodChart() {
  const canvas = document.getElementById('foodChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayFood = foodDiary.filter(e => new Date(e.date).toDateString() === date.toDateString());
    const total = dayFood.reduce((s, e) => s + e.calories, 0);
    last7.push(total);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FF9800';
  const maxCal = Math.max(...last7, 1);
  const barW = canvas.width / 7;
  last7.forEach((cal, i) => {
    const h = (cal / maxCal) * (canvas.height - 40);
    const x = i * barW + 5;
    const y = canvas.height - h - 20;
    ctx.fillRect(x, y, barW - 10, h);
  });
}

function showWaterScreen() {
  if (!currentUser) { alert('Авторизуйтесь'); return; }
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('waterScreen').style.display = 'block';
  loadWaterHistory();
  setTimeout(() => plotWaterChart(), 100);
}

function addWater() {
  if (!currentUser) return;
  const amount = parseInt(document.getElementById('waterAmount').value);
  if (!amount) return;
  const entry = { date: new Date().toISOString(), amount };
  waterDiary.push(entry);
  localStorage.setItem('waterDiary', JSON.stringify(waterDiary));
  supabase.from('water_diary').insert([{ user_id: currentUser.id, amount, recorded_at: new Date() }]);
  loadWaterHistory();
  plotWaterChart();
}

function loadWaterHistory() {
  const container = document.getElementById('waterHistory');
  if (!container) return;
  const today = new Date().toDateString();
  const todayWater = waterDiary.filter(e => new Date(e.date).toDateString() === today);
  const totalW = todayWater.reduce((s, e) => s + e.amount, 0);
  container.innerHTML = `<div>Сегодня: ${totalW} мл (${(totalW/250).toFixed(1)} стаканов)</div>` + waterDiary.slice().reverse().map(e => {
    const time = new Date(e.date).toLocaleTimeString('ru-RU');
    return `<div>${time}: +${e.amount} мл</div>`;
  }).join('');
}

function plotWaterChart() {
  const canvas = document.getElementById('waterChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayWater = waterDiary.filter(e => new Date(e.date).toDateString() === date.toDateString());
    const total = dayWater.reduce((s, e) => s + e.amount, 0);
    last7.push(total);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2196F3';
  const maxW = Math.max(...last7, 1000);
  const barW = canvas.width / 7;
  last7.forEach((w, i) => {
    const h = (w / maxW) * (canvas.height - 40);
    const x = i * barW + 5;
    const y = canvas.height - h - 20;
    ctx.fillRect(x, y, barW - 10, h);
  });
}

function showAnalysis() {
  if (!currentUser) { alert('Авторизуйтесь'); return; }
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('analysisScreen').style.display = 'block';
  updateAnalysisStats();
}

function updateAnalysisStats() {
  const consumed = foodDiary.reduce((s, e) => s + e.calories, 0);
  document.getElementById('burnedCaloriesTotal').textContent = userStats.totalCalories;
  document.getElementById('consumedCaloriesTotal').textContent = consumed;
  document.getElementById('caloriesBalance').textContent = userStats.totalCalories - consumed;
}

function setupEventListeners() {
  document.getElementById('loginTelegramBtn')?.addEventListener('click', loginWithTelegram);
  document.getElementById('loginEmailBtn')?.addEventListener('click', handleEmailAuth);
}