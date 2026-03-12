import React, { useState } from 'react';
import { buildRecurringICS } from '../lib/ics';
import { downloadText, sessionsToCSV, sessionToShareText, mealLogsToCSV } from '../lib/exporters';
import { listSessions, listMealLogs } from '../lib/db';

export default function Settings({ ctx }:{ ctx:any }){
  const [startDateISO, setStartDateISO] = useState(ctx.settings.startDateISO);
  const [preferredTime, setPreferredTime] = useState(ctx.settings.preferredTime);
  const [unit, setUnit] = useState(ctx.settings.unit);

  const [nutritionMode, setNutritionMode] = useState(ctx.settings.nutritionMode ?? 'auto_strength_days');

  const [restCalories, setRestCalories] = useState(String(ctx.settings.restDayTargets?.calorieTarget ?? 1450));
  const [restProtein, setRestProtein] = useState(String(ctx.settings.restDayTargets?.proteinTarget ?? 130));
  const [restCarbs, setRestCarbs] = useState(String(ctx.settings.restDayTargets?.carbsTarget ?? 120));
  const [restFat, setRestFat] = useState(String(ctx.settings.restDayTargets?.fatTarget ?? 50));

  const [strCalories, setStrCalories] = useState(String(ctx.settings.strengthDayTargets?.calorieTarget ?? 1550));
  const [strProtein, setStrProtein] = useState(String(ctx.settings.strengthDayTargets?.proteinTarget ?? 130));
  const [strCarbs, setStrCarbs] = useState(String(ctx.settings.strengthDayTargets?.carbsTarget ?? 150));
  const [strFat, setStrFat] = useState(String(ctx.settings.strengthDayTargets?.fatTarget ?? 50));

  const [usdaApiKey, setUsdaApiKey] = useState(String(ctx.settings.usdaApiKey ?? ''));
  const [cardioGoal, setCardioGoal] = useState(String(ctx.settings.cardioGoalMinPerWeek ?? 240));
  const [programStartWeek, setProgramStartWeek] = useState(String(ctx.settings.programStartWeek ?? 4));
  const [displayWeeksTotal, setDisplayWeeksTotal] = useState(String(ctx.settings.displayWeeksTotal ?? 9));
  const [waterGoalMl, setWaterGoalMl] = useState(String(ctx.settings.waterGoalMl ?? 2000));
  const [timezone, setTimezone] = useState(String(ctx.settings.timezone ?? 'America/Halifax'));
  const [savedMsg, setSavedMsg] = useState('');

  async function save(){
    const next = {
      ...ctx.settings,
      startDateISO,
      preferredTime,
      unit,
      nutritionMode,
      restDayTargets: {
        calorieTarget: Number(restCalories),
        proteinTarget: Number(restProtein),
        carbsTarget: Number(restCarbs),
        fatTarget: Number(restFat),
      },
      strengthDayTargets: {
        calorieTarget: Number(strCalories),
        proteinTarget: Number(strProtein),
        carbsTarget: Number(strCarbs),
        fatTarget: Number(strFat),
      },
      usdaApiKey,
      cardioGoalMinPerWeek: Number(cardioGoal),
      programStartWeek: Number(programStartWeek),
      displayWeeksTotal: Number(displayWeeksTotal),
      waterGoalMl: Number(waterGoalMl),
      timezone
    };
    await ctx.updateSettings(next);
    await ctx.reload();
    setSavedMsg('Saved ✅'); setTimeout(()=>setSavedMsg(''), 1600);
  }

  async function exportWorkoutsCSV(){
    const sessions = await listSessions();
    downloadText('strength-quest-workouts.csv', sessionsToCSV(sessions), 'text/csv');
  }

  async function exportMealsCSV(){
    const logs = await listMealLogs();
    downloadText('strength-quest-meals.csv', mealLogsToCSV(logs), 'text/csv');
  }

  async function exportLatestSummary(){
    const sessions = await listSessions();
    const s = sessions.sort((a:any,b:any)=> a.isoDate.localeCompare(b.isoDate)).slice(-1)[0];
    if (!s) return setSavedMsg('No sessions yet.'); setTimeout(()=>setSavedMsg(''), 1800);
    downloadText(`strength-quest-${s.isoDate}.txt`, sessionToShareText(s), 'text/plain');
  }

  function addCalendar(){
    const ics = buildRecurringICS({
      title: 'Wizard Training: Strength Quest (Strength Days)',
      startDateISO,
      byDays: ['SU','TH'] as any,
      timeHHMM: preferredTime,
      durationMin: 45,
      url: location.href,
      alarmMinBefore: 10
    });
    downloadText('strength-quest-strength-reminders.ics', ics, 'text/calendar');
  }

  return (
    <div className="container">
      <div className="card hero">
        <div className="h1">⚙️ Settings</div>
        <div className="muted">Device-only · offline-first · high-contrast</div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Training schedule</div>
        <div className="row">
          <div className="pill teal">Strength days: Sunday + Thursday</div>
          <div className="pill orchid">Time: {preferredTime}</div>
        </div>

        <div style={{height:10}} />

        <div className="row">
          <label className="pill">
            Start date&nbsp;
            <input className="input" style={{width:160}} type="date" value={startDateISO} onChange={(e)=>setStartDateISO(e.target.value)} />
          </label>

          <label className="pill">
            Preferred time&nbsp;
            <input className="input" style={{width:120}} type="time" value={preferredTime} onChange={(e)=>setPreferredTime(e.target.value)} />
          </label>

          <label className="pill">
            Unit&nbsp;
            <select className="input" style={{width:120}} value={unit} onChange={(e)=>setUnit(e.target.value as any)}>
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </label>

          <label className="pill">
            Program starts at week&nbsp;
            <input className="input" style={{width:80}} inputMode="numeric" value={programStartWeek} onChange={(e)=>setProgramStartWeek(e.target.value)} />
          </label>

          <label className="pill">
            Display weeks total&nbsp;
            <input className="input" style={{width:80}} inputMode="numeric" value={displayWeeksTotal} onChange={(e)=>setDisplayWeeksTotal(e.target.value)} />
          </label>

          <label className="pill">
            Water goal (mL)&nbsp;
            <input className="input" style={{width:100}} inputMode="numeric" value={waterGoalMl} onChange={(e)=>setWaterGoalMl(e.target.value)} />
          </label>

          <label className="pill">
            Timezone&nbsp;
            <select className="input" style={{width:190}} value={timezone} onChange={(e)=>setTimezone(e.target.value)}>
              <option value="America/Halifax">Atlantic (Halifax)</option>
              <option value="America/Toronto">Eastern (Toronto)</option>
              <option value="America/Winnipeg">Central (Winnipeg)</option>
              <option value="America/Edmonton">Mountain (Edmonton)</option>
              <option value="America/Vancouver">Pacific (Vancouver)</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
        </div>

        <div style={{marginTop:12}} className="row">
          <button className="smallBtn primary" onClick={save}>Save</button>
          <button className="smallBtn" onClick={addCalendar}>Add Strength Days to Calendar (ICS)</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Nutrition targets</div>
        <div className="muted">Auto strength-day targets apply on Sun/Thu.</div>

        <div style={{height:10}} />

        <div className="row">
          <label className="pill">Mode&nbsp;
            <select className="input" style={{width:260}} value={nutritionMode} onChange={(e)=>setNutritionMode(e.target.value as any)}>
              <option value="auto_strength_days">Auto: higher on strength days</option>
              <option value="single">Single target every day</option>
            </select>
          </label>
        </div>

        <div style={{height:10}} />

        <div className="h2">Rest-day targets</div>
        <div className="row">
          <label className="pill">Calories&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={restCalories} onChange={(e)=>setRestCalories(e.target.value)} /></label>
          <label className="pill">Protein g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={restProtein} onChange={(e)=>setRestProtein(e.target.value)} /></label>
          <label className="pill">Carbs g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={restCarbs} onChange={(e)=>setRestCarbs(e.target.value)} /></label>
          <label className="pill">Fat g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={restFat} onChange={(e)=>setRestFat(e.target.value)} /></label>
        </div>

        <div style={{height:10}} />

        <div className="h2">Strength-day targets (Sun/Thu)</div>
        <div className="row">
          <label className="pill">Calories&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={strCalories} onChange={(e)=>setStrCalories(e.target.value)} /></label>
          <label className="pill">Protein g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={strProtein} onChange={(e)=>setStrProtein(e.target.value)} /></label>
          <label className="pill">Carbs g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={strCarbs} onChange={(e)=>setStrCarbs(e.target.value)} /></label>
          <label className="pill">Fat g&nbsp;<input className="input" style={{width:110}} inputMode="numeric" value={strFat} onChange={(e)=>setStrFat(e.target.value)} /></label>
        </div>

        <div style={{marginTop:12}} className="row">
          <button className="smallBtn primary" onClick={save}>Save</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>USDA food lookup (optional)</div>
        <div className="muted">
          If you add a free FoodData Central API key, you can search foods (e.g., “1 cup strawberries”) and auto-fill calories/macros/iron.
          Searches require internet, but results are cached for quick reuse.
        </div>

        <div style={{height:10}} />

        <div className="row">
          <label className="pill">
            USDA API key&nbsp;
            <input className="input" style={{width:320}} placeholder="paste key (optional)" value={usdaApiKey} onChange={(e)=>setUsdaApiKey(e.target.value)} />
          </label>
          <button className="smallBtn" onClick={save}>Save</button>
        </div>

        <div className="muted" style={{marginTop:10}}>
          Tip: keep this blank if you prefer 100% offline. Manual entry + recent foods still works.
        </div>
      <div style={{height:12}} />

<div className="card">
  <div className="h2" style={{marginTop:0}}>Cardio goal</div>
  <div className="muted">Weekly steady-state goal (used in Progress + Cardio tabs).</div>

  <div style={{height:10}} />

  <div className="row">
    <label className="pill">
      Minutes per week&nbsp;
      <input className="input" style={{width:140}} inputMode="numeric" value={cardioGoal} onChange={(e)=>setCardioGoal(e.target.value)} />
    </label>
    <div className="pill teal">Default: 240 min (4 hours)</div>
    <button className="smallBtn primary" onClick={save}>Save</button>
  </div>
</div>

</div>

      <div style={{height:12}} />

      <div className="card">
        <div className="h2" style={{marginTop:0}}>Exports</div>
        <div className="row">
          <button className="smallBtn" onClick={exportWorkoutsCSV}>Export workouts CSV</button>
          <button className="smallBtn" onClick={exportMealsCSV}>Export meals CSV</button>
          <button className="smallBtn" onClick={exportLatestSummary}>Export latest workout summary</button>
        </div>
        <div className="muted" style={{marginTop:10}}>
          Everything stays on-device. Exports let you back up or share.
        </div>
      </div>
    </div>
  );
}
