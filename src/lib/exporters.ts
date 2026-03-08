import type { SessionLog } from './db';

export function sessionsToCSV(sessions: SessionLog[]): string {
  const rows: string[] = [];
  rows.push(['date','workout','week','skipLogging','tiredMode','quick15','painMode','exercise','set','weight','completed','rpe','energy','pain','note'].join(','));
  for (const s of sessions) {
    const r = s.rating;
    for (const [ex, setLogs] of Object.entries(s.setLogs)) {
      (setLogs as any[]).forEach((sl) => {
        rows.push([
          s.isoDate, s.workoutKey, String(s.weekNumber),
          String(s.skipLogging), String(s.tiredMode), String(s.quick15), String(s.painMode),
          csvSafe(ex), String(sl.setIndex+1), (sl.weight ?? ''), String(sl.completed),
          r?.rpe ?? '', r?.energy ?? '', r?.pain ?? '', csvSafe(r?.note ?? '')
        ].join(','));
      });
    }
  }
  return rows.join('\n');
}

export function sessionToShareText(s: SessionLog): string {
  const doneSets = Object.values(s.setLogs).flat().filter((x:any)=>x.completed).length;
  const totalSets = Object.values(s.setLogs).flat().length;
  const r = s.rating;
  const lines = [
    `🧙 Strength Quest — ${s.isoDate}`,
    `Workout ${s.workoutKey} · Week ${s.weekNumber} · ${doneSets}/${totalSets} sets`,
    r ? `RPE ${r.rpe}/10 · Energy ${r.energy}/5 · Pain: ${r.pain}` : '',
    r?.note ? `Note: ${r.note}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}

export function downloadText(filename: string, text: string, mime='text/plain'){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function csvSafe(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replaceAll('"','""') + '"';
  return s;
}

import type { DayFoodLog } from './db';

export function mealLogsToCSV(logs: DayFoodLog[]): string {
  const rows: string[] = [];
  rows.push(['date','templateId','meal','item','qty','unit','eaten','calories','protein_g','carbs_g','fat_g','iron_mg'].join(','));
  for (const log of logs) {
    for (const it of log.items) {
      rows.push([
        log.isoDate,
        log.templateId ?? '',
        it.meal,
        csvSafe(it.name),
        String(it.qty),
        csvSafe(it.unit),
        String(it.eaten),
        String(round(it.calories * it.qty)),
        String(round(it.protein_g * it.qty)),
        String(round(it.carbs_g * it.qty)),
        String(round(it.fat_g * it.qty)),
        String(it.iron_mg != null ? round(it.iron_mg * it.qty) : '')
      ].join(','));
    }
  }
  return rows.join('\n');
}

function round(n: number){ return Math.round(n*10)/10; }
