import menus from '../data/menus.json';
import type { DayFoodLog, FoodItem, ISODate, RecentFood } from './db';
import { getMealLog, saveMealLog, upsertRecentFood } from './db';

export type MenuTemplate = (typeof menus.days)[number];
export type CatalogItem = (typeof menus.catalog)[number];

export function listTemplates(): MenuTemplate[] { return (menus as any).days; }
export function getTemplate(id: string): MenuTemplate|undefined { return (menus as any).days.find((d:any)=>d.id===id); }
export function listCatalog(): CatalogItem[] { return (menus as any).catalog; }

function uid(): string { return 'f_' + Math.random().toString(36).slice(2,10) + '_' + Date.now(); }

export function templateToLog(isoDate: ISODate, templateId: string): DayFoodLog {
  const tpl:any = getTemplate(templateId);
  if (!tpl) throw new Error('Unknown template');
  const items: FoodItem[] = tpl.items.map((x:any)=>({
    id: uid(),
    name: x.name,
    meal: x.meal,
    qty: x.qty,
    unit: x.unit,
    calories: x.calories,
    protein_g: x.protein_g,
    carbs_g: x.carbs_g,
    fat_g: x.fat_g,
    iron_mg: x.iron_mg,
    eaten: true,
    source: 'catalog'
  }));
  return { isoDate, templateId, items, updatedAt: Date.now() };
}

export async function ensureLogForDate(isoDate: ISODate){
  return await getMealLog(isoDate);
}

export async function setTemplateForDate(isoDate: ISODate, templateId: string){
  const log = templateToLog(isoDate, templateId);
  await saveMealLog(log);
  return log;
}

export function totals(items: FoodItem[]){
  let c=0,p=0,cb=0,f=0,fe=0;
  for (const it of items){
    if (!it.eaten) continue;
    c += it.calories * it.qty;
    p += it.protein_g * it.qty;
    cb += it.carbs_g * it.qty;
    f += it.fat_g * it.qty;
    fe += (it.iron_mg ?? 0) * it.qty;
  }
  return {
    calories: Math.round(c),
    protein_g: Math.round(p),
    carbs_g: Math.round(cb),
    fat_g: Math.round(f),
    iron_mg: Math.round(fe*10)/10
  };
}

export function swapItem(item: FoodItem, replacement: any): FoodItem {
  return {
    ...item,
    name: replacement.name,
    unit: replacement.unit,
    calories: replacement.calories,
    protein_g: replacement.protein_g,
    carbs_g: replacement.carbs_g,
    fat_g: replacement.fat_g,
    iron_mg: replacement.iron_mg,
    source: (replacement.id && String(replacement.id).startsWith('usda:')) ? 'usda' : (item.source ?? 'catalog'),
    sourceRef: (replacement.id && String(replacement.id).startsWith('usda:')) ? String(replacement.id).replace('usda:','') : item.sourceRef
  };
}

export async function recordRecentFromItem(it: FoodItem){
  const stable = `${it.source ?? 'manual'}:${(it.sourceRef ?? it.name).toLowerCase()}`;
  const recent: Omit<RecentFood,'usedAt'> = {
    id: stable,
    name: it.name,
    unit: it.unit,
    calories: it.calories,
    protein_g: it.protein_g,
    carbs_g: it.carbs_g,
    fat_g: it.fat_g,
    iron_mg: it.iron_mg,
    source: it.source ?? 'manual',
    sourceRef: it.sourceRef
  };
  await upsertRecentFood(recent);
}
