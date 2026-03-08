import React, { useEffect, useMemo, useState } from 'react';
import type { DayFoodLog, FoodItem } from '../lib/db';
import { getMealLog, saveMealLog, listRecentFoods } from '../lib/db';
import { isoToday } from '../lib/plan';
import { listTemplates, setTemplateForDate, totals, listCatalog, swapItem, recordRecentFromItem } from '../lib/meals';
import { targetsForDate } from '../lib/nutrition';
import { usdaSearch, getOrFetchEntryFromHit } from '../lib/usda';
import Modal from './components/Modal';

function uid(){ return 'f_' + Math.random().toString(36).slice(2,10) + '_' + Date.now(); }

type AddMode = 'usda'|'manual'|'recent';

export default function Meals({ ctx }:{ ctx:any }){
  const templates = useMemo(()=> listTemplates(), []);
  const catalog = useMemo(()=> listCatalog(), []);
  const [iso, setIso] = useState<string>(isoToday());
  const [log, setLog] = useState<DayFoodLog|null>(null);

  // Modals
  const [templateOpen, setTemplateOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<'Breakfast'|'Lunch'|'Snack'|'Dinner'|'Other'>('Breakfast');
  const [addMode, setAddMode] = useState<AddMode>('usda');

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapItemId, setSwapItemId] = useState<string>('');
  const [swapQuery, setSwapQuery] = useState('');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItemId, setDetailsItemId] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('Confirm');
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmAction, setConfirmAction] = useState<null | (()=>Promise<void>)>(null);

  // Add food state
  const [recent, setRecent] = useState<any[]>([]);
  const [manual, setManual] = useState<any>({
    name:'', qty:1, unit:'serving',
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, iron_mg: ''
  });

  const [usdaQ, setUsdaQ] = useState('');
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaErr, setUsdaErr] = useState<string>('');
  const [usdaHits, setUsdaHits] = useState<any[]>([]);
  const [usdaQty, setUsdaQty] = useState<number>(1);

  useEffect(()=>{
    (async ()=>{
      const existing = await getMealLog(iso as any);
      setLog(existing ?? null);
    })();
  }, [iso]);

  const t = useMemo(()=> log ? totals(log.items) : { calories:0, protein_g:0, carbs_g:0, fat_g:0, iron_mg:0 }, [log]);

  const tf = useMemo(()=> targetsForDate(ctx.settings, iso as any), [ctx.settings, iso]);
  const targets = tf.targets;

  async function applyTemplate(templateId: string){
    const next = await setTemplateForDate(iso as any, templateId);
    setLog(next);
    setTemplateOpen(false);
    await ctx.reload();
  }

  async function patchItems(nextItems: FoodItem[], templateId?: string){
    const next: DayFoodLog = { isoDate: iso as any, templateId: templateId ?? log?.templateId, items: nextItems, updatedAt: Date.now() };
    await saveMealLog(next);
    setLog(next);
    await ctx.reload();
  }

  function groupByMeal(items: FoodItem[]){
    const meals = ['Breakfast','Lunch','Snack','Dinner','Other'] as const;
    const out: Record<string, FoodItem[]> = {};
    for (const m of meals) out[m] = [];
    for (const it of items) out[it.meal].push(it);
    return out;
  }

  function progressTile(metric: 'calories'|'protein'|'carbs'|'fat', label: string, value:number, target:number){
    const ratio = target<=0 ? 0 : (value/target);
    const pct = target<=0 ? 0 : Math.min(140, Math.round(ratio*100));

    let cls = "progressBar";
    if (metric !== 'protein' && ratio > 1){
      cls = ratio <= 1.10 ? "progressBar orange" : "progressBar red";
    }

    return (
      <div className="exercise" style={{padding:12}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{label}</div>
          <div className="muted">{value}/{target}</div>
        </div>
        <div className={cls} style={{marginTop:8}}>
          <div style={{width: Math.min(100,pct) + '%'}} />
        </div>
        <div className="muted" style={{marginTop:6}}>{pct}%</div>
      </div>
    );
  }


  async function toggleEaten(id: string){
    if (!log) return;
    const items = log.items.map(it=> it.id===id ? ({...it, eaten: !it.eaten}) : it);
    await patchItems(items);
  }

  async function adjustQty(id: string, delta: number){
    if (!log) return;
    const items = log.items.map(it=>{
      if (it.id!==id) return it;
      const q = Math.max(0, Math.round((it.qty + delta)*2)/2);
      return { ...it, qty: q };
    });
    await patchItems(items);
  }

  function openSwap(id: string){
    setSwapItemId(id);
    setSwapQuery('');
    setSwapOpen(true);
  }

  async function doSwap(pick: any){
    if (!log) return;
    const items = log.items.map(it=> it.id===swapItemId ? swapItem(it, pick) : it);
    await patchItems(items);
    const swapped = items.find(x=>x.id===swapItemId);
    if (swapped) await recordRecentFromItem({ ...swapped, source: swapped.source ?? 'catalog' });
    setSwapOpen(false);
  }

  function openAdd(meal: any){
    setAddMeal(meal);
    setAddMode('usda');
    setAddOpen(true);
    // load recents lazily
    void (async()=>{
      const r = await listRecentFoods(18);
      setRecent(r);
    })();
    setManual({ name:'', qty:1, unit:'serving', calories: 0, protein_g:0, carbs_g:0, fat_g:0, iron_mg:'' });
    setUsdaQ('');
    setUsdaQty(1);
    setUsdaErr('');
    setUsdaHits([]);
  }

async function ensureLog(): Promise<DayFoodLog>{
  if (log) return log;
  const empty: DayFoodLog = { isoDate: iso as any, templateId: undefined, items: [], updatedAt: Date.now() };
  await saveMealLog(empty);
  setLog(empty);
  return empty;
}

async function addItemToLog(item: FoodItem){
  const current = await ensureLog();
  await patchItems([item, ...current.items], current.templateId);
  await recordRecentFromItem(item);
}

  async function addManual(){
    const name = String(manual.name ?? '').trim();
    if (!name) return;

    const item: FoodItem = {
      id: uid(),
      name,
      meal: addMeal as any,
      qty: Number(manual.qty) || 1,
      unit: String(manual.unit || 'serving'),
      calories: Number(manual.calories) || 0,
      protein_g: Number(manual.protein_g) || 0,
      carbs_g: Number(manual.carbs_g) || 0,
      fat_g: Number(manual.fat_g) || 0,
      iron_mg: String(manual.iron_mg ?? '').trim() ? Number(manual.iron_mg) : undefined,
      eaten: true,
      source: 'manual'
    };
    await addItemToLog(item);
    setAddOpen(false);
  }

  async function addFromRecent(r:any){
    const item: FoodItem = {
      id: uid(),
      name: r.name,
      meal: addMeal as any,
      qty: Number(r._qty ?? 1),
      unit: r.unit,
      calories: r.calories,
      protein_g: r.protein_g,
      carbs_g: r.carbs_g,
      fat_g: r.fat_g,
      iron_mg: r.iron_mg,
      eaten: true,
      source: 'recent',
      sourceRef: r.sourceRef
    };
    await addItemToLog(item);
    setAddOpen(false);
  }

  async function searchUSDA(){
    const apiKey = String(ctx.settings.usdaApiKey ?? '').trim();
    if (!apiKey) {
      setUsdaErr('Add your free USDA API key in Settings → USDA food lookup.');
      return;
    }
    const q = usdaQ.trim();
    if (!q) return;
    setUsdaLoading(true);
    setUsdaErr('');
    try{
      const hits = await usdaSearch(q, apiKey);
      setUsdaHits(hits);
      if (hits.length===0) setUsdaErr('No results. Try a simpler term like “strawberries”.');
    }catch(e:any){
      setUsdaErr(e?.message ?? 'USDA lookup failed.');
    }finally{
      setUsdaLoading(false);
    }
  }

  async function addFromUSDAHit(hit:any){
    const entry = await getOrFetchEntryFromHit(hit);
    const item: FoodItem = {
      id: uid(),
      name: entry.name,
      meal: addMeal as any,
      qty: usdaQty,
      unit: entry.unit,
      calories: entry.calories,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
      iron_mg: entry.iron_mg,
      eaten: true,
      source: 'usda',
      sourceRef: entry.id.replace('usda:','')
    };
    await addItemToLog(item);
    setAddOpen(false);
  }


  function openDetails(id: string){
    setDetailsItemId(id);
    setDetailsOpen(true);
  }
  function confirmRemove(id: string){
    if (!log) return;
    const it = log.items.find(x=>x.id===id);
    setConfirmTitle('Remove item?');
    setConfirmBody(<div className="muted">Remove <strong style={{color:'#fff'}}>{it?.name ?? 'this item'}</strong> from today?</div>);
    setConfirmAction(async()=>{
      if (!log) return;
      const items = log.items.filter(x=>x.id!==id);
      await patchItems(items);
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  }

  const grouped = useMemo(()=> log ? groupByMeal(log.items) : null, [log]);

  const swapMatches = useMemo(()=>{
    const q = swapQuery.trim().toLowerCase();
    const list = q ? catalog.filter(c=> c.name.toLowerCase().includes(q)) : catalog;
    return list.slice(0, 18);
  }, [swapQuery, catalog]);

  return (
    <div className="container">
      <Modal
        open={templateOpen}
        title="Choose a menu day"
        subtitle="Pick a default day, then swap items as needed."
        onClose={()=>setTemplateOpen(false)}
      >
        <div className="list">
          {templates.map((d:any)=>(
            <div key={d.id} className="exercise">
              <div className="exerciseHeader">
                <div>
                  <div className="exerciseName">{d.title}</div>
                  <div className="badge">Tap to apply</div>
                </div>
                <button className="smallBtn primary" onClick={()=>applyTemplate(d.id)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={swapOpen}
        title="Swap item"
        subtitle="Search and pick a replacement (from your catalog)."
        onClose={()=>setSwapOpen(false)}
      >
        <div className="row">
          <input className="input" placeholder="Search (e.g., yogurt, tuna, tortilla)" value={swapQuery} onChange={(e)=>setSwapQuery(e.target.value)} style={{flex:1}} />
        </div>
        <div style={{height:10}} />
        <div className="list">
          {swapMatches.map((c:any)=>(
            <div key={c.name} className="exercise">
              <div className="exerciseHeader">
                <div>
                  <div className="exerciseName">{c.name}</div>
                  <div className="badge">{c.unit} · {Math.round(c.calories)} kcal</div>
                </div>
                <button className="smallBtn primary" onClick={()=>doSwap(c)}>Swap</button>
              </div>
            </div>
          ))}
        </div>
      </Modal>


      <Modal
        open={detailsOpen}
        title="Food details"
        subtitle="Review macros, then adjust or swap if needed."
        onClose={()=>setDetailsOpen(false)}
      >
        {log && (()=>{ 
          const it = log.items.find(x=>x.id===detailsItemId);
          if (!it) return <div className="muted">Item not found.</div>;
          const kcal = Math.round(it.calories*it.qty);
          const p = Math.round(it.protein_g*it.qty);
          const c = Math.round(it.carbs_g*it.qty);
          const f = Math.round(it.fat_g*it.qty);
          const fe = it.iron_mg!=null ? (Math.round(it.iron_mg*it.qty*10)/10) : null;
          return (
            <div>
              <div className="h2" style={{marginTop:0}}>{it.name}</div>
              <div className="muted" style={{marginTop:6}}>Serving: {it.qty} {it.unit}{it.source ? ` • ${it.source.toUpperCase()}` : ''}</div>

              <div style={{height:12}} />

              <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10}}>
                <div className="statCard">
                  <div className="statLabel">Calories</div>
                  <div className="statValue">{kcal}</div>
                </div>
                <div className="statCard">
                  <div className="statLabel">Macros</div>
                  <div className="statValue" style={{fontSize:16}}>P{p} C{c} F{f}</div>
                  {fe!=null && <div className="muted" style={{marginTop:6}}>Fe {fe} mg</div>}
                </div>
              </div>

              <div style={{height:12}} />

              <div className="row" style={{flexWrap:'wrap'}}>
                <button className="smallBtn" onClick={()=>{ void adjustQty(it.id, -0.5); }}>-½ serving</button>
                <button className="smallBtn" onClick={()=>{ void adjustQty(it.id, +0.5); }}>+½ serving</button>
                <button className="smallBtn primary" onClick={()=>{ setDetailsOpen(false); openSwap(it.id); }}>Swap</button>
                <button className="smallBtn" onClick={()=>{ setDetailsOpen(false); confirmRemove(it.id); }}>Remove</button>
              </div>

              <div style={{height:10}} />
              <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <div className="muted">Mark eaten</div>
                <div className={it.eaten ? 'check on' : 'check'} onClick={()=>void toggleEaten(it.id)} role="button" aria-label="toggle eaten" />
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={confirmOpen}
        title={confirmTitle}
        onClose={()=>setConfirmOpen(false)}
        footer={
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="smallBtn" onClick={()=>setConfirmOpen(false)}>Cancel</button>
            <button className="smallBtn primary" onClick={()=>{ void confirmAction?.(); }}>Yes</button>
          </div>
        }
      >
        {confirmBody}
      </Modal>

      <Modal
        open={addOpen}
        title={`Add food · ${addMeal}`}
        subtitle="USDA search, quick manual entry, or recent foods."
        onClose={()=>setAddOpen(false)}
      >
        <div className="row">
          <button className={addMode==='usda' ? "smallBtn primary" : "smallBtn"} onClick={()=>setAddMode('usda')}>USDA</button>
          <button className={addMode==='manual' ? "smallBtn primary" : "smallBtn"} onClick={()=>setAddMode('manual')}>Manual</button>
          <button className={addMode==='recent' ? "smallBtn primary" : "smallBtn"} onClick={()=>setAddMode('recent')}>Recent</button>
        </div>

        {addMode==='usda' && (
          <div style={{marginTop:12}}>
            <div className="row">
              <input className="input" placeholder='Search (e.g., "strawberries", "egg whites")' value={usdaQ} onChange={(e)=>setUsdaQ(e.target.value)} style={{flex:1}} />
              <button className="smallBtn primary" onClick={()=>void searchUSDA()} disabled={usdaLoading}>{usdaLoading ? 'Searching…' : 'Search'}</button>
            </div>

            <div className="row" style={{marginTop:10}}>
              <label className="pill">Servings&nbsp;
                <input className="input" style={{width:90}} inputMode="decimal" value={usdaQty} onChange={(e)=>setUsdaQty(Math.max(0.25, Number(e.target.value)||1))} />
              </label>
              <div className="muted">Uses the serving shown by USDA when available.</div>
            </div>

            {usdaErr && <div className="muted" style={{marginTop:10}}>{usdaErr}</div>}

            {usdaHits.length>0 && (
              <div className="list" style={{marginTop:12}}>
                {usdaHits.map((h:any)=>(
                  <div key={h.fdcId} className="exercise">
                    <div className="exerciseHeader">
                      <div>
                        <div className="exerciseName">{h.description}{h.brandName ? ` — ${h.brandName}` : ''}</div>
                        <div className="badge">Tap add to log</div>
                      </div>
                      <button className="smallBtn primary" onClick={()=>void addFromUSDAHit(h)}>Add</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {addMode==='manual' && (
          <div style={{marginTop:12}}>
            <div className="row">
              <input className="input" placeholder="Name (e.g., Greek yogurt)" value={manual.name} onChange={(e)=>setManual({...manual, name:e.target.value})} style={{flex:1}} />
            </div>

            <div style={{height:10}} />
            <div className="row">
              <label className="pill">Servings&nbsp;
                <input className="input" style={{width:90}} inputMode="decimal" value={manual.qty} onChange={(e)=>setManual({...manual, qty:Number(e.target.value)||1})} />
              </label>
              <label className="pill">Unit&nbsp;
                <input className="input" style={{width:140}} value={manual.unit} onChange={(e)=>setManual({...manual, unit:e.target.value})} />
              </label>
            </div>

            <div style={{height:10}} />
            <div className="row">
              <label className="pill">Calories&nbsp;<input className="input" style={{width:110}} inputMode="decimal" value={manual.calories} onChange={(e)=>setManual({...manual, calories:Number(e.target.value)||0})} /></label>
              <label className="pill">Protein g&nbsp;<input className="input" style={{width:110}} inputMode="decimal" value={manual.protein_g} onChange={(e)=>setManual({...manual, protein_g:Number(e.target.value)||0})} /></label>
              <label className="pill">Carbs g&nbsp;<input className="input" style={{width:110}} inputMode="decimal" value={manual.carbs_g} onChange={(e)=>setManual({...manual, carbs_g:Number(e.target.value)||0})} /></label>
              <label className="pill">Fat g&nbsp;<input className="input" style={{width:110}} inputMode="decimal" value={manual.fat_g} onChange={(e)=>setManual({...manual, fat_g:Number(e.target.value)||0})} /></label>
            </div>

            <div style={{height:10}} />
            <div className="row">
              <label className="pill">Iron mg (optional)&nbsp;<input className="input" style={{width:140}} inputMode="decimal" value={manual.iron_mg} onChange={(e)=>setManual({...manual, iron_mg:e.target.value})} /></label>
            </div>

            <div style={{height:12}} />
            <div className="row" style={{justifyContent:'flex-end'}}>
              <button className="smallBtn" onClick={()=>setAddOpen(false)}>Cancel</button>
              <button className="smallBtn primary" onClick={()=>void addManual()}>Add</button>
            </div>
          </div>
        )}

        {addMode==='recent' && (
          <div style={{marginTop:12}}>
            {recent.length===0 ? (
              <div className="muted">No recent foods yet. Add something once, then it will show here.</div>
            ) : (
              <div className="list">
                {recent.map((r:any)=>(
                  <div key={r.id} className="exercise">
                    <div className="exerciseHeader">
                      <div>
                        <div className="exerciseName">{r.name}</div>
                        <div className="badge">{r.unit} · {Math.round(r.calories)} kcal</div>
                      </div>
                      <div className="row">
                        <input
                          className="input"
                          inputMode="decimal"
                          style={{width:80}}
                          value={r._qty ?? 1}
                          onChange={(e)=>{
                            const q = Number(e.target.value) || 1;
                            setRecent(recent.map(x=> x.id===r.id ? ({...x, _qty:q}) : x));
                          }}
                        />
                        <button className="smallBtn primary" onClick={()=>void addFromRecent(r)}>Add</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className="card hero">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div className="h1">🍽 Meals</div>
            <div className="muted">Choose a template, then log what you actually ate.</div>
          </div>
          <button className="smallBtn" onClick={()=>ctx.setTab('today')}>Back</button>
        </div>

        <div style={{height:10}} />

        <div className="row">
          <label className="pill">
            Date&nbsp;
            <input className="input" style={{width:160}} type="date" value={iso} onChange={(e)=>setIso(e.target.value)} />
          </label>

          <button className="smallBtn primary" onClick={()=>setTemplateOpen(true)}>
            Choose menu day
          </button>

          {!log && (
            <button className="smallBtn" onClick={async()=>{ await ensureLog(); }}>
              Start blank day
            </button>
          )}

          {log?.templateId && <div className="pill teal">Template: {log.templateId}</div>}
          {ctx.settings.nutritionMode === 'auto_strength_days' && (
            <div className={"pill " + (tf.isStrengthDay ? 'teal' : 'orchid')}>{tf.isStrengthDay ? 'Strength-day targets' : 'Rest-day targets'}</div>
          )}
        </div>

        {!log && <div className="muted" style={{marginTop:10}}>No log for this date yet — choose a template or start a blank day.</div>}
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Progress today</div>
        <div className="row" style={{alignItems:'stretch'}}>
          <div style={{flex:1}}>{progressTile('calories','Calories', t.calories, targets.calorieTarget)}</div>
          <div style={{flex:1}}>{progressTile('protein','Protein g', t.protein_g, targets.proteinTarget)}</div>
        </div>
        <div className="row" style={{alignItems:'stretch', marginTop:10}}>
          <div style={{flex:1}}>{progressTile('carbs','Carbs g', t.carbs_g, targets.carbsTarget)}</div>
          <div style={{flex:1}}>{progressTile('fat','Fat g', t.fat_g, targets.fatTarget)}</div>
        </div>
        <div className="muted" style={{marginTop:10}}>Iron (estimate): <strong style={{color:'#fff'}}>{t.iron_mg} mg</strong></div>
      </div>

      {log && grouped && (
        <>
          {(['Breakfast','Lunch','Snack','Dinner','Other'] as const).map(meal=>(
            <div key={meal} style={{marginTop:12}}>
              <div className="card">
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div className="h2" style={{margin:0}}>{meal}</div>
                  <button className="smallBtn primary" onClick={()=>openAdd(meal)}>+ Add food</button>
                </div>

                <div style={{height:10}} />

                {grouped[meal].length===0 ? (
                  <div className="muted">No items.</div>
                ) : (
                  <div className="list">
                    {grouped[meal].map(it=>(
                      <div key={it.id} className="exercise">
                        <div className="exerciseHeader" style={{alignItems:'center'}}>
                          <div style={{flex:1, minWidth:0}}>
                            <button className="linkBtn" onClick={()=>openDetails(it.id)} style={{textAlign:'left', width:'100%'}}>
                              <div className="exerciseName" style={{marginBottom:2}}>{it.name}</div>
                              <div className="muted" style={{fontSize:12}}>Serving: {it.qty} {it.unit}{it.source ? ` • ${it.source.toUpperCase()}` : ''}</div>
                            </button>
                          </div>

                          <div className={it.eaten ? 'check on' : 'check'} onClick={()=>void toggleEaten(it.id)} role="button" aria-label="toggle eaten" />

                          <button className="smallBtn" style={{marginLeft:10}} onClick={()=>openDetails(it.id)} aria-label="more">⋯</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{height:72}} />
    </div>
  );
}
