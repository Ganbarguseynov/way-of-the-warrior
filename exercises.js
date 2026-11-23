const EXERCISE_LIBRARY = [
  { id: 'push-ups', name: 'Отжимания', caloriesPerMin: 7, difficulty: 'средняя' },
  { id: 'squats', name: 'Приседания', caloriesPerMin: 8, difficulty: 'средняя' },
  { id: 'running', name: 'Бег', caloriesPerMin: 12, difficulty: 'высокая' },
  { id: 'plank', name: 'Планка', caloriesPerMin: 5, difficulty: 'средняя' },
  { id: 'burpees', name: 'Берпи', caloriesPerMin: 10, difficulty: 'высокая' },
  { id: 'jump-rope', name: 'Скакалка', caloriesPerMin: 11, difficulty: 'высокая' },
  { id: 'sit-ups', name: 'Скручивания', caloriesPerMin: 6, difficulty: 'лёгкая' },
  { id: 'lunges', name: 'Выпады', caloriesPerMin: 7, difficulty: 'средняя' },
  { id: 'mountain-climbers', name: 'Скалолазы', caloriesPerMin: 9, difficulty: 'высокая' },
  { id: 'walking', name: 'Ходьба', caloriesPerMin: 4, difficulty: 'лёгкая' }
];

function getExerciseLibrary(){
  return EXERCISE_LIBRARY;
}

function getUserExercises(){
  var list = [];
  try{list = JSON.parse(localStorage.getItem('customExercises11')||'[]');}catch(err){list=[];}
  return list;
}

function saveUserExercises(exercises){
  localStorage.setItem('customExercises11', JSON.stringify(exercises));
}

function createCustomExercise(name, caloriesPerMin, difficulty, photoUrl){
  var list = getUserExercises();
  var id = 'custom-'+ Date.now();
  list.push({
    id: id,
    name: name,
    caloriesPerMin: parseFloat(caloriesPerMin),
    difficulty: difficulty,
    photo: photoUrl || null,
    custom: true
  });
  saveUserExercises(list);
  return id;
}

function deleteCustomExercise(id){
  var list = getUserExercises();
  list = list.filter(function(e){return e.id !== id;});
  saveUserExercises(list);
}

function getExerciseById(id){
  var lib = getExerciseLibrary();
  var ex = lib.find(function(e){return e.id === id;});
  if(ex) return ex;
  var custom = getUserExercises();
  return custom.find(function(e){return e.id === id;});
}

function getAllExercises(){
  return getExerciseLibrary().concat(getUserExercises());
}

function calculateCaloriesBurned(exerciseId, durationMinutes, intensity){
  var ex = getExerciseById(exerciseId);
  if(!ex) return 0;
  var base = ex.caloriesPerMin * durationMinutes;
  var factor = 1;
  if(intensity === 'лёгкая') factor = 0.7;
  else if(intensity === 'средняя') factor = 1;
  else if(intensity === 'высокая') factor = 1.3;
  return Math.round(base * factor);
}

function getCurrentUser(){
  var t = localStorage.getItem('tgId');
  if(t) return 'tg:' + t;
  var e = localStorage.getItem('linkedEmail') || localStorage.getItem('currentEmail');
  if(e) return 'email:' + e.toLowerCase();
  return null;
}

async function saveWorkoutToHistory(workout){
  var date = todayStr();
  var hist = {};
  try{hist = JSON.parse(localStorage.getItem('workoutHistory')||'{}');}catch(err){hist={};}
  if(!hist[date]) hist[date] = [];
  hist[date].push(Object.assign({}, workout, {timestamp: new Date().toLocaleTimeString('ru-RU')}));
  localStorage.setItem('workoutHistory', JSON.stringify(hist));
  
  var user = getCurrentUser();
  if(!user) return;
  var rec = await resolveUserRecord(localStorage.getItem('tgId'), localStorage.getItem('currentEmail'));
  if(rec){
    var prof = rec.profile || {};
    if(!prof.workoutHistory) prof.workoutHistory = {};
    prof.workoutHistory[date] = hist[date];
    await supabaseClient.from('user_links').update({profile: prof}).eq('id', rec.id);
  }
}

function getWorkoutHistory(fromDate, toDate){
  var hist = {};
  try{hist = JSON.parse(localStorage.getItem('workoutHistory')||'{}');}catch(err){hist={};}
  var result = {};
  Object.keys(hist).filter(function(k){return k >= fromDate && k <= toDate;}).forEach(function(k){
    result[k] = hist[k];
  });
  return result;
}

function getTotalCaloriesBurned(fromDate, toDate){
  var hist = getWorkoutHistory(fromDate, toDate);
  var total = 0;
  Object.values(hist).forEach(function(day){
    if(Array.isArray(day)){
      day.forEach(function(workout){
        total += (workout.caloriesBurned || 0);
      });
    }
  });
  return total;
}