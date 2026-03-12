import React, { useEffect, useMemo, useState } from 'react';
import { deleteCardio, listCardio, saveCardio } from '../lib/db';
import type { CardioLog, CardioType } from '../lib/db';
import { isoToday } from '../lib/plan';
import Modal from './components/Modal';

function label(t: CardioType){
  if (t==='walk') return '🚶 Walk';
  if (t==='incline_walk') return '⛰️ Incline walk';
  if (t==='other') return '✨ Other';
  return '🚴 Bike';
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

export default function Cardio({ ctx }:{ ctx:any }){
  const [iso, setIso] = useState<string>(isoToday(ctx.settings?.timezone ?? 'America/Halifax'));
  const [all, setAll] = useState<CardioLog[]>([]);

  // modal state
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<CardioType>('walk');
  const [minutes, setMinutes] = useState<string>('30');
  const [note, setNote] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string>('');

  useEffect(()=>{
    (async()=>{
      const c = await listCardio();
      setAll(c);
    })();
  }, [ctx.ready]);

  const day = useMemo(()=> all.filter(x=>x.isoDate===iso).sort((a,b)=>b.createdAt-a.createdAt), [all, iso]);
  const dayMinutes = useMemo(()=> day.reduce((s,x)=> s + (x.minutes||0), 0), [day]);
  const weekKey = isoWeekKeyFromISO(iso);
  const weekMinutes = useMemo(()=> all.filter(x=> isoWeekKeyFromISO(x.isoDate)===weekKey).reduce((s,x)=> s + (x.minutes||0), 0), [all, weekKey]);
  const goal = Number(ctx.settings.cardioGoalMinPerWeek ?? 240);
  const pct = goal>0 ? Math.min(140, Math.round((weekMinutes/goal)*100)) : 0;

  async function refresh(){
    const c = await listCardio();
    setAll(c);
    await ctx.reload();
  }

  function openAdd(t: CardioType){
    setType(t);
    setMinutes('30');
    setNote('');
    setAddOpen(true);
  }

  async function submitAdd(){
    const mins = Math.round(Number(minutes));
    if (!Number.isFinite(mins) || mins <= 0) return;

    const entry: CardioLog = {
      id: `c_${iso}_${type}_${Date.now()}`,
      isoDate: iso as any,
      type,
      minutes: mins,
      note: note.trim() || undefined,
      createdAt: Date.now()
    };
    await saveCardio(entry);
    setAddOpen(false);
    await refresh();
  }

  function askDelete(id: string){
    setDeleteId(id);
    setConfirmOpen(true);
  }

  async function doDelete(){
    await deleteCardio(deleteId);
    setConfirmOpen(false);
    await refresh();
  }

  return (
    <div className="container">
      <Modal
        open={addOpen}
        title="Log cardio"
        subtitle="Steady-state minutes. Keep it simple."
        onClose={()=>setAddOpen(false)}
        footer={
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="smallBtn" onClick={()=>setAddOpen(false)}>Cancel</button>
            <button className="smallBtn primary" onClick={()=>void submitAdd()}>Save</button>
          </div>
        }
      >
        <div className="row">
          <button className={type==='walk' ? "smallBtn primary" : "smallBtn"} onClick={()=>setType('walk')}>🚶 Walk</button>
          <button className={type==='incline_walk' ? "smallBtn primary" : "smallBtn"} onClick={()=>setType('incline_walk')}>⛰️ Incline</button>
          <button className={type==='bike' ? "smallBtn primary" : "smallBtn"} onClick={()=>setType('bike')}>🚴 Bike</button>
          <button className={type==='other' ? "smallBtn primary" : "smallBtn"} onClick={()=>setType('other')}>✨ Other</button>
        </div>

        <div style={{height:12}} />

        <div className="row">
          <label className="pill">Minutes&nbsp;
            <input className="input" style={{width:120}} inputMode="numeric" value={minutes} onChange={(e)=>setMinutes(e.target.value)} />
          </label>
          <div className="muted">Most days: 20–45 min is plenty.</div>
        </div>

        <div style={{height:12}} />
        <div style={{fontWeight:900}}>Optional note</div>
        <textarea
          className="textarea"
          placeholder={type==='incline_walk' ? 'e.g., 3% incline' : 'e.g., easy pace'}
          value={note}
          onChange={(e)=>setNote(e.target.value)}
        />
      </Modal>

      <Modal
        open={confirmOpen}
        title="Delete cardio entry?"
        onClose={()=>setConfirmOpen(false)}
        footer={
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="smallBtn" onClick={()=>setConfirmOpen(false)}>Cancel</button>
            <button className="smallBtn primary" onClick={()=>void doDelete()}>Delete</button>
          </div>
        }
      >
        <div className="muted">This will remove the entry permanently from this device.</div>
      </Modal>

      <div className="card hero">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div className="h1">🏃 Cardio</div>
            <div className="muted">Log steady-state sessions (minutes).</div>
          </div>
          <button className="smallBtn" onClick={()=>ctx.setTab('today')}>Back</button>
        </div>

        <div style={{height:10}} />

        <div className="row">
          <label className="pill">
            Date&nbsp;
            <input className="input" style={{width:160}} type="date" value={iso} onChange={(e)=>setIso(e.target.value)} />
          </label>
          <div className="pill teal">Total today: {dayMinutes} min</div>
          <div className="pill orchid">This week: {weekMinutes}/{goal} min</div>
        </div>

        <div style={{height:10}} />
        <div className="progressBar" aria-label="weekly cardio progress">
          <div style={{width: Math.min(100,pct) + '%'}} />
        </div>
        <div className="muted" style={{marginTop:6}}>{pct}% of weekly goal</div>

        <div style={{height:10}} />

        <div className="row">
          <button className="smallBtn primary" onClick={()=>openAdd('walk')}>+ Walk</button>
          <button className="smallBtn primary" onClick={()=>openAdd('incline_walk')}>+ Incline walk</button>
          <button className="smallBtn primary" onClick={()=>openAdd('bike')}>+ Bike</button>
          <button className="smallBtn primary" onClick={()=>openAdd('other')}>+ Other</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Today’s entries</div>
        {day.length===0 ? (
          <div className="muted">No cardio logged for this date.</div>
        ) : (
          <div className="list">
            {day.map(x=>(
              <div key={x.id} className="exercise">
                <div className="exerciseHeader">
                  <div>
                    <div className="exerciseName">{label(x.type)}</div>
                    <div className="badge">{x.minutes} min{x.note ? ` · ${x.note}` : ''}</div>
                  </div>
                  <button className="smallBtn" onClick={()=>askDelete(x.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{height:72}} />
    </div>
  );
}
