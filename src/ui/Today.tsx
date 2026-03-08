import React, { useMemo, useState } from 'react';
import { saveSession, earnBadge, saveWaterLog } from '../lib/db';
import { isoToday, workoutTemplate, computeWeekNumber, phaseForWeek, addDaysISO, dayOfWeekISO } from '../lib/plan';
import type { SessionLog, SetLog, WorkoutKey } from '../lib/db';
import Session from './Session';
import { updateStreakOnStrengthCompletion } from '../lib/streakLogic';

function isoWeekKeyFromISO(iso: string){
  const d = new Date(iso + 'T00:00:00Z');
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}

export default function Today({ ctx }:{ ctx:any }){
  const todayISO = isoToday();
  const displayWeeksTotal = Number(ctx.settings.displayWeeksTotal ?? 9);
  const programStartWeek = Number(ctx.settings.programStartWeek ?? 4);
  const elapsedWeeks = Math.max(0, computeWeekNumber(ctx.settings.startDateISO, todayISO) - 1);
  const displayWeek = Math.max(1, Math.min(displayWeeksTotal, elapsedWeeks + 1));
  const weekNumber = Math.max(1, Math.min(12, programStartWeek + elapsedWeeks));
  const phase = phaseForWeek(weekNumber);
  const todayDow = dayOfWeekISO(todayISO); // 0 Sun ... 6 Sat

  const [active, setActive] = useState<SessionLog|null>(null);
  const [toast, setToast] = useState<{title:string; sub?:string} | null>(null);

  const streakText = ctx.streak.paused ? `🔥 ${ctx.streak.current} (paused)` : `🔥 ${ctx.streak.current}`;
  const weekPct = Math.round((displayWeek / Math.max(1, displayWeeksTotal)) * 100);

  const nextStrength = useMemo(()=>{
    const sessions = (ctx.sessions ?? []).filter((s:any)=> (s.workoutKey==='A' || s.workoutKey==='B') && !!s.finishedAt);

    const lastDone = (key:'A'|'B')=>{
      const s = sessions
        .filter((x:any)=> x.workoutKey===key)
        .sort((a:any,b:any)=> String(a.isoDate).localeCompare(String(b.isoDate)))
        .at(-1);
      return (s?.isoDate ?? '0000-00-00') as string;
    };

    const lastDowOnOrBefore = (iso:string, targetDow:number)=>{
      let cur=iso;
      for(let i=0;i<7;i++){
        if(dayOfWeekISO(cur)===targetDow) return cur;
        cur = addDaysISO(cur,-1);
      }
      return iso;
    };

    const nextDowOnOrAfter = (iso:string, targetDow:number)=>{
      let cur=iso;
      for(let i=0;i<7;i++){
        if(dayOfWeekISO(cur)===targetDow) return cur;
        cur = addDaysISO(cur,1);
      }
      return iso;
    };

    // A = Sunday (0), B = Thursday (4)
    const lastSchedA = lastDowOnOrBefore(todayISO, 0);
    const lastSchedB = lastDowOnOrBefore(todayISO, 4);
    const dueA = lastSchedA >= ctx.settings.startDateISO && lastDone('A') < lastSchedA;
    const dueB = lastSchedB >= ctx.settings.startDateISO && lastDone('B') < lastSchedB;

    if (dueA) return { isoDate: todayISO, workoutKey:'A' as const, weekNumber, phase };
    if (dueB) return { isoDate: todayISO, workoutKey:'B' as const, weekNumber, phase };

    const nextA = nextDowOnOrAfter(todayISO, 0);
    const nextB = nextDowOnOrAfter(todayISO, 4);
    const pick = (nextA <= nextB)
      ? ({ isoDate: nextA, workoutKey:'A' as const })
      : ({ isoDate: nextB, workoutKey:'B' as const });

    const wn = Math.max(1, Math.min(12, programStartWeek + Math.max(0, computeWeekNumber(ctx.settings.startDateISO, pick.isoDate) - 1)));
    return { ...pick, weekNumber: wn, phase: phaseForWeek(wn) };
  }, [ctx.sessions, ctx.settings.startDateISO, todayISO, weekNumber, phase, programStartWeek]);
  const showAccessory = weekNumber >= 5 && weekNumber <= 8;
  const isCoreDay = [1,2,3,5,6].includes(todayDow);  // Mon Tue Wed Fri Sat
  const isPilatesDay = todayDow === 6;               // Sat
  const strengthDueToday = nextStrength.isoDate <= todayISO;

  const coreDoneToday = useMemo(()=>{
    const sessions = ctx.sessions ?? [];
    return sessions.some((s:any)=> s.workoutKey==='CORE' && s.isoDate===todayISO && !!s.finishedAt);
  }, [ctx.sessions, todayISO]);

  const strengthDoneToday = useMemo(()=>{
    const sessions = ctx.sessions ?? [];
    return sessions.some((s:any)=> (s.workoutKey==='A' || s.workoutKey==='B') && s.isoDate===todayISO && !!s.finishedAt);
  }, [ctx.sessions, todayISO]);

  const pilatesDoneToday = useMemo(()=>{
    const sessions = ctx.sessions ?? [];
    return sessions.some((s:any)=> s.workoutKey==='PILATES' && s.isoDate===todayISO && !!s.finishedAt);
  }, [ctx.sessions, todayISO]);

  const cardioMinutesToday = useMemo(()=>{
    const cardio = ctx.cardio ?? [];
    return cardio.filter((c:any)=> c.isoDate===todayISO).reduce((sum:number,c:any)=> sum + (c.minutes||0), 0);
  }, [ctx.cardio, todayISO]);

  const cardioDoneToday = cardioMinutesToday >= 20;

  const totalTasks = (isCoreDay ? 1 : 0) + (strengthDueToday ? 1 : 0) + 1 + (isPilatesDay ? 1 : 0);
  const completedTasks =
    (isCoreDay && coreDoneToday ? 1 : 0) +
    (strengthDueToday && strengthDoneToday ? 1 : 0) +
    (cardioDoneToday ? 1 : 0) +
    (isPilatesDay && pilatesDoneToday ? 1 : 0);

  const primaryAction =
    (strengthDueToday && !strengthDoneToday) ? 'strength' :
    (isPilatesDay && !pilatesDoneToday) ? 'pilates' :
    (isCoreDay && !coreDoneToday) ? 'core' :
    (!cardioDoneToday) ? 'cardio' :
    'progress';

  const weekKey = isoWeekKeyFromISO(todayISO);
  const strengthThisWeek = (ctx.sessions ?? []).filter((s:any)=> (s.workoutKey==='A' || s.workoutKey==='B') && !!s.finishedAt && isoWeekKeyFromISO(s.isoDate)===weekKey).length;
  const coreThisWeek = (ctx.sessions ?? []).filter((s:any)=> s.workoutKey==='CORE' && !!s.finishedAt && isoWeekKeyFromISO(s.isoDate)===weekKey).length;
  const pilatesThisWeek = (ctx.sessions ?? []).filter((s:any)=> s.workoutKey==='PILATES' && !!s.finishedAt && isoWeekKeyFromISO(s.isoDate)===weekKey).length;
  const cardioMinutesWeek = (ctx.cardio ?? []).filter((c:any)=> isoWeekKeyFromISO(c.isoDate)===weekKey).reduce((sum:number,c:any)=> sum + (c.minutes||0), 0);

  const derivedWaterTodayMl = ((ctx.water ?? []).find((w:any)=>w.isoDate===todayISO)?.ml ?? 0);
  const [localWaterTodayMl, setLocalWaterTodayMl] = useState<number | null>(null);
  const waterTodayMl = localWaterTodayMl ?? derivedWaterTodayMl;
  const waterGoalMl = Number(ctx.settings.waterGoalMl ?? 2000);
  const waterPct = Math.min(100, Math.round((waterTodayMl / Math.max(250, waterGoalMl)) * 100));

  async function adjustWater(delta:number){
    const next = Math.max(0, waterTodayMl + delta);
    setLocalWaterTodayMl(next);
    await saveWaterLog({ isoDate: todayISO as any, ml: next, updatedAt: Date.now() } as any);
    await ctx.reload();
    setLocalWaterTodayMl(null);
  }

  function parseDefaultReps(pres: string): number|undefined {
    const m = pres.match(/×\s*(\d+)(?:\s*[–-]\s*(\d+))?/);
    if (!m) return undefined;
    return parseInt(m[1],10);
  }
  function parseDefaultSeconds(pres: string): number|undefined {
    const m = pres.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*sec/);
    if (!m) return undefined;
    return parseInt(m[1],10);
  }

  function makeSetLogs(tpl:any): Record<string, SetLog[]> {
    const setLogs: Record<string, SetLog[]> = {};
    for (const ex of tpl.exercises) {
      const m = String(ex.prescription).match(/(\d+)\s*×/);
      const sets = m ? parseInt(m[1],10) : 2;
      const track = String(ex.track || 'weight');
      const pres = String(ex.prescription || '');
      const defaultReps = track==='reps' ? parseDefaultReps(pres) : undefined;
      const defaultSeconds = track==='time' ? parseDefaultSeconds(pres) : undefined;
      setLogs[ex.name] = Array.from({length: sets}).map((_,i)=>({
        setIndex: i,
        completed: false,
        reps: defaultReps,
        seconds: defaultSeconds
      }));
    }
    return setLogs;
  }

  function buildSession(workoutKey: WorkoutKey, iso: string): SessionLog {
    const tpl = workoutTemplate(weekNumber, workoutKey);
    return {
      id: `s_${iso}_${workoutKey}_${Date.now()}`,
      isoDate: iso,
      workoutKey,
      weekNumber,
      startedAt: Date.now(),
      finishedAt: undefined,
      skipLogging: false,
      tiredMode: false,
      quick15: false,
      painMode: false,
      setLogs: makeSetLogs(tpl)
    };
  }

  async function onFinish(session: SessionLog){
    if (session.workoutKey === 'CORE') await earnBadge('core-apprentice');
    if (session.workoutKey === 'GLUTE') await earnBadge('glute-guild');
    if (session.workoutKey === 'PILATES') await earnBadge('pilates-adept');
    if (session.workoutKey === 'A' || session.workoutKey === 'B') await earnBadge('strength-quester');
    if (session.skipLogging) await earnBadge('fast-caster');

    const nextStreak = updateStreakOnStrengthCompletion({
      streak: ctx.streak,
      settings: ctx.settings,
      completedSession: session
    });
    await ctx.updateStreak(nextStreak);

    setToast({
      title: 'Quest complete ✨',
      sub:
        session.workoutKey === 'CORE' ? 'Core banked.' :
        session.workoutKey === 'PILATES' ? 'Pilates done. Posture and tone leveled up.' :
        'Strength logged. Streak protected.'
    });
    setTimeout(()=> setToast(null), 2400);

    await ctx.reload();
    setActive(null);
  }

  return (
    <div className="container">
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <div className="toastTitle">{toast.title}</div>
          {toast.sub && <div className="toastSub">{toast.sub}</div>}
        </div>
      )}

      <div className="card hero heroGlow">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="h1">Week {displayWeek} of {displayWeeksTotal}</div>
            <div className="muted">Program Week {weekNumber} · {phase.title}</div>
          </div>
          <div className="pill orchid">{streakText}</div>
        </div>
        <div className="progressBar" style={{marginTop:12}}><div style={{width: `${weekPct}%`}} /></div>
      </div>

      {active ? (
        <Session
          session={active}
          weekNumber={weekNumber}
          history={ctx.sessions ?? []}
          unit={ctx.settings.unit ?? 'lb'}
          onCancel={()=>setActive(null)}
          onSave={async (s)=>{ await saveSession(s); await ctx.reload(); setActive(s); }}
          onFinish={async (s)=>{ await saveSession(s); await onFinish(s); }}
        />
      ) : (
        <>
          <div style={{height:12}} />

          <div className="card">
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div className="h2" style={{margin:0}}>Daily Progress</div>
                <div className="muted">{completedTasks} of {Math.max(1,totalTasks)} complete</div>
              </div>
              <div className="statValue" style={{fontSize:28}}>{Math.round((completedTasks/Math.max(1,totalTasks))*100)}%</div>
            </div>
            <div className="progressBar" style={{marginTop:10}}><div style={{width: `${Math.round((completedTasks/Math.max(1,totalTasks))*100)}%`}} /></div>

            <div style={{height:14}} />

            <div className="h2" style={{margin:0}}>This Week</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10, marginTop:10}}>
              <div className="statCard">
                <div className="statLabel">💪 Strength</div>
                <div className="statValue">{strengthThisWeek}/2</div>
              </div>
              <div className="statCard">
                <div className="statLabel">👙 Core</div>
                <div className="statValue">{coreThisWeek}/5</div>
              </div>
              <div className="statCard">
                <div className="statLabel">🧘 Pilates</div>
                <div className="statValue">{pilatesThisWeek}/1</div>
              </div>
              <div className="statCard">
                <div className="statLabel">🏃 Cardio</div>
                <div className="statValue">{cardioMinutesWeek}</div>
                <div className="muted">/ {ctx.settings.cardioGoalMinPerWeek ?? 240} min</div>
              </div>
            </div>
          </div>

          <div style={{height:12}} />

          <div className="card">
            <div className="h2" style={{marginTop:0}}>Today’s Plan</div>

            <div style={{display:'grid', gridTemplateColumns:'1fr', gap:10, marginTop:10}}>
              {isCoreDay && (
                <div className={coreDoneToday ? "taskCard done" : "taskCard"}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div className="exerciseName">👙 Core</div>
                      <div className="muted">5×/week · 6–10 min</div>
                    </div>
                    <button className={coreDoneToday ? "smallBtn" : "smallBtn primary"} onClick={()=> setActive(buildSession('CORE', todayISO))}>
                      {coreDoneToday ? "View" : "Start"}
                    </button>
                  </div>
                </div>
              )}

              <div className={cardioDoneToday ? "taskCard done" : "taskCard"}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div className="exerciseName">🏃 Cardio</div>
                    <div className="muted">Goal ≥ 20 min (today: {cardioMinutesToday} min)</div>
                  </div>
                  <button className={cardioDoneToday ? "smallBtn" : "smallBtn primary"} onClick={()=>ctx.setTab('cardio')}>
                    {cardioDoneToday ? "Edit" : "Log"}
                  </button>
                </div>
              </div>

              {strengthDueToday && (
                <div className={strengthDoneToday ? "taskCard done" : "taskCard due"}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div className="exerciseName">💪 Strength</div>
                      <div className="muted">Due: Workout {nextStrength.workoutKey}</div>
                    </div>
                    <button
                      className={strengthDoneToday ? "smallBtn" : "smallBtn primary"}
                      onClick={()=> setActive(buildSession(nextStrength.workoutKey, todayISO))}
                    >
                      {strengthDoneToday ? "View" : "Start"}
                    </button>
                  </div>
                </div>
              )}

              {isPilatesDay && (
                <div className={pilatesDoneToday ? "taskCard done" : "taskCard"}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div className="exerciseName">🧘 Pilates</div>
                      <div className="muted">Upper body · 20 min</div>
                    </div>
                    <button className={pilatesDoneToday ? "smallBtn" : "smallBtn primary"} onClick={()=> setActive(buildSession('PILATES', todayISO))}>
                      {pilatesDoneToday ? "View" : "Start"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{height:14}} />

            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div className="h2" style={{margin:0}}>Primary Action</div>
                <div className="muted" style={{marginTop:4}}>
                  {primaryAction==='strength' ? 'Strength is due today.' :
                   primaryAction==='pilates' ? 'Today is your Pilates day.' :
                   primaryAction==='core' ? 'Bank your core session.' :
                   primaryAction==='cardio' ? 'Log your cardio minutes.' :
                   'Nice work — review progress or meals.'}
                </div>
              </div>
              <div className="pill teal">{nextStrength.isoDate === todayISO ? 'Today' : nextStrength.isoDate}</div>
            </div>

            <div style={{height:12}} />

            {primaryAction==='strength' && (
              <button className="bigBtn" onClick={()=> setActive(buildSession(nextStrength.workoutKey, todayISO))}>START STRENGTH</button>
            )}
            {primaryAction==='pilates' && (
              <button className="bigBtn" onClick={()=> setActive(buildSession('PILATES', todayISO))}>START PILATES</button>
            )}
            {primaryAction==='core' && (
              <button className="bigBtn" onClick={()=> setActive(buildSession('CORE', todayISO))}>START CORE</button>
            )}
            {primaryAction==='cardio' && (
              <button className="bigBtn" onClick={()=> ctx.setTab('cardio')}>LOG CARDIO</button>
            )}
            {primaryAction==='progress' && (
              <button className="bigBtn" onClick={()=> ctx.setTab('progress')}>VIEW PROGRESS</button>
            )}

            <div style={{height:10}} />

            <div className="row" style={{flexWrap:'wrap'}}>
              {showAccessory && (
                <button className="smallBtn orchid" onClick={()=> setActive(buildSession('GLUTE', todayISO))}>
                  Optional Glute Accessory
                </button>
              )}
              <button className="smallBtn" onClick={()=>ctx.setTab('meals')}>Open Meals + Macros</button>
              <button className="smallBtn" onClick={()=>ctx.setTab('progress')}>Open Progress</button>
            </div>
          </div>

          <div style={{height:12}} />

          <div className="card">
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div className="h2" style={{margin:0}}>💧 Water</div>
                <div className="muted">{(waterTodayMl/1000).toFixed(2)}L / {(waterGoalMl/1000).toFixed(1)}L</div>
              </div>
              <div className="pill teal">{Math.round(waterTodayMl/250)} / {Math.round(waterGoalMl/250)} cups</div>
            </div>
            <div className="progressBar" style={{marginTop:10}}><div style={{width: `${waterPct}%`}} /></div>
            <div style={{marginTop:10, fontSize:20, letterSpacing:2}}>
              {Array.from({length: Math.max(1, Math.round(waterGoalMl/250))}).map((_,i)=>(
                <span key={i} style={{opacity: i < Math.round(waterTodayMl/250) ? 1 : 0.25}}>💧</span>
              ))}
            </div>
            <div style={{height:10}} />
            <div className="row" style={{flexWrap:'wrap'}}>
              <button className="smallBtn" onClick={()=>adjustWater(-250)}>-250 mL</button>
              <button className="smallBtn primary" onClick={()=>adjustWater(250)}>+250 mL</button>
              <button className="smallBtn" onClick={()=>adjustWater(500)}>+500 mL</button>
              <button className="smallBtn" onClick={()=>adjustWater(750)}>+750 mL</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
