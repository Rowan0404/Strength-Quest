import { openDB, DBSchema } from 'idb';

export type ISODate = string;
export type WorkoutKey = 'A'|'B'|'CORE'|'GLUTE'|'PILATES';

export type SessionRating = {
  rpe: number;
  energy: number;
  pain: 'none'|'mild'|'moderate';
  note?: string;
};

export type SetLog = { setIndex: number; weight?: number; reps?: number; seconds?: number; completed: boolean; };

export type SessionLog = {
  id: string;
  isoDate: ISODate;
  workoutKey: WorkoutKey;
  weekNumber: number;
  startedAt: number;
  finishedAt?: number;

  skipLogging: boolean;
  tiredMode: boolean;
  quick15: boolean;
  painMode: boolean;

  setLogs: Record<string, SetLog[]>;
  rating?: SessionRating;
};

export type MacroTargets = {
  calorieTarget: number;
  proteinTarget: number; // g
  carbsTarget: number;   // g
  fatTarget: number;     // g
};

export type Settings = {
  startDateISO: ISODate;
  strengthDaysOfWeek: ('SU'|'MO'|'TU'|'WE'|'TH'|'FR'|'SA')[];
  preferredTime: string;
  streakTimeTurnersPerWeek: number;
  unit: 'lb'|'kg';
  programStartWeek: number;
  displayWeeksTotal: number;
  waterGoalMl: number;
  timezone: string;

  // Nutrition targets
  nutritionMode: 'single'|'auto_strength_days';
  restDayTargets: MacroTargets;
  strengthDayTargets: MacroTargets;

  // Optional USDA key for quick lookup
  usdaApiKey?: string;

  // Cardio goal (steady-state) per week in minutes
  cardioGoalMinPerWeek: number;
};

export type StreakState = {
  current: number;
  longest: number;
  paused: boolean;
  timeTurnersLeft: number;
  weekKey: string;
  lastPlannedCompletedISO?: ISODate;
};

export type FoodItem = {
  id: string;
  name: string;
  meal: 'Breakfast'|'Lunch'|'Snack'|'Dinner'|'Other';
  qty: number;
  unit: string;
  calories: number;   // per unit
  protein_g: number;  // per unit
  carbs_g: number;    // per unit
  fat_g: number;      // per unit
  iron_mg?: number;   // per unit
  eaten: boolean;

  source?: 'manual'|'catalog'|'recent'|'usda';
  sourceRef?: string; // e.g. USDA fdcId
};

export type DayFoodLog = {
  isoDate: ISODate;
  templateId?: string;
  items: FoodItem[];
  updatedAt: number;
};

export type RecentFood = {
  id: string; // stable id
  name: string;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  iron_mg?: number;
  usedAt: number;
  source?: 'manual'|'catalog'|'recent'|'usda';
  sourceRef?: string;
};

export type FoodCacheEntry = {
  id: string; // e.g. "usda:12345"
  name: string;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  iron_mg?: number;
  savedAt: number;
};

export type CardioType = 'walk'|'incline_walk'|'bike'|'other';

export type CardioLog = {
  id: string;
  isoDate: ISODate;
  type: CardioType;
  minutes: number;
  note?: string;
  createdAt: number;
};

export type WaterLog = {
  isoDate: ISODate;
  ml: number;
  updatedAt: number;
};

interface DB extends DBSchema {
  sessions: { key: string; value: SessionLog; indexes: { 'by-date': ISODate } };
  settings: { key: string; value: Settings };
  streak: { key: string; value: StreakState };
  badges: { key: string; value: { id: string; earnedAt: number } };
  meals: { key: ISODate; value: DayFoodLog };

  recentFoods: { key: string; value: RecentFood; indexes: { 'by-usedAt': number } };
  foodCache: { key: string; value: FoodCacheEntry };

  cardio: { key: string; value: CardioLog; indexes: { 'by-date': ISODate } };
  water: { key: ISODate; value: WaterLog };
}

export const dbPromise = openDB<DB>('strength-quest-v16', 6, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('sessions')) {
      const s = db.createObjectStore('sessions', { keyPath: 'id' });
      s.createIndex('by-date', 'isoDate');
    }
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    if (!db.objectStoreNames.contains('streak')) db.createObjectStore('streak');
    if (!db.objectStoreNames.contains('badges')) db.createObjectStore('badges');
    if (!db.objectStoreNames.contains('meals')) db.createObjectStore('meals');

    if (!db.objectStoreNames.contains('recentFoods')) {
      const r = db.createObjectStore('recentFoods', { keyPath: 'id' });
      r.createIndex('by-usedAt', 'usedAt');
    }
    if (!db.objectStoreNames.contains('foodCache')) {
      db.createObjectStore('foodCache', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('cardio')) {
      const c = db.createObjectStore('cardio', { keyPath: 'id' });
      c.createIndex('by-date', 'isoDate');
    }
    if (!db.objectStoreNames.contains('water')) {
      db.createObjectStore('water', { keyPath: 'isoDate' });
    }
  }
});

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}
export function isoWeekKeyNow(){ return isoWeekKey(new Date()); }

const DEFAULT_REST: MacroTargets = { calorieTarget: 1450, proteinTarget: 130, carbsTarget: 120, fatTarget: 50 };
const DEFAULT_STRENGTH: MacroTargets = { calorieTarget: 1550, proteinTarget: 130, carbsTarget: 150, fatTarget: 50 };

export async function getSettings(): Promise<Settings> {
  const db = await dbPromise;
  const s:any = await db.get('settings', 'settings');
  const iso = new Date().toISOString().slice(0,10);
  const defaults: Settings = {
    startDateISO: iso,
    strengthDaysOfWeek: ['SU','TH'],
    preferredTime: '05:30',
    streakTimeTurnersPerWeek: 1,
    unit: 'lb',
    programStartWeek: 4,
    displayWeeksTotal: 9,
    waterGoalMl: 2000,
    timezone: 'America/Halifax',
    nutritionMode: 'auto_strength_days',
    restDayTargets: DEFAULT_REST,
    strengthDayTargets: DEFAULT_STRENGTH,
    usdaApiKey: '',
    cardioGoalMinPerWeek: 240
  };

  if (!s) {
    await db.put('settings', defaults, 'settings');
    return defaults;
  }

  // Backward compatibility with older single-target fields
  const migrated: any = { ...s };
  if (migrated.calorieTarget != null) {
    migrated.restDayTargets = {
      calorieTarget: Number(migrated.calorieTarget),
      proteinTarget: Number(migrated.proteinTarget),
      carbsTarget: Number(migrated.carbsTarget),
      fatTarget: Number(migrated.fatTarget),
    };
    migrated.strengthDayTargets = migrated.strengthDayTargets ?? {
      calorieTarget: Number(migrated.calorieTarget) + 100,
      proteinTarget: Number(migrated.proteinTarget),
      carbsTarget: Number(migrated.carbsTarget) + 30,
      fatTarget: Number(migrated.fatTarget),
    };
    migrated.nutritionMode = migrated.nutritionMode ?? 'auto_strength_days';
    delete migrated.calorieTarget;
    delete migrated.proteinTarget;
    delete migrated.carbsTarget;
    delete migrated.fatTarget;
  }

  const merged: Settings = {
    ...defaults,
    ...migrated,
    restDayTargets: { ...DEFAULT_REST, ...(migrated.restDayTargets ?? {}) },
    strengthDayTargets: { ...DEFAULT_STRENGTH, ...(migrated.strengthDayTargets ?? {}) },
    usdaApiKey: (migrated.usdaApiKey ?? defaults.usdaApiKey ?? ''),
    cardioGoalMinPerWeek: Number(migrated.cardioGoalMinPerWeek ?? defaults.cardioGoalMinPerWeek ?? 240),
    programStartWeek: Number(migrated.programStartWeek ?? defaults.programStartWeek ?? 4),
    displayWeeksTotal: Number(migrated.displayWeeksTotal ?? defaults.displayWeeksTotal ?? 9),
    waterGoalMl: Number(migrated.waterGoalMl ?? defaults.waterGoalMl ?? 2000),
    timezone: String(migrated.timezone ?? defaults.timezone ?? 'America/Halifax')
  };

  if (JSON.stringify(merged) !== JSON.stringify(s)) {
    await db.put('settings', merged, 'settings');
  }
  return merged;
}

export async function setSettings(next: Settings){
  const db = await dbPromise;
  await db.put('settings', next, 'settings');
}

export async function getStreak(): Promise<StreakState> {
  const db = await dbPromise;
  const st = await db.get('streak', 'streak');
  if (st) return st;
  const init: StreakState = { current: 0, longest: 0, paused: false, timeTurnersLeft: 1, weekKey: isoWeekKeyNow() };
  await db.put('streak', init, 'streak');
  return init;
}
export async function setStreak(next: StreakState){
  const db = await dbPromise;
  await db.put('streak', next, 'streak');
}

export async function saveSession(session: SessionLog){
  const db = await dbPromise;
  await db.put('sessions', session);
}
export async function listSessions(): Promise<SessionLog[]>{
  const db = await dbPromise;
  return await db.getAll('sessions');
}

export async function earnBadge(id: string){
  const db = await dbPromise;
  if (await db.get('badges', id)) return;
  await db.put('badges', { id, earnedAt: Date.now() }, id);
}
export async function listBadges(){
  const db = await dbPromise;
  return await db.getAll('badges');
}

export async function getMealLog(isoDate: ISODate){
  const db = await dbPromise;
  return await db.get('meals', isoDate);
}
export async function saveMealLog(log: DayFoodLog){
  const db = await dbPromise;
  await db.put('meals', log, log.isoDate);
}
export async function listMealLogs(){
  const db = await dbPromise;
  return await db.getAll('meals');
}

/* Recent foods */
export async function upsertRecentFood(food: Omit<RecentFood,'usedAt'>){
  const db = await dbPromise;
  const next: RecentFood = { ...food, usedAt: Date.now() };
  await db.put('recentFoods', next);
  const all = await db.getAll('recentFoods');
  if (all.length > 40) {
    all.sort((a,b)=> b.usedAt - a.usedAt);
    const toDelete = all.slice(40);
    for (const d of toDelete) await db.delete('recentFoods', d.id);
  }
}
export async function listRecentFoods(limit=12): Promise<RecentFood[]>{
  const db = await dbPromise;
  const all = await db.getAll('recentFoods');
  all.sort((a,b)=> b.usedAt - a.usedAt);
  return all.slice(0, limit);
}

/* Food cache (e.g., USDA results) */
export async function getFoodCache(id: string){
  const db = await dbPromise;
  return await db.get('foodCache', id);
}
export async function putFoodCache(entry: FoodCacheEntry){
  const db = await dbPromise;
  await db.put('foodCache', entry);
}

/* Cardio */
export async function saveCardio(entry: CardioLog){
  const db = await dbPromise;
  await db.put('cardio', entry);
}
export async function deleteCardio(id: string){
  const db = await dbPromise;
  await db.delete('cardio', id);
}
export async function listCardio(): Promise<CardioLog[]>{
  const db = await dbPromise;
  return await db.getAll('cardio');
}


export async function getWaterLog(isoDate: ISODate){
  const db = await dbPromise;
  return await db.get('water', isoDate);
}
export async function saveWaterLog(log: WaterLog){
  const db = await dbPromise;
  await db.put('water', log);
}
export async function listWaterLogs(){
  const db = await dbPromise;
  return await db.getAll('water');
}
