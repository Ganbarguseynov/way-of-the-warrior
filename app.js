// Sport Royale - Main Application
// Суpabase инициализация
const SUPABASE_URL = 'https://qnpriwfxzuoymoumdtrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1jTWcnb3WvNMi79DXYU7Tw_RWKIVcsF';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Глобальное состояние
let currentUser = null;
let userStats = {
  xp: 0,
  level: 1,
  totalCalories: 0,
  totalWorkouts: 0,
  streak: 0
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadUserData();
  setupEventListeners();
  initializeCharts();
});

// ==================== АУТЕНТИФИКАЦИЯ ====================
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    showAuthScreen();
  } else {
    currentUser = user;
    hideAuthScreen();
    loadUserRecord();
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'none';
}

function hideAuthScreen() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainContent').style.display = 'flex';
}

async function loginWithTelegram() {
  const user = tg.initDataUnsafe.user;
  
  if (!user) {
    alert('Telegram данные недоступны');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `telegram_${user.id}@sportapp.local`,
    password: `tg_${user.id}_${Date.now()}`
  });

  if (error && error.status === 400) {
    // Пользователь не существует, создаём
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: `telegram_${user.id}@sportapp.local`,
      password: `tg_${user.id}_${Date.now()}`,
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
      hideAuthScreen();
      loadUserData();
    }
  } else if (!error) {
    currentUser = data.user;
    hideAuthScreen();
    loadUserData();
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
    // Создание нового пользователя
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (!signUpError) {
      currentUser = signUpData.user;
      await createUserRecord();
      hideAuthScreen();
      loadUserData();
    }
  } else if (!error) {
    currentUser = data.user;
    hideAuthScreen();
    loadUserData();
  }
}

// ==================== РАБОТА С ПОЛЬЗОВАТЕЛЕМ ====================
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

  if (error) console.error('Ошибка создания пользователя:', error);
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
    updateStatsDisplay();
  }
}

async function saveProgressToCloud() {
  if (!currentUser) return;

  const { error } = await supabase
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

  if (error) console.error('Ошибка сохранения:', error);
}

// ==================== ЭКРАН УПРАЖНЕНИЙ ====================
let exercises = [
  { id: 1, name: 'Приседания', calories: 8, difficulty: 'средняя', duration: 30, image: null },
  { id: 2, name: 'Отжимания', calories: 7, difficulty: 'средняя', duration: 20, image: null },
  { id: 3, name: 'Бег', calories: 12, difficulty: 'высокая', duration: 60, image: null },
  { id: 4, name: 'Прыжки', calories: 10, difficulty: 'высокая', duration: 45, image: null },
  { id: 5, name: 'Планка', calories: 6, difficulty: 'средняя', duration: 40, image: null }
];

function showExerciseScreen() {
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="exerciseScreen">
      <h2>Упражнения</h2>
      <div class="exercises-container" id="exercisesList"></div>
      <button onclick="showAddExerciseModal()" class="primary-btn">+ Добавить упражнение</button>
      <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
    </div>
  `;
  renderExercises();
}

function renderExercises() {
  const container = document.getElementById('exercisesList');
  if (!container) return;

  container.innerHTML = exercises.map(ex => `
    <div class="exercise-card">
      ${ex.image ? `<img src="${ex.image}" alt="${ex.name}" class="exercise-image">` : '<div class="exercise-placeholder">Фото</div>'}
      <h3>${ex.name}</h3>
      <p>Калории: ${ex.calories} | Сложность: ${ex.difficulty}</p>
      <p>Длительность: ${ex.duration} мин | Отдых: ${ex.rest || 60}c | Подготовка: ${ex.prep || 30}c</p>
      <button onclick="editExercise(${ex.id})" class="small-btn">Редактировать</button>
      <button onclick="deleteExercise(${ex.id})" class="small-btn danger">Удалить</button>
    </div>
  `).join('');
}

function showAddExerciseModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Добавить упражнение</h3>
      <input type="text" id="exerciseName" placeholder="Название упражнения" class="input">
      <input type="number" id="exerciseCalories" placeholder="Калории" class="input" min="1">
      <select id="exerciseDifficulty" class="input">
        <option>низкая</option>
        <option selected>средняя</option>
        <option>высокая</option>
      </select>
      <input type="number" id="exerciseDuration" placeholder="Длительность (мин)" class="input" min="1">
      <input type="number" id="exerciseRest" placeholder="Отдых (сек)" class="input" value="60" min="0">
      <input type="number" id="exercisePrep" placeholder="Подготовка (сек)" class="input" value="30" min="0">
      <input type="file" id="exercisePhoto" accept="image/*" class="input">
      <button onclick="saveNewExercise()" class="primary-btn">Сохранить</button>
      <button onclick="closeModal(this)" class="secondary-btn">Отмена</button>
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

  const newExercise = {
    id: Date.now(),
    name,
    calories,
    difficulty,
    duration,
    rest,
    prep,
    image: photoURL,
    custom: true,
    userId: currentUser?.id
  };

  exercises.push(newExercise);

  // Сохранить в Supabase если пользователь авторизован
  if (currentUser) {
    const { error } = await supabase
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
      }]);

    if (error) console.error('Ошибка сохранения упражнения:', error);
  }

  closeModal(document.querySelector('.modal'));
  renderExercises();
}

function editExercise(id) {
  const exercise = exercises.find(e => e.id === id);
  if (!exercise) return;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Редактировать упражнение</h3>
      <input type="text" id="exerciseName" value="${exercise.name}" class="input">
      <input type="number" id="exerciseCalories" value="${exercise.calories}" class="input" min="1">
      <select id="exerciseDifficulty" class="input">
        <option ${exercise.difficulty === 'низкая' ? 'selected' : ''}>низкая</option>
        <option ${exercise.difficulty === 'средняя' ? 'selected' : ''}>средняя</option>
        <option ${exercise.difficulty === 'высокая' ? 'selected' : ''}>высокая</option>
      </select>
      <input type="number" id="exerciseDuration" value="${exercise.duration}" class="input" min="1">
      <input type="number" id="exerciseRest" value="${exercise.rest || 60}" class="input" min="0">
      <input type="number" id="exercisePrep" value="${exercise.prep || 30}" class="input" min="0">
      <button onclick="updateExercise(${id})" class="primary-btn">Сохранить</button>
      <button onclick="closeModal(this)" class="secondary-btn">Отмена</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateExercise(id) {
  const exercise = exercises.find(e => e.id === id);
  if (!exercise) return;

  exercise.name = document.getElementById('exerciseName').value;
  exercise.calories = parseInt(document.getElementById('exerciseCalories').value);
  exercise.difficulty = document.getElementById('exerciseDifficulty').value;
  exercise.duration = parseInt(document.getElementById('exerciseDuration').value);
  exercise.rest = parseInt(document.getElementById('exerciseRest').value);
  exercise.prep = parseInt(document.getElementById('exercisePrep').value);

  closeModal(document.querySelector('.modal'));
  renderExercises();
}

function deleteExercise(id) {
  exercises = exercises.filter(e => e.id !== id);
  renderExercises();
}

function closeModal(btn) {
  const modal = btn.closest('.modal');
  if (modal) modal.remove();
}

// ==================== КОНСТРУКТОР ТРЕНИРОВОК ====================
let currentWorkout = [];

function showWorkoutBuilder() {
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="workoutScreen">
      <h2>Конструктор тренировок</h2>
      <div class="exercises-container" id="availableExercises"></div>
      <div class="workout-builder">
        <h3>Текущая тренировка</h3>
        <div id="workoutList"></div>
        <div class="stats">
          <p>Калории: <span id="totalCalories">0</span></p>
          <p>Время: <span id="totalTime">0</span> мин</p>
        </div>
        <button onclick="completeWorkout()" class="primary-btn">Завершить тренировку</button>
        <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
      </div>
    </div>
  `;
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
      <button onclick="addToWorkout(${ex.id})" class="primary-btn">Добавить</button>
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
    <div class="workout-item">
      <span>${ex.name} (${ex.calories} ккал, ${ex.duration} мин)</span>
      <button onclick="removeFromWorkout(${idx})" class="small-btn danger">✕</button>
    </div>
  `).join('');
}

function removeFromWorkout(idx) {
  currentWorkout.splice(idx, 1);
  updateWorkoutDisplay();
}

async function completeWorkout() {
  if (currentWorkout.length === 0) {
    alert('Добавьте упражнения в тренировку');
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

  // Сохранить тренировку в Supabase
  if (currentUser) {
    const { error } = await supabase
      .from('workouts')
      .insert([{
        user_id: currentUser.id,
        exercises: JSON.stringify(currentWorkout),
        calories: totalCalories,
        duration: totalTime,
        completed_at: new Date()
      }]);

    if (error) console.error('Ошибка сохранения тренировки:', error);
  }

  updateStatsDisplay();
  await saveProgressToCloud();
  
  currentWorkout = [];
  alert(`Тренировка завершена! +${totalCalories} ккал, +${Math.floor(totalCalories / 2)} XP`);
  showMainScreen();
}

// ==================== ДНЕВНИКИ ====================
let foodDiary = JSON.parse(localStorage.getItem('foodDiary')) || [];
let waterDiary = JSON.parse(localStorage.getItem('waterDiary')) || [];
let weightDiary = JSON.parse(localStorage.getItem('weightDiary')) || [];

function showWeightScreen() {
  if (!currentUser) {
    showAuthScreen();
    return;
  }
  
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="weightScreen">
      <h2>Вес</h2>
      <div class="diary-input">
        <input type="number" id="weightInput" placeholder="Вес (кг)" class="input" step="0.1">
        <button onclick="addWeight()" class="primary-btn">Добавить</button>
      </div>
      <canvas id="weightChart" width="400" height="200"></canvas>
      <div id="weightHistory" class="history-list"></div>
      <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
    </div>
  `;
  loadWeightHistory();
  plotWeightChart();
}

function addWeight() {
  const weight = parseFloat(document.getElementById('weightInput').value);
  if (!weight) return;

  const entry = {
    date: new Date().toISOString(),
    weight
  };

  weightDiary.push(entry);
  localStorage.setItem('weightDiary', JSON.stringify(weightDiary));

  if (currentUser) {
    supabase.from('weight_diary').insert([{
      user_id: currentUser.id,
      weight,
      recorded_at: new Date()
    }]);
  }

  document.getElementById('weightInput').value = '';
  loadWeightHistory();
  plotWeightChart();
}

function loadWeightHistory() {
  const container = document.getElementById('weightHistory');
  if (!container) return;

  container.innerHTML = weightDiary.slice().reverse().map(entry => {
    const date = new Date(entry.date).toLocaleDateString('ru-RU');
    return `<div class="history-item">${date}: ${entry.weight} кг</div>`;
  }).join('');
}

function plotWeightChart() {
  const canvas = document.getElementById('weightChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const sortedDiary = weightDiary.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  if (sortedDiary.length === 0) return;

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
    showAuthScreen();
    return;
  }
  
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="foodScreen">
      <h2>Еда</h2>
      <div class="diary-input">
        <input type="text" id="foodName" placeholder="Название блюда" class="input">
        <input type="number" id="foodCalories" placeholder="Калории" class="input" min="0">
        <button onclick="addFood()" class="primary-btn">Добавить</button>
      </div>
      <canvas id="foodChart" width="400" height="200"></canvas>
      <div id="foodHistory" class="history-list"></div>
      <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
    </div>
  `;
  loadFoodHistory();
  plotFoodChart();
}

function addFood() {
  const name = document.getElementById('foodName').value;
  const calories = parseInt(document.getElementById('foodCalories').value);

  if (!name || !calories) return;

  const entry = {
    date: new Date().toISOString(),
    name,
    calories
  };

  foodDiary.push(entry);
  localStorage.setItem('foodDiary', JSON.stringify(foodDiary));

  if (currentUser) {
    supabase.from('food_diary').insert([{
      user_id: currentUser.id,
      name,
      calories,
      recorded_at: new Date()
    }]);
  }

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

  container.innerHTML = `<div class="total">Сегодня: ${totalCalories} ккал</div>` +
    foodDiary.slice().reverse().map(entry => {
      const date = new Date(entry.date).toLocaleDateString('ru-RU');
      return `<div class="history-item">${date}: ${entry.name} (${entry.calories} ккал)</div>`;
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
    showAuthScreen();
    return;
  }
  
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="waterScreen">
      <h2>Вода</h2>
      <div class="diary-input">
        <input type="number" id="waterAmount" placeholder="Количество (мл)" class="input" min="0" value="250">
        <button onclick="addWater()" class="primary-btn">Добавить стакан</button>
      </div>
      <canvas id="waterChart" width="400" height="200"></canvas>
      <div id="waterHistory" class="history-list"></div>
      <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
    </div>
  `;
  loadWaterHistory();
  plotWaterChart();
}

function addWater() {
  const amount = parseInt(document.getElementById('waterAmount').value);
  if (!amount) return;

  const entry = {
    date: new Date().toISOString(),
    amount
  };

  waterDiary.push(entry);
  localStorage.setItem('waterDiary', JSON.stringify(waterDiary));

  if (currentUser) {
    supabase.from('water_diary').insert([{
      user_id: currentUser.id,
      amount,
      recorded_at: new Date()
    }]);
  }

  loadWaterHistory();
  plotWaterChart();
}

function loadWaterHistory() {
  const container = document.getElementById('waterHistory');
  if (!container) return;

  const today = new Date().toDateString();
  const todayWater = waterDiary.filter(e => new Date(e.date).toDateString() === today);
  const totalWater = todayWater.reduce((sum, e) => sum + e.amount, 0);

  container.innerHTML = `<div class="total">Сегодня: ${totalWater} мл (${(totalWater / 250).toFixed(1)} стаканов)</div>` +
    waterDiary.slice().reverse().map(entry => {
      const time = new Date(entry.date).toLocaleTimeString('ru-RU');
      return `<div class="history-item">${time}: +${entry.amount} мл</div>`;
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

// ==================== АНАЛИЗ КАЛОРИЙ ====================
function showAnalysis() {
  if (!currentUser) {
    showAuthScreen();
    return;
  }
  
  document.getElementById('mainContent').innerHTML = `
    <div class="screen" id="analysisScreen">
      <h2>Анализ калорий</h2>
      <div class="analysis-stats">
        <div class="stat-card">
          <h3>Сожженные калории</h3>
          <p class="big-number">${userStats.totalCalories}</p>
          <p>за все тренировки</p>
        </div>
        <div class="stat-card">
          <h3>Потребленные калории</h3>
          <p class="big-number">${foodDiary.reduce((sum, e) => sum + e.calories, 0)}</p>
          <p>всего</p>
        </div>
        <div class="stat-card">
          <h3>Баланс</h3>
          <p class="big-number">${userStats.totalCalories - foodDiary.reduce((sum, e) => sum + e.calories, 0)}</p>
          <p>дефицит/профицит</p>
        </div>
      </div>

      <h3>Динамика сожженных калорий за 7 дней</h3>
      <canvas id="caloriesChart" width="400" height="200"></canvas>

      <h3>Корреляция: Калории ↔ Вес</h3>
      <canvas id="correlationChart" width="400" height="200"></canvas>

      <h3>Корреляция: Калории ↔ Еда ↔ Вода</h3>
      <canvas id="tripleChart" width="400" height="200"></canvas>

      <button onclick="showMainScreen()" class="secondary-btn">Вернуться</button>
    </div>
  `;
  plotCaloriesChart();
  plotCorrelationChart();
  plotTripleCorrelationChart();
}

function plotCaloriesChart() {
  const canvas = document.getElementById('caloriesChart');
  if (!canvas) return;

  // Получить данные о тренировках за последние 7 дней
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    // Это упрощение, в реальном приложении нужно получать из Supabase
    last7Days.push(Math.random() * 500);
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 3;
  ctx.beginPath();

  last7Days.forEach((cal, idx) => {
    const x = (idx / 6) * (canvas.width - 40) + 20;
    const y = canvas.height - (cal / 500) * (canvas.height - 40) - 20;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function plotCorrelationChart() {
  const canvas = document.getElementById('correlationChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Показать соотношение между сожженными калориями и изменением веса
  ctx.fillStyle = '#FF5252';
  ctx.font = '14px Arial';
  ctx.fillText('Больше калорий', 20, 30);
  ctx.fillText('↓ вес', 20, 50);
  ctx.fillText('↑ вес', 20, canvas.height - 30);
  ctx.fillText('Меньше калорий', canvas.width - 150, canvas.height - 30);

  // Нарисовать диагональную линию
  ctx.strokeStyle = '#FF5252';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.lineTo(canvas.width - 20, canvas.height - 40);
  ctx.stroke();
}

function plotTripleCorrelationChart() {
  const canvas = document.getElementById('tripleChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Трехсторонняя корреляция: калории (зелень), еда (красный), вода (синий)
  const colors = ['#4CAF50', '#FF5252', '#2196F3'];
  const labels = ['Тренировки', 'Еда', 'Вода'];

  labels.forEach((label, idx) => {
    ctx.fillStyle = colors[idx];
    const x = 50 + idx * 110;
    const y = 50;
    ctx.fillRect(x, y, 80, 80);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(label, x + 10, y + 110);
  });

  // Линии связи
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(130, 130);
  ctx.lineTo(160, 130);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(130, 130);
  ctx.lineTo(100, 180);
  ctx.stroke();

  ctx.setLineDash([]);
}

function initializeCharts() {
  // Инициализация графиков при загрузке
}

// ==================== ОСНОВНОЙ ЭКРАН ====================
function showMainScreen() {
  document.getElementById('mainContent').innerHTML = `
    <div class="screen main-screen">
      <h1>Sport Royale</h1>
      
      <div class="stats-container">
        <div class="stat-box">
          <h3>Уровень</h3>
          <p id="displayLevel">${userStats.level}</p>
        </div>
        <div class="stat-box">
          <h3>XP</h3>
          <p id="displayXP">${userStats.xp}/${userStats.level * 100}</p>
        </div>
        <div class="stat-box">
          <h3>Калории</h3>
          <p id="displayCalories">${userStats.totalCalories}</p>
        </div>
      </div>

      <div class="menu-buttons">
        <button onclick="showExerciseScreen()" class="menu-btn">🏋️ Упражнения</button>
        <button onclick="showWorkoutBuilder()" class="menu-btn">🎯 Тренировка</button>
        <button onclick="showWeightScreen()" class="menu-btn">⚖️ Вес</button>
        <button onclick="showFoodScreen()" class="menu-btn">🍎 Еда</button>
        <button onclick="showWaterScreen()" class="menu-btn">💧 Вода</button>
        <button onclick="showAnalysis()" class="menu-btn">📊 Анализ</button>
      </div>

      <div id="bottomNav" class="bottom-nav">
        <a href="camera.html" class="nav-btn">📷</a>
        <a href="workout.html" class="nav-btn">🏃</a>
        <a href="clan.html" class="nav-btn">👥</a>
        <a href="leaderboard.html" class="nav-btn">🏆</a>
        <a href="chess-main.html" class="nav-btn">♟️</a>
      </div>
    </div>
  `;
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

function loadUserData() {
  if (currentUser) {
    loadUserRecord();
  }
}

function setupEventListeners() {
  document.getElementById('loginTelegramBtn')?.addEventListener('click', loginWithTelegram);
  document.getElementById('loginEmailBtn')?.addEventListener('click', handleEmailAuth);
}

// Показать главный экран при загрузке
setTimeout(() => {
  if (currentUser) {
    showMainScreen();
  }
}, 100);