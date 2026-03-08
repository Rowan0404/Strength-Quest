import React, { useMemo, useState } from 'react';
import Modal from './components/Modal';
import { BADGES } from '../lib/badges';
import { isoToday } from '../lib/plan';

function isoWeekKeyFromISO(iso: string){
  const d = new Date(iso + 'T00:00:00Z');
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-${String(weekNo).padStart(2,'0')}`;
}

function withinDays(iso: string, days: number){
  const [y,m,d] = iso.split('-').map(Number);
  const t = Date.UTC(y, (m-1), d);
  const now = new Date();
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = (n - t) / 86400000;
  return diffDays >= 0 && diffDays <= days;
}

export default function Progress({ ctx }:{ ctx:any }){
  const today = isoToday();
  const thisWeekKey = isoWeekKeyFromISO(today);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const earnedSet = useMemo(()=> new Set((ctx.badges ?? []).map((x:any)=>x.id)), [ctx.badges]);

  const stats = useMemo(()=>{
    const sessions = ctx.sessions ?? [];
    const cardio = ctx.cardio ?? [];

    const strength = sessions.filter((s:any)=> (s.workoutKey==='A' || s.workoutKey==='B') && !!s.finishedAt);
    const core = sessions.filter((s:any)=> s.workoutKey==='CORE' && !!s.finishedAt);
    const pilates = sessions.filter((s:any)=> s.workoutKey==='PILATES' && !!s.finishedAt);

    const strengthThisWeek = strength.filter((s:any)=> isoWeekKeyFromISO(s.isoDate)===thisWeekKey);
    const coreThisWeek = core.filter((s:any)=> isoWeekKeyFromISO(s.isoDate)===thisWeekKey);
    const pilatesThisWeek = pilates.filter((s:any)=> isoWeekKeyFromISO(s.isoDate)===thisWeekKey);

    const cardioThisWeek = cardio.filter((c:any)=> isoWeekKeyFromISO(c.isoDate)===thisWeekKey);
    const cardioMinutesThisWeek = cardioThisWeek.reduce((sum:number,c:any)=> sum + (c.minutes||0), 0);

    const strength28 = strength.filter((s:any)=> withinDays(s.isoDate, 28)).length;
    const core28 = core.filter((s:any)=> withinDays(s.isoDate, 28)).length;
    const pilates28 = pilates.filter((s:any)=> withinDays(s.isoDate, 28)).length;
    const cardio28Min = cardio.filter((c:any)=> withinDays(c.isoDate, 28)).reduce((sum:number,c:any)=> sum + (c.minutes||0), 0);

    const strengthDays = new Set(strength.map((s:any)=> s.isoDate)).size;
    const coreDays = new Set(core.map((s:any)=> s.isoDate)).size;
    const pilatesDays = new Set(pilates.map((s:any)=> s.isoDate)).size;
    const cardioDays = new Set(cardio.map((c:any)=> c.isoDate)).size;

    const badgesEarned = Array.from(earnedSet).filter((id:string)=> BADGES.some(b=>b.id===id)).length;

    return {
      strengthThisWeekCount: strengthThisWeek.length,
      coreThisWeekCount: coreThisWeek.length,
      pilatesThisWeekCount: pilatesThisWeek.length,
      cardioMinutesThisWeek,

      strength28,
      core28,
      pilates28,
      cardio28Min,

      strengthDays,
      coreDays,
      pilatesDays,
      cardioDays,
      badgesEarned,
    };
  }, [ctx.sessions, ctx.cardio, ctx.badges, thisWeekKey, earnedSet]);

  const cardioGoal = Number(ctx.settings.cardioGoalMinPerWeek ?? 240);
  const cardioPct = cardioGoal>0 ? Math.min(100, Math.round((stats.cardioMinutesThisWeek/cardioGoal)*100)) : 0;

  return (
    <div className="container">
      <Modal
        open={badgesOpen}
        title="Badges"
        subtitle="Tiny wins that reinforce the habit loop."
        onClose={()=>setBadgesOpen(false)}
      >
        <div className="list">
          {BADGES.map((b:any)=>{
            const earned = earnedSet.has(b.id);
            return (
              <div key={b.id} className="exercise">
                <div className="exerciseHeader">
                  <div>
                    <div className="exerciseName">{b.icon} {b.title}</div>
                    <div className="badge">{b.desc}</div>
                  </div>
                  <div className={earned ? "pill teal" : "pill"}>{earned ? "Earned" : "Locked"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <div className="card hero">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div className="h1">📊 Progress</div>
            <div className="muted">Weekly goals: 2 strength · 5 core · 1 pilates · 240 min cardio</div>
          </div>
          <button className="smallBtn" onClick={()=>ctx.setTab('today')}>Back</button>
        </div>

        <div style={{height:12}} />

        <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10}}>
          <div className="statCard">
            <div className="statLabel">🔥 Current streak</div>
            <div className="statValue">{ctx.streak.current}{ctx.streak.paused ? ' (paused)' : ''}</div>
            <div className="muted" style={{marginTop:4}}>Longest: {ctx.streak.longest}</div>
          </div>

          <div className="statCard">
            <div className="statLabel">💪 Strength</div>
            <div className="statValue">{stats.strengthThisWeekCount} / 2</div>
            <div className="muted" style={{marginTop:4}}>Sun + Thu</div>
          </div>

          <div className="statCard">
            <div className="statLabel">👙 Core</div>
            <div className="statValue">{stats.coreThisWeekCount} / 5</div>
            <div className="muted" style={{marginTop:4}}>Mon Tue Wed Fri Sat</div>
          </div>

          <div className="statCard">
            <div className="statLabel">🧘 Pilates</div>
            <div className="statValue">{stats.pilatesThisWeekCount} / 1</div>
            <div className="muted" style={{marginTop:4}}>Saturday</div>
          </div>

          <div className="statCard" style={{gridColumn:'1 / -1'}}>
            <div className="statLabel">🏃 Cardio</div>
            <div className="statValue">{stats.cardioMinutesThisWeek} min</div>
            <div className="muted" style={{marginTop:4}}>Goal {cardioGoal} min / week</div>
            <div className="progressBar" style={{marginTop:10}}><div style={{width: cardioPct + '%'}} /></div>
          </div>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>All-time adherence</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10, marginTop:10}}>
          <div className="statCard">
            <div className="statLabel">Strength days</div>
            <div className="statValue">{stats.strengthDays}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Core days</div>
            <div className="statValue">{stats.coreDays}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Pilates days</div>
            <div className="statValue">{stats.pilatesDays}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Cardio days</div>
            <div className="statValue">{stats.cardioDays}</div>
          </div>
        </div>

        <div style={{height:12}} />

        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="h2" style={{margin:0}}>Badges</div>
            <div className="muted">Earned: {stats.badgesEarned} / {BADGES.length}</div>
          </div>
          <button className="smallBtn primary" onClick={()=>setBadgesOpen(true)}>View</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Last 28 days</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10, marginTop:10}}>
          <div className="statCard">
            <div className="statLabel">Strength sessions</div>
            <div className="statValue">{stats.strength28}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Core sessions</div>
            <div className="statValue">{stats.core28}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Pilates sessions</div>
            <div className="statValue">{stats.pilates28}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Cardio minutes</div>
            <div className="statValue">{stats.cardio28Min}</div>
            <div className="muted" style={{marginTop:4}}>min</div>
          </div>
        </div>

        <div className="muted" style={{marginTop:12}}>
          Show up often. Adjust the volume when needed, but protect the habit.
        </div>
      </div>

      <div style={{height:72}} />
    </div>
  );
}
