import type { ISODate, StreakState, Settings, SessionLog } from './db';
import { addDaysISO, dayOfWeekISO } from './plan';
import { isoWeekKeyNow } from './db';

const DOW_MAP: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

function isPlannedStrengthDay(iso: ISODate, days: ('TU'|'SA')[]): boolean {
  const dow = dayOfWeekISO(iso);
  return days.map(d=>DOW_MAP[d]).includes(dow);
}

export function updateStreakOnStrengthCompletion(opts: {
  streak: StreakState;
  settings: Settings;
  completedSession: SessionLog;
}): StreakState {
  const { streak, settings, completedSession } = opts;

  if (completedSession.workoutKey !== 'A' && completedSession.workoutKey !== 'B') return streak;

  const wk = isoWeekKeyNow();
  let next: StreakState = { ...streak };
  if (next.weekKey !== wk) {
    next.weekKey = wk;
    next.timeTurnersLeft = settings.streakTimeTurnersPerWeek;
  }

  const iso = completedSession.isoDate;
  if (!isPlannedStrengthDay(iso, settings.strengthDaysOfWeek)) return next;

  const prev = previousPlannedDate(iso, settings.strengthDaysOfWeek);

  if (!next.lastPlannedCompletedISO) {
    next.current = 1;
    next.longest = Math.max(next.longest, next.current);
    next.lastPlannedCompletedISO = iso;
    next.paused = false;
    return next;
  }

  if (next.lastPlannedCompletedISO === iso) return next;

  if (next.lastPlannedCompletedISO === prev) {
    next.current += 1;
    next.longest = Math.max(next.longest, next.current);
    next.lastPlannedCompletedISO = iso;
    next.paused = false;
    return next;
  }

  if (next.timeTurnersLeft > 0) {
    next.timeTurnersLeft -= 1;
    next.lastPlannedCompletedISO = iso;
    next.paused = false;
    return next;
  }

  next.paused = true;
  next.lastPlannedCompletedISO = iso;
  return next;
}

function previousPlannedDate(iso: ISODate, days: ('TU'|'SA')[]): ISODate {
  let cur = addDaysISO(iso, -1);
  for (let i=0;i<14;i++){
    if (isPlannedStrengthDay(cur, days)) return cur;
    cur = addDaysISO(cur, -1);
  }
  return cur;
}
