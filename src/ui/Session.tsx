import React, { useMemo, useState } from 'react';
import { workoutTemplate } from '../lib/plan';
import type { SessionLog } from '../lib/db';
import Modal from './components/Modal';
import { Scale } from './components/Scale';

export default function Session({ session, weekNumber, history, unit='lb', onCancel, onSave, onFinish }:{
  session: SessionLog;
  weekNumber: number;
  history?: any[];
  unit?: string;
  onCancel: ()=>void;
  onSave: (s:SessionLog)=>Promise<void>;
  onFinish: (s:SessionLog)=>Promise<void>;
}){
  const tpl:any = useMemo(()=> workoutTemplate(weekNumber, session.workoutKey), [weekNumber, session.workoutKey]);
  const [local, setLocal] = useState<SessionLog>(session);

  function getPreviousWeights(exName: string){
    const prev = [...(history ?? [])]
      .filter((s:any)=> s.id !== local.id && !!s.finishedAt && s.setLogs?.[exName]?.some((x:any)=> typeof x.weight === 'number'))
      .sort((a:any,b:any)=> String(a.isoDate).localeCompare(String(b.isoDate)))
      .at(-1);
    if (!prev) return null;
    const weights = (prev.setLogs?.[exName] ?? []).map((x:any)=>x.weight).filter((x:any)=> typeof x === 'number');
    if (!weights.length) return null;
    const top = Math.max(...weights);
    return { top, weights };
  }

  function getLoadSuggestion(exName: string){
    const prev = getPreviousWeights(exName);
    if (!prev) return null;
    if (local.tiredMode || local.painMode) return 'Suggestion: match last time';
    if (prev.top < 20) return `Suggestion: try +2.5 ${unit}`;
    return `Suggestion: try +5 ${unit} if form stayed strong`;
  }


  function parsePrescription(p: string){
    // returns {sets, kind, lo, hi}
    const clean = String(p||'').replace(/–/g,'-').trim();
    const m = clean.match(/(\d+)\s*[×x]\s*([^\s]+)/i);
    const sets = m ? Number(m[1]) : 1;
    const right = m ? m[2] : clean;
    const isTime = /sec|s$/i.test(clean);
    // reps could be "10-12", "8/side", "15-25"
    const range = right.replace(/\/side/i,'').replace(/sec/i,'');
    const m2 = range.match(/(\d+)(?:-(\d+))?/);
    const lo = m2 ? Number(m2[1]) : 0;
    const hi = m2 && m2[2] ? Number(m2[2]) : lo;
    return { sets, isTime, lo, hi };
  }

  function makeSetLogsForExercise(ex:any, overrideSets?: number){
    const { sets, isTime, lo } = parsePrescription(ex.prescription||'');
    const n = Math.max(1, overrideSets ?? sets);
    const arr:any[] = [];
    for (let i=0;i<n;i++){
      const base:any = { setIndex:i, completed:false };
      if (ex.track==='weight'){
        base.weight = undefined;
        base.reps = lo || undefined;
      } else if (ex.track==='time' || isTime){
        base.seconds = lo || undefined;
      } else {
        base.reps = lo || undefined;
      }
      arr.push(base);
    }
    return arr;
  }

  function applyModes(exs:any[]){
    let out = exs.map(x=>({...x}));
    // pain mode substitutions (simple SI/back-friendly swaps)
    if (local.painMode){
      out = out.map(ex=>{
        const n = String(ex.name||'');
        if (/bulgarian split squat/i.test(n)) return { name:'Step-Ups (low height)', prescription:'2×8/side', cues:['Low step, slow down','Drive through heel','Stop before pain'], track:'weight' };
        if (/split squat/i.test(n)) return { name:'Box Squat to Bench (controlled)', prescription:'2×8–10', cues:['Sit back to a box/bench','Exhale on the way up','Keep ribs stacked'], track:'weight' };
        if (/romanian deadlift|\brdl\b/i.test(n)) return { name:'Hip Hinge to Wall (light)', prescription:'2×10', cues:['Tap hips to wall','Neutral spine','Light load only'], track:'reps' };
        return ex;
      });
    }

    // tired mode: reduce sets by 1 (min 1)
    if (local.tiredMode){
      out = out.map(ex=>{
        const p = parsePrescription(ex.prescription||'');
        const newSets = Math.max(1, p.sets - 1);
        return { ...ex, __overrideSets: newSets };
      });
    }

    // quick 15: keep first 3 exercises and cap to 2 sets each
    if (local.quick15){
      out = out.slice(0,3).map(ex=> ({...ex, __overrideSets: Math.min(2, (ex.__overrideSets ?? parsePrescription(ex.prescription||'').sets)) }));
    }
    return out;
  }

  function rebuildSetLogsForModes(nextLocal: SessionLog){
    const exs = applyModes(tpl.exercises);
    const nextSetLogs: any = {};
    for (const ex of exs){
      const key = ex.name;
      const existing = nextLocal.setLogs?.[key];
      const desired = makeSetLogsForExercise(ex, ex.__overrideSets);
      // preserve existing weight/reps if present
      nextSetLogs[key] = desired.map((s:any, idx:number)=>{
        const prev = existing?.[idx];
        return prev ? { ...s, weight: prev.weight ?? s.weight, reps: prev.reps ?? s.reps, seconds: prev.seconds ?? s.seconds, completed: prev.completed ?? false } : s;
      });
    }
    // drop logs for exercises no longer in view
    return nextSetLogs;
  }

  const allSets = useMemo(()=> Object.values(local.setLogs).flat(), [local.setLogs]);
  const done = allSets.filter((x:any)=>x.completed).length;
  const total = allSets.length;
  const pct = total===0 ? 0 : Math.round((done/total)*100);

  function toggleMode(key: 'quick15'|'tiredMode'|'painMode'|'skipLogging'){
    const next: any = { ...local, [key]: !local[key] };
    // Rebuild set logs when workout-shaping modes change
    if (key==='quick15' || key==='tiredMode' || key==='painMode'){
      next.setLogs = rebuildSetLogsForModes(next);
    }
    setLocal(next);
    void onSave(next);
  }

  function markExerciseDone(exName: string){
    const next = { ...local, setLogs: { ...local.setLogs } };
    next.setLogs[exName] = next.setLogs[exName].map(s=> ({ ...s, completed:true }));
    setLocal(next);
    void onSave(next);
  }

  function toggleSet(exName: string, setIdx: number){
    const next = { ...local, setLogs: { ...local.setLogs } };
    const arr = next.setLogs[exName].map(s=> ({...s}));
    arr[setIdx].completed = !arr[setIdx].completed;
    next.setLogs[exName] = arr;
    setLocal(next);
    void onSave(next);
  }

  function setReps(exName: string, setIdx: number, val: string){
  const num = val.trim()==='' ? undefined : Math.max(0, Math.round(Number(val)));
  const next = { ...local, setLogs: { ...local.setLogs } };
  const arr = next.setLogs[exName].map(s=> ({...s}));
  arr[setIdx].reps = Number.isFinite(num as any) ? num : undefined;
  next.setLogs[exName] = arr;
  setLocal(next);
  void onSave(next);
}

function setSeconds(exName: string, setIdx: number, val: string){
  const num = val.trim()==='' ? undefined : Math.max(0, Math.round(Number(val)));
  const next = { ...local, setLogs: { ...local.setLogs } };
  const arr = next.setLogs[exName].map(s=> ({...s}));
  arr[setIdx].seconds = Number.isFinite(num as any) ? num : undefined;
  next.setLogs[exName] = arr;
  setLocal(next);
  void onSave(next);
}

function setWeight(exName: string, setIdx: number, val: string){
    const num = val.trim()==='' ? undefined : Number(val);
    const next = { ...local, setLogs: { ...local.setLogs } };
    const arr = next.setLogs[exName].map(s=> ({...s}));
    arr[setIdx].weight = Number.isFinite(num as any) ? num : undefined;
    next.setLogs[exName] = arr;
    setLocal(next);
    void onSave(next);
  }

  const canFinish = done >= Math.max(1, Math.floor(total*0.5));

  // Rating modal state (visual scales)
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rpe, setRpe] = useState<number>(7);
  const [energy, setEnergy] = useState<number>(3);
  const [pain, setPain] = useState<'none'|'mild'|'moderate'>('none');
  const [note, setNote] = useState<string>('');

  async function finish(){
    const finished = { ...local, finishedAt: Date.now() };
    setLocal(finished);
    await onSave(finished);
    setRatingOpen(true);
  }

  async function submitRating(){
    const rated = {
      ...local,
      finishedAt: local.finishedAt ?? Date.now(),
      rating: { rpe: clamp(rpe,1,10), energy: clamp(energy,1,5), pain, note: note.trim() || undefined }
    };
    setRatingOpen(false);
    await onFinish(rated);
  }

  const coreAddon = (local.workoutKey === 'CORE' && weekNumber >= 5 && weekNumber <= 8) ? tpl.phase_addons?.["5-8"] : null;

  return (
    <div className="card">
      <Modal
        open={ratingOpen}
        title="Rate this session"
        subtitle="Quick check-in. Helps you spot patterns without overthinking."
        onClose={()=>setRatingOpen(false)}
        footer={
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="smallBtn" onClick={()=>setRatingOpen(false)}>Skip</button>
            <button className="smallBtn primary" onClick={submitRating}>Save rating</button>
          </div>
        }
      >
        <Scale
          label="RPE (effort)"
          min={1}
          max={10}
          value={rpe}
          onChange={setRpe}
          left="easy"
          right="max"
        />

        <Scale
          label="Energy"
          min={1}
          max={5}
          value={energy}
          onChange={setEnergy}
          left="low"
          right="high"
        />

        <div style={{marginTop:12}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div style={{fontWeight:900}}>Pain</div>
            <div className="pill orchid">{pain}</div>
          </div>
          <div className="row" style={{marginTop:10}}>
            <div className={"pill pillBtn " + (pain==='none' ? 'teal' : '')} onClick={()=>setPain('none')}>none</div>
            <div className={"pill pillBtn " + (pain==='mild' ? 'orchid' : '')} onClick={()=>setPain('mild')}>mild</div>
            <div className={"pill pillBtn " + (pain==='moderate' ? 'orchid' : '')} onClick={()=>setPain('moderate')}>moderate</div>
          </div>
        </div>

        <div style={{marginTop:12}}>
          <div style={{fontWeight:900}}>Optional note</div>
          <textarea
            className="textarea"
            placeholder="e.g., hip felt tight on split squats; energy low; slept 5h"
            value={note}
            onChange={(e)=>setNote(e.target.value)}
          />
        </div>
      </Modal>

      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <div className="h1">{tpl.title ?? `Workout ${local.workoutKey}`}</div>
          <div className="muted">Scroll list · tap-to-check sets · minimal decisions</div>
        </div>
        <button className="smallBtn" onClick={onCancel}>Close</button>
      </div>

      <div style={{height:10}} />

      <div className="row">
        <div className="pill teal pillBtn" onClick={()=>toggleMode('quick15')}>⚡ 15‑Min {local.quick15 ? 'ON' : 'OFF'}</div>
        <div className={"pill pillBtn " + (local.tiredMode ? "orchid" : "")} onClick={()=>toggleMode('tiredMode')}>😴 Tired {local.tiredMode ? 'ON' : 'OFF'}</div>
        <div className={"pill pillBtn " + (local.painMode ? "orchid" : "")} onClick={()=>toggleMode('painMode')}>🦵 Hurt {local.painMode ? 'ON' : 'OFF'}</div>
        <div className={"pill pillBtn " + (local.skipLogging ? "teal" : "")} onClick={()=>toggleMode('skipLogging')}>⏭ Skip logging {local.skipLogging ? 'ON' : 'OFF'}</div>
      </div>

      {coreAddon && (
        <div className="card" style={{marginTop:12}}>          <div className="h2" style={{marginTop:0}}>Phase 2 core add‑on</div>
          <div className="muted">{coreAddon.note}</div>
          <div className="muted" style={{marginTop:8, lineHeight:1.4}}>
            {coreAddon.add_one_of.map((x:any,i:number)=>(
              <div key={i}>• {x.name} — {x.prescription}</div>
            ))}
          </div>
        </div>
      )}

      {tpl.warmup?.length>0 && (
        <>
          <div className="h2">Warm-up (checklist)</div>
          <div className="list">
            {tpl.warmup.map((x:string, i:number)=>(
              <div key={i} className="exercise">
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div>{x}</div>
                  <div className="check on" title="Checklist item (not tracked in MVP)" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(local.quick15 || local.tiredMode || local.painMode) && (
        <div className="card" style={{marginTop:12}}>
          <div className="h2" style={{marginTop:0}}>Mode effects</div>
          <div className="muted">
            {local.quick15 && <div>⚡ 15‑Min: trims to the top 3 exercises and caps sets.</div>}
            {local.tiredMode && <div>😴 Tired: reduces volume (1 less set per move).</div>}
            {local.painMode && <div>🦵 Hurt: swaps to safer regressions + reduces load focus.</div>}
          </div>
        </div>
      )}

      <div className="h2">Exercises</div>
      <div className="list">
        {applyModes(tpl.exercises).map((ex:any)=>(
          <div key={ex.name} className="exercise">
            <div className="exerciseHeader">
              <div>
                <div className="exerciseName">{ex.name}</div>
                <div className="badge">{ex.prescription}</div>
                {String(ex.track || 'weight')==='weight' && getPreviousWeights(ex.name) && (
                  <div className="muted" style={{marginTop:6}}>
                    Last time: <strong style={{color:'#fff'}}>{getPreviousWeights(ex.name)?.top} {unit}</strong>
                    {getLoadSuggestion(ex.name) ? ` · ${getLoadSuggestion(ex.name)}` : ''}
                  </div>
                )}
              </div>
              <button className="smallBtn primary" onClick={()=>markExerciseDone(ex.name)}>Mark done</button>
            </div>

            {ex.cues?.length>0 && (
              <div className="muted" style={{marginTop:10}}>
                <strong style={{color:'#fff'}}>Cues:</strong> {ex.cues.join(' · ')}
              </div>
            )}

            <div style={{marginTop:10}}>
              {local.setLogs[ex.name]?.map((setLog:any)=>(
                <div key={setLog.setIndex} className="setRow">
                  <div>Set {setLog.setIndex+1}</div>
                  <div className="row">
                    {!local.skipLogging && (()=> {
                      const track = String(ex.track || 'weight');
                      const perSide = /\/side/i.test(String(ex.prescription || ''));
                      if (track==='none') return null;

                      if (track==='reps') {
                        return (
                          <div className="row">
                            <input
                              className="input"
                              inputMode="numeric"
                              placeholder="reps"
                              value={setLog.reps ?? ''}
                              onChange={(e)=>setReps(ex.name, setLog.setIndex, e.target.value)}
                            />
                            {perSide && <div className="pill" style={{padding:'6px 10px'}}>per side</div>}
                          </div>
                        );
                      }

                      if (track==='time') {
                        return (
                          <div className="row">
                            <input
                              className="input"
                              inputMode="numeric"
                              placeholder="sec"
                              value={setLog.seconds ?? ''}
                              onChange={(e)=>setSeconds(ex.name, setLog.setIndex, e.target.value)}
                            />
                            {perSide && <div className="pill" style={{padding:'6px 10px'}}>per side</div>}
                          </div>
                        );
                      }

                      return (
                        <input
                          className="input"
                          inputMode="decimal"
                          placeholder="wt"
                          value={setLog.weight ?? ''}
                          onChange={(e)=>setWeight(ex.name, setLog.setIndex, e.target.value)}
                        />
                      );
                    })()}
                    <div className={setLog.completed ? 'check on' : 'check'} onClick={()=>toggleSet(ex.name, setLog.setIndex)} role="button" aria-label="toggle set" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {tpl.cooldown?.length>0 && (
        <>
          <div className="h2">Cool-down (checklist)</div>
          <div className="list">
            {tpl.cooldown.map((x:string, i:number)=>(
              <div key={i} className="exercise">
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div>{x}</div>
                  <div className="check on" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="stickyFooter">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="muted">{done}/{total} sets</div>
          <div className="muted">{pct}%</div>
        </div>
        <div className="progressBar" style={{margin:'8px 0 10px'}}>
          <div style={{width: pct + '%'}} />
        </div>
        <button className="bigBtn" disabled={!canFinish} onClick={finish}>FINISH QUEST</button>
        {!canFinish && <div className="muted" style={{marginTop:8}}>Finish unlocks after ~50% complete.</div>}
      </div>

      <div style={{height:92}} />
    </div>
  );
}

function clamp(n:number, a:number, b:number){
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}
