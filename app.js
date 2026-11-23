// Sport Royale - Main Application
const SUPABASE_URL = 'https://qnpriwfxzuoymoumdtrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1jTWcnb3WvNMi79DXYU7Tw_RWKIVcsF';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentUser = null;
let userStats = {
  xp: 0,
  level: 1,
  totalCalories: 0,
  totalWorkouts: 0,
  streak: 0
};

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
let exerciseLists = JSON.parse(localStorage.getItem('exerciseLists')) || {};

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  checkChessAccess();
  setupEventListeners();
});

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    currentUser = user;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    loadUserRecord();
    showMainScreen();
  }
}

async function checkChessAccess() {
  if (!currentUser) return;
  
  try {
    const result = await supabase.rpc('has_feature', {
      p_user_id: currentUser.id,
      p_feature: 'chess'
    });
    
    const chessBtn = document.getElementById('chessBtn');
    if (chessBtn) {
      chessBtn.style.display = (currentUser.id === 'ganbar_id' || result) ? 'block' : 'none';
    }
  } catch (error) {
    const chessBtn = document.getElementById('chessBtn');
    if (chessBtn) chessBtn.style.display = 'none';
  }
}

async function loginWithTelegram() {
  const user = tg.initDataUnsafe.user;
  
  if (!user) {
    alert('Telegram данные недоступны');
    return;
  }

  const email = `telegram_${user.id}@sportapp.local`;
  const password = `tg_${user.id}_${user.id}`;

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && error.status === 400) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          telegram_id: user.id,
          username: user.username || user.first_name
        }
      }
    });

    if (!signUpError) {
      currentUser = signUpData.user;
      await createUserRecord();
      checkAuth();
    }
  } else if (!error) {
    currentUser = data.user;
    checkAuth();
  }
}

async function handleEmailAuth() {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;

  if (!email || !password) {
    alert('Заполните email и пароль');
    return;
  }

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && error.status === 400) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (!signUpError) {
      currentUser = signUpData.user;
      await createUserRecord();
      checkAuth();
    }
  } else if (!error) {
    currentUser = data.user;
    checkAuth();
  }
}

async function createUserRecord() {
  const { error } = await supabase
    .from('users')
    .insert([{
      id: currentUser.id,
      email: currentUser.email,
      xp: 0,
      level: 1,
      created_at: new Date()
    }]);
}

async function loadUserRecord() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (data) {
    userStats = {
      xp: data.xp || 0,
      level: data.level || 1,
      totalCalories: data.total_calories || 0,
      totalWorkouts: data.total_workouts || 0,
      streak: data.streak || 0
    };
  }
  
  loadCustomExercises();
}

async function loadCustomExercises() {
  if (!currentUser) return;
  
  const { data, error } = await supabase
    .from('custom_exercises')
    .select('*')
    .eq('user_id', currentUser.id);

  if (data) {
    data.forEach(ex => {
      exercises.push({
        id: ex.id,
        name: ex.name,
        calories: ex.calories,
        difficulty: ex.difficulty,
        duration: ex.duration,
        rest: ex.rest || 60,
        prep: ex.prep || 30,
        image: ex.image_url,
        custom: true
      });
    });
  }
}

async function saveProgressToCloud() {
  if (!currentUser) return;

  await supabase
    .from('users')
    .update({
      xp: userStats.xp,
      level: userStats.level,
      total_calories: userStats.totalCalories,
      total_workouts: userStats.totalWorkouts,
      streak: userStats.streak,
      updated_at: new Date()
    })
    .eq('id', currentUser.id);
}

// ==================== ЭКРАНЫ ====================

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.style.display = 'none';
  });
}

function showMainScreen() {
  hideAllScreens();
  document.getElementById('mainScreen').style.display = 'flex';
  updateStatsDisplay();
}

function showExerciseScreen() {
  hideAllScreens();
  document.getElementById('exerciseScreen').style.display = 'block';
  renderExercises();
}

function renderExercises() {
  const container = document.getElementById('exercisesList');
  if (!container) return;

  container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      ${ex.image ? `<img src="${ex.image}" alt="${ex.name}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;">` : '<div style="width:100%;height:150px;background:#ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;">Фото</div>'}
      <h3 style="margin:10px 0 5px 0;">${ex.name}</h3>
      <p style="margin:0;font-size:12px;">Калории: ${ex.calories} | Сложность: ${ex.difficulty}</p>
      <p style="margin:5px 0;font-size:12px;">Время: ${ex.duration}м | Отдых: ${ex.rest}с | Подготовка: ${ex.prep}с</p>
      ${ex.custom ? `<button onclick="deleteExercise(${ex.id})" style="background:#ff5252;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Удалить</button>` : ''}
    </div>
  `).join('');
}

function showAddExerciseModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;
  `;
  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:8px;width:90%;max-width:400px;">
      <h3>Добавить упражнение</h3>
      <input type="text" id="exerciseName" placeholder="Название" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
      <input type="number" id="exerciseCalories" placeholder="Калории" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;" min="1">
      <select id="exerciseDifficulty" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">
        <option>низкая</option>
        <option selected>средняя</option>
        <option>высокая</option>
      </select>
      <input type="number" id="exerciseDuration" placeholder="Длительность (мин)" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;" min="1">
      <input type="number" id="exerciseRest" placeholder="Отдых (сек)" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;" value="60" min="0">
      <input type="number" id="exercisePrep" placeholder="Подготовка (сек)" style="width:100%;padding:8px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;" value="30" min="0">
      <input type="file" id="exercisePhoto" accept="image/*" style="width:100%;margin:10px 0;">
      <button onclick="saveNewExercise()" style="width:100%;padding:10px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;margin:10px 0;">Сохранить</button>
      <button onclick="this.closest('.modal').remove()" style="width:100%;padding:10px;background:#ccc;color:black;border:none;border-radius:4px;cursor:pointer;">Отмена</button>
    </div>
  `;
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

  if (!name || !calories || !duration) {
    alert('Заполните обязательные поля');
    return;
  }

  let photoURL = null;
  if (photoFile && currentUser) {
    const filename = `exercises/${currentUser.id}/${Date.now()}_${photoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('exercise-photos')
      .upload(filename, photoFile);

    if (!uploadError) {
      const { data } = supabase.storage
        .from('exercise-photos')
        .getPublicUrl(filename);
      photoURL = data.publicUrl;
    }
  }

  if (currentUser) {
    const { data, error } = await supabase
      .from('custom_exercises')
      .insert([{
        user_id: currentUser.id,
        name,
        calories,
        difficulty,
        duration,
        rest,
        prep,
        image_url: photoURL
      }])
      .select();

    if (data) {
      exercises.push({
        id: data[0].id,
        name,
        calories,
        difficulty,
        duration,
        rest,
        prep,
        image: photoURL,
        custom: true
      });
    }
  }

  document.querySelector('.modal').remove();
  renderExercises();
}

function deleteExercise(id) {
  exercises = exercises.filter(e => e.id !== id);
  if (currentUser) {
    supabase.from('custom_exercises').delete().eq('id', id);
  }
  renderExercises();
}

function showWorkoutBuilder() {
  hideAllScreens();
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
      <p>Калории: ${ex.calories} | Сложность: ${ex.difficulty}</p>
      <button onclick="addToWorkout(${ex.id})" style="background:#4CAF50;color:white;border:none;padding:8px 15px;border-radius:4px;cursor:pointer;">Добавить</button>
    </div>
  `).join('');
}

function addToWorkout(exerciseId) {
  const exercise = exercises.find(e => e.id === exerciseId);
  if (exercise) {
    currentWorkout.push({...exercise, addedAt: Date.now()});
    updateWorkoutDisplay();
  }
}

function updateWorkoutDisplay() {
  const list = document.getElementById('workoutList');
  const caloriesSpan = document.getElementById('totalCalories');
  const timeSpan = document.getElementById('totalTime');

  if (!list) return;

  const totalCalories = currentWorkout.reduce((sum, ex) => sum + ex.calories, 0);
  const totalTime = currentWorkout.reduce((sum, ex) => sum + ex.duration, 0);

  caloriesSpan.textContent = totalCalories;
  timeSpan.textContent = totalTime;

  list.innerHTML = currentWorkout.map((ex, idx) => `
    <div style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #eee;">
      <span>${ex.name} (${ex.calories} ккал, ${ex.duration} мин)</span>
      <button onclick="removeFromWorkout(${idx})" style="background:#ff5252;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">✕</button>
    </div>
  `).join('');
}

function removeFromWorkout(idx) {
  currentWorkout.splice(idx, 1);
  updateWorkoutDisplay();
}

async function completeWorkout() {
  if (!currentUser) {
    alert('Авторизуйтесь');
    return;
  }

  if (currentWorkout.length === 0) {
    alert('Добавьте упражнения');
    return;
  }

  const totalCalories = currentWorkout.reduce((sum, ex) => sum + ex.calories, 0);
  const totalTime = currentWorkout.reduce((sum, ex) => sum + ex.duration, 0);
  
  userStats.totalCalories += totalCalories;
  userStats.totalWorkouts += 1;
  userStats.xp += Math.floor(totalCalories / 2);

  if (userStats.xp >= userStats.level * 100) {
    userStats.level += 1;
    userStats.xp = 0;
  }

  await supabase.from('workouts').insert([{
    user_id: currentUser.id,
    exercises: JSON.stringify(currentWorkout),
    calories: totalCalories,
    duration: totalTime,
    completed_at: new Date()
  }]);

  await saveProgressToCloud();
  
  currentWorkout = [];
  alert(`Тренировка завершена! +${totalCalories} ккал`);
  showMainScreen();
}

function showWeightScreen() {
  if (!currentUser) {
    alert('Авторизуйтесь');
    return;
  }
  
  hideAllScreens();
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

  supabase.from('weight_diary').insert([{
    user_id: currentUser.id,
    weight,
    recorded_at: new Date()
  }]);

  document.getElementById('weightInput').value = '';
  loadWeightHistory();
  plotWeightChart();
}

function loadWeightHistory() {
  const container = document.getElementById('weightHistory');
  if (!container) return;

  container.innerHTML = weightDiary.slice().reverse().map(entry => {
    const date = new Date(entry.date).toLocaleDateString('ru-RU');
    return `<div style="padding:8px;border-bottom:1px solid #eee;">${date}: ${entry.weight} кг</div>`;
  }).join('');
}

function plotWeightChart() {
  const canvas = document.getElementById('weightChart');
  if (!canvas || weightDiary.length === 0) return;

  const ctx = canvas.getContext('2d');
  const sortedDiary = weightDiary.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const weights = sortedDiary.map(e => e.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  ctx.beginPath();

  sortedDiary.forEach((entry, idx) => {
    const x = (idx / (sortedDiary.length - 1 || 1)) * (canvas.width - 20) + 10;
    const y = canvas.height - ((entry.weight - minWeight) / range) * (canvas.height - 40) - 20;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function showFoodScreen() {
  if (!currentUser) {
    alert('Авторизуйтесь');
    return;
  }
  
  hideAllScreens();
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

  supabase.from('food_diary').insert([{
    user_id: currentUser.id,
    name,
    calories,
    recorded_at: new Date()
  }]);

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
  const totalCalories = todayFood.reduce((sum, e) => sum + e.calories, 0);

  container.innerHTML = `<div style="padding:10px;background:#f5f5f5;border-radius:4px;margin:10px 0;"><strong>Сегодня: ${totalCalories} ккал</strong></div>` +
    foodDiary.slice().reverse().map(entry => {
      const date = new Date(entry.date).toLocaleDateString('ru-RU');
      return `<div style="padding:8px;border-bottom:1px solid #eee;">${date}: ${entry.name} (${entry.calories} ккал)</div>`;
    }).join('');
}

function plotFoodChart() {
  const canvas = document.getElementById('foodChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayFood = foodDiary.filter(e => new Date(e.date).toDateString() === date.toDateString());
    const total = dayFood.reduce((sum, e) => sum + e.calories, 0);
    last7Days.push(total);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FF9800';

  const maxCalories = Math.max(...last7Days, 1);
  const barWidth = canvas.width / 7;

  last7Days.forEach((calories, idx) => {
    const height = (calories / maxCalories) * (canvas.height - 40);
    const x = idx * barWidth + 5;
    const y = canvas.height - height - 20;
    ctx.fillRect(x, y, barWidth - 10, height);
  });
}

function showWaterScreen() {
  if (!currentUser) {
    alert('Авторизуйтесь');
    return;
  }
  
  hideAllScreens();
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

  supabase.from('water_diary').insert([{
    user_id: currentUser.id,
    amount,
    recorded_at: new Date()
  }]);

  loadWaterHistory();
  plotWaterChart();
}

function loadWaterHistory() {
  const container = document.getElementById('waterHistory');
  if (!container) return;

  const today = new Date().toDateString();
  const todayWater = waterDiary.filter(e => new Date(e.date).toDateString() === today);
  const totalWater = todayWater.reduce((sum, e) => sum + e.amount, 0);

  container.innerHTML = `<div style="padding:10px;background:#f5f5f5;border-radius:4px;margin:10px 0;"><strong>Сегодня: ${totalWater} мл (${(totalWater / 250).toFixed(1)} стаканов)</strong></div>` +
    waterDiary.slice().reverse().map(entry => {
      const time = new Date(entry.date).toLocaleTimeString('ru-RU');
      return `<div style="padding:8px;border-bottom:1px solid #eee;">${time}: +${entry.amount} мл</div>`;
    }).join('');
}

function plotWaterChart() {
  const canvas = document.getElementById('waterChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayWater = waterDiary.filter(e => new Date(e.date).toDateString() === date.toDateString());
    const total = dayWater.reduce((sum, e) => sum + e.amount, 0);
    last7Days.push(total);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2196F3';

  const maxWater = Math.max(...last7Days, 1000);
  const barWidth = canvas.width / 7;

  last7Days.forEach((water, idx) => {
    const height = (water / maxWater) * (canvas.height - 40);
    const x = idx * barWidth + 5;
    const y = canvas.height - height - 20;
    ctx.fillRect(x, y, barWidth - 10, height);
  });
}

function showAnalysis() {
  if (!currentUser) {
    alert('Авторизуйтесь');
    return;
  }
  
  hideAllScreens();
  document.getElementById('analysisScreen').style.display = 'block';
  updateAnalysisStats();
  setTimeout(() => {
    plotCaloriesChart();
    plotCorrelationChart();
    plotTripleCorrelationChart();
  }, 100);
}

function updateAnalysisStats() {
  document.getElementById('burnedCaloriesTotal').textContent = userStats.totalCalories;
  const consumed = foodDiary.reduce((sum, e) => sum + e.calories, 0);
  document.getElementById('consumedCaloriesTotal').textContent = consumed;
  document.getElementById('caloriesBalance').textContent = userStats.totalCalories - consumed;
}

function plotCaloriesChart() {
  const canvas = document.getElementById('caloriesChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4CAF50';
  ctx.fillText('Динамика калорий за 7 дней', 10, 20);
}

function plotCorrelationChart() {
  const canvas = document.getElementById('correlationChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FF5252';
  ctx.font = '12px Arial';
  ctx.fillText('Больше калорий → ↓ вес', 10, 30);
  ctx.fillText('Меньше калорий → ↑ вес', 10, canvas.height - 10);
}

function plotTripleCorrelationChart() {
  const canvas = document.getElementById('tripleChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2196F3';
  ctx.font = '12px Arial';
  ctx.fillText('Калории ↔ Еда ↔ Вода: Корреляция данных', 10, 30);
}

function updateStatsDisplay() {
  const levelEl = document.getElementById('displayLevel');
  const xpEl = document.getElementById('displayXP');
  const caloriesEl = document.getElementById('displayCalories');

  if (levelEl) levelEl.textContent = userStats.level;
  if (xpEl) xpEl.textContent = `${userStats.xp}/${userStats.level * 100}`;
  if (caloriesEl) caloriesEl.textContent = userStats.totalCalories;
}

function setupEventListeners() {
  document.getElementById('loginTelegramBtn')?.addEventListener('click', loginWithTelegram);
  document.getElementById('loginEmailBtn')?.addEventListener('click', handleEmailAuth);
}