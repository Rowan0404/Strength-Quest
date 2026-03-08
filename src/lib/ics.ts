export function buildRecurringICS(opts: {
  title: string;
  startDateISO: string;
  byDays: ('TU'|'SA')[];
  timeHHMM: string;
  durationMin: number;
  url?: string;
  alarmMinBefore?: number;
}): string {
  const dtstamp = toICSDateTimeUTC(new Date());
  const start = new Date(opts.startDateISO + 'T' + opts.timeHHMM + ':00');
  const dtstart = toICSLocal(start);
  const end = new Date(start.getTime() + opts.durationMin*60000);
  const dtend = toICSLocal(end);
  const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${opts.byDays.join(',')}`;
  const uid = `strength-quest-${Date.now()}@local`;

  const alarm = opts.alarmMinBefore != null ? [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(opts.title)}`,
    `TRIGGER:-PT${opts.alarmMinBefore}M`,
    'END:VALARM'
  ].join('\n') : '';

  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//StrengthQuest//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeICS(opts.title)}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    rrule,
    opts.url ? `URL:${escapeICS(opts.url)}` : '',
    alarm,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\n');
}

function pad(n:number){return String(n).padStart(2,'0');}
function toICSLocal(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
function toICSDateTimeUTC(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function escapeICS(s:string): string {
  return s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
