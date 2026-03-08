import React, { useEffect, useMemo, useState } from 'react';
import Today from './Today';
import Progress from './Progress';
import { evaluateBadges } from '../lib/badges';
import Meals from './Meals';
import Settings from './Settings';
import Cardio from './Cardio';
import { getSettings, getStreak, listBadges, listSessions, listCardio, listWaterLogs, setSettings as saveSettings, setStreak as saveStreak } from '../lib/db';

export type Tab = 'today'|'meals'|'cardio'|'progress'|'settings';

export default function App(){
  const [tab, setTab] = useState<Tab>('today');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [cardio, setCardio] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [water, setWater] = useState<any[]>([]);

  async function refresh(){
    const [s, st, ss, cc, ww, bb] = await Promise.all([getSettings(), getStreak(), listSessions(), listCardio(), listWaterLogs(), listBadges()]);
    setSettings(s); setStreak(st); setSessions(ss); setCardio(cc); setWater(ww); setBadges(bb);
      // evaluate badge unlocks
      await evaluateBadges({ sessions: ss as any, cardio: cc as any, streakCurrent: st.current, cardioGoalMinPerWeek: (s as any).cardioGoalMinPerWeek ?? 240 });
      const bb2 = await listBadges();
      setBadges(bb2);
    setReady(true);
  }
  useEffect(()=>{ void refresh(); }, []);

  const ctx = useMemo(()=>({
    ready, settings, streak, sessions, cardio, water, badges,
    setTab,
    async updateSettings(next:any){ setSettings(next); await saveSettings(next); },
    async updateStreak(next:any){ setStreak(next); await saveStreak(next); },
    async reload(){ await refresh(); }
  }), [ready, settings, streak, sessions, cardio, water, badges]);

  if (!ready) return <div className="container"><div className="card">Loading…</div></div>;

  return (
    <>
      {tab==='today' && <Today ctx={ctx} />}
      {tab==='meals' && <Meals ctx={ctx} />}
      {tab==='cardio' && <Cardio ctx={ctx} />}
      {tab==='progress' && <Progress ctx={ctx} />}
      {tab==='settings' && <Settings ctx={ctx} />}

      <div className="nav">
        <button className={tab==='today' ? 'active' : ''} onClick={()=>setTab('today')}>🪄 Today</button>
        <button className={tab==='meals' ? 'active' : ''} onClick={()=>setTab('meals')}>🍽 Meals</button>
        <button className={tab==='cardio' ? 'active' : ''} onClick={()=>setTab('cardio')}>🏃 Cardio</button>
        <button className={tab==='progress' ? 'active' : ''} onClick={()=>setTab('progress')}>📊 Progress</button>
        <button className={tab==='settings' ? 'active' : ''} onClick={()=>setTab('settings')}>⚙️ Settings</button>
      </div>
    </>
  );
}
