import program from '../data/program.json';
import type { ISODate, WorkoutKey } from './db';

const DOW_MAP: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

export function isoToday(): ISODate { return new Date().toISOString().slice(0,10); }
export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);
}
export function dayOfWeekISO(iso: ISODate): number { return new Date(iso + 'T00:00:00').getDay(); }

export function computeWeekNumber(startISO: ISODate, onISO: ISODate): number {
  const start = new Date(startISO + 'T00:00:00').getTime();
  const now = new Date(onISO + 'T00:00:00').getTime();
  const diffDays = Math.floor((now - start)/86400000);
  return Math.max(1, Math.min(12, Math.floor(diffDays/7)+1));
}

export function phaseForWeek(weekNumber: number){
  for (const p of (program as any).phases){
    const [a,b] = p.weeks;
    if (weekNumber>=a && weekNumber<=b) return p;
  }
  return (program as any).phases[0];
}

export function isStrengthDay(iso: ISODate, days: ('SU'|'MO'|'TU'|'WE'|'TH'|'FR'|'SA')[]): boolean{
  const dow = dayOfWeekISO(iso);
  return days.map(d=>DOW_MAP[d]).includes(dow);
}

export type PlannedStrength = { isoDate: ISODate; workoutKey: 'A'|'B'; weekNumber: number; phase: any };

export function nextPlannedStrength(startISO: ISODate, days: ('SU'|'MO'|'TU'|'WE'|'TH'|'FR'|'SA')[], fromISO: ISODate): PlannedStrength {
  const target = days.map(d=>DOW_MAP[d]).sort((a,b)=>a-b);
  let offset=0;
  while(offset<14){
    const iso = addDaysISO(fromISO, offset);
    if (target.includes(dayOfWeekISO(iso))){
      const weekNumber = computeWeekNumber(startISO, iso);
      const phase = phaseForWeek(weekNumber);
      const idx = plannedIndexSinceStart(startISO, iso, target);
      const workoutKey = (idx%2===0) ? 'A' : 'B';
      return { isoDate: iso, workoutKey, weekNumber, phase };
    }
    offset++;
  }
  const weekNumber = computeWeekNumber(startISO, fromISO);
  return { isoDate: fromISO, workoutKey: 'A', weekNumber, phase: phaseForWeek(weekNumber) };
}

function plannedIndexSinceStart(startISO: ISODate, iso: ISODate, target: number[]): number{
  let count=0; let cur=startISO;
  while(cur<=iso){
    if (target.includes(dayOfWeekISO(cur))){
      if (cur===iso) return count;
      count++;
    }
    cur = addDaysISO(cur,1);
  }
  return count;
}

export function workoutTemplate(weekNumber: number, key: WorkoutKey){
  const p:any = program as any;

  if (key==='CORE') {
    // New phased core progression (no breathing). Falls back to legacy template if present.
    const phases = p.corePhases;
    if (phases) {
      if (weekNumber <= 4) return { exercises: phases["1-4"].exercises };
      if (weekNumber <= 8) return { exercises: phases["5-8"].exercises };
      // Weeks 9–12: alternate A/B. Deterministic simple rule (date parity).
      const alt = (new Date().getDate() % 2 === 0) ? 'B' : 'A';
      return { exercises: phases["9-12"][alt] };
    }
    return p.templates?.CORE;
  }

  if (key==='GLUTE') return p.templates.GLUTE_ACCESSORY;
  if (key==='PILATES') return p.templates.PILATES_UPPER;
  return phaseForWeek(weekNumber).workouts[key];
}


export function programMeta(){ return program as any; }
