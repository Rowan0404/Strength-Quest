import type { Settings, ISODate, MacroTargets } from './db';

export function dayOfWeekISO(iso: ISODate): 'SU'|'MO'|'TU'|'WE'|'TH'|'FR'|'SA' {
  const d = new Date(iso + 'T00:00:00');
  const map = ['SU','MO','TU','WE','TH','FR','SA'] as const;
  return map[d.getDay()];
}

export function targetsForDate(settings: Settings, iso: ISODate): { targets: MacroTargets, isStrengthDay: boolean } {
  const dow = dayOfWeekISO(iso);
  const isStrengthDay = settings.nutritionMode === 'auto_strength_days' && (settings.strengthDaysOfWeek as any).includes(dow);
  return { targets: isStrengthDay ? settings.strengthDayTargets : settings.restDayTargets, isStrengthDay };
}
