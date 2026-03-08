import type { SessionLog } from './db';
import type { CardioLog } from './db';
import { earnBadge, listBadges } from './db';

export type BadgeDef = { id: string; title: string; desc: string; icon: string; };

export const BADGES: BadgeDef[] = [
  { id:'first_strength', title:'First Strength Quest', desc:'Complete your first A/B strength session.', icon:'🏋️' },
  { id:'first_core', title:'First Core Quest', desc:'Complete your first core session.', icon:'👙' },
  { id:'first_cardio', title:'First Cardio Log', desc:'Log your first cardio session.', icon:'🏃' },
  { id:'streak_3', title:'3‑Day Streak', desc:'Keep your streak alive for 3 days.', icon:'🔥' },
  { id:'streak_7', title:'7‑Day Streak', desc:'One week of consistency.', icon:'🔥' },
  { id:'strength_10', title:'10 Strength Sessions', desc:'Complete 10 strength sessions.', icon:'🏆' },
  { id:'core_10', title:'10 Core Sessions', desc:'Complete 10 core sessions.', icon:'🌟' },
  { id:'cardio_240_week', title:'4‑Hour Cardio Week', desc:'Hit 240 cardio minutes in a week.', icon:'⏱️' },
  { id:'streak_14', title:'14‑Day Streak', desc:'Two weeks of showing up.', icon:'🔥' },
  { id:'streak_30', title:'30‑Day Streak', desc:'One month of consistency.', icon:'🔥' },
  { id:'strength_12', title:'Halfway Strength', desc:'Complete 12 strength sessions.', icon:'🏋️' },
  { id:'strength_24', title:'Full Strength Cycle', desc:'Complete 24 strength sessions (2×/week for 12 weeks).', icon:'🏆' },
  { id:'core_30', title:'30 Core Sessions', desc:'Build the deep-core habit.', icon:'👙' },
  { id:'core_60', title:'60 Core Sessions', desc:'Core consistency is your superpower.', icon:'🌟' },
  { id:'phase1_complete', title:'Phase 1 Complete', desc:'Finish week 4 with at least 8 strength sessions logged.', icon:'🧙' },
  { id:'program_complete', title:'Program Complete', desc:'Reach week 12 with 24 strength sessions logged.', icon:'🎓' },
];

export async function evaluateBadges(opts:{
  sessions: SessionLog[];
  cardio: CardioLog[];
  streakCurrent: number;
  cardioGoalMinPerWeek: number;
}){
  const { sessions, cardio, streakCurrent, cardioGoalMinPerWeek } = opts;

  const strength = sessions.filter(s=> (s.workoutKey==='A' || s.workoutKey==='B') && !!s.finishedAt);
  const core = sessions.filter(s=> s.workoutKey==='CORE' && !!s.finishedAt);

  if (strength.length>=1) await earnBadge('first_strength');
  if (core.length>=1) await earnBadge('first_core');
  if (cardio.length>=1) await earnBadge('first_cardio');

  if (streakCurrent>=3) await earnBadge('streak_3');
  if (streakCurrent>=7) await earnBadge('streak_7');
  if (streakCurrent>=14) await earnBadge('streak_14');
  if (streakCurrent>=30) await earnBadge('streak_30');

  if (strength.length>=10) await earnBadge('strength_10');
  if (strength.length>=12) await earnBadge('strength_12');
  if (strength.length>=24) await earnBadge('strength_24');
  if (core.length>=10) await earnBadge('core_10');
  if (core.length>=30) await earnBadge('core_30');
  if (core.length>=60) await earnBadge('core_60');


  // Phase / program completion (based on highest completed weekNumber in strength logs)
  const maxWeek = strength.reduce((m, s)=> Math.max(m, s.weekNumber||0), 0);
  if (maxWeek>=4 && strength.length>=8) await earnBadge('phase1_complete');
  if (maxWeek>=12 && strength.length>=24) await earnBadge('program_complete');

  // Weekly cardio goal (default 240) — if any ISO week meets/exceeds goal
  const goal = Number(cardioGoalMinPerWeek || 240);
  const byWeek = new Map<string, number>();
  for (const c of cardio){
    const k = isoWeekKeyFromISO(c.isoDate);
    byWeek.set(k, (byWeek.get(k)||0) + (c.minutes||0));
  }
  for (const [_, mins] of byWeek.entries()){
    if (mins >= goal){
      await earnBadge('cardio_240_week');
      break;
    }
  }
}

function isoWeekKeyFromISO(iso: string){
  const d = new Date(iso + 'T00:00:00Z');
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}

export async function getEarnedBadgeIds(){
  const b = await listBadges();
  return new Set(b.map(x=>x.id));
}
