import type { FoodCacheEntry } from './db';
import { getFoodCache, putFoodCache } from './db';

type SearchHit = {
  fdcId: number;
  description: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientId: number; nutrientName?: string; unitName?: string; value: number }[];
};

function round1(n:number){ return Math.round(n*10)/10; }

function pickNutrient(hit: SearchHit, ids: number[], names: string[]): number | undefined {
  const ns = hit.foodNutrients ?? [];
  for (const id of ids) {
    const f = ns.find(n=>n.nutrientId===id && typeof n.value==='number');
    if (f) return f.value;
  }
  // fallback by name
  for (const name of names) {
    const f = ns.find(n=> (n.nutrientName ?? '').toLowerCase() === name.toLowerCase() && typeof n.value==='number');
    if (f) return f.value;
  }
  return undefined;
}

export async function usdaSearch(query: string, apiKey: string): Promise<SearchHit[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`);
  const json = await res.json();
  return (json.foods ?? []) as SearchHit[];
}

export async function usdaHitToEntry(hit: SearchHit): Promise<FoodCacheEntry> {
  const name = hit.brandName ? `${hit.description} (${hit.brandName})` : hit.description;
  const unit = hit.servingSize && hit.servingSizeUnit
    ? `${hit.servingSize} ${hit.servingSizeUnit}`
    : (hit.servingSizeUnit ?? 'serving');

  // USDA Nutrient IDs (common):
  // Calories 1008 (kcal), Protein 1003 (g), Carbs 1005 (g), Fat 1004 (g), Iron 1089 (mg)
  const calories = pickNutrient(hit, [1008], ['Energy']);
  const protein = pickNutrient(hit, [1003], ['Protein']);
  const carbs = pickNutrient(hit, [1005], ['Carbohydrate, by difference']);
  const fat = pickNutrient(hit, [1004], ['Total lipid (fat)']);
  const iron = pickNutrient(hit, [1089], ['Iron, Fe']);

  return {
    id: `usda:${hit.fdcId}`,
    name,
    unit,
    calories: round1(calories ?? 0),
    protein_g: round1(protein ?? 0),
    carbs_g: round1(carbs ?? 0),
    fat_g: round1(fat ?? 0),
    iron_mg: iron != null ? round1(iron) : undefined,
    savedAt: Date.now()
  };
}

export async function getOrFetchEntryFromHit(hit: SearchHit): Promise<FoodCacheEntry> {
  const cacheId = `usda:${hit.fdcId}`;
  const cached = await getFoodCache(cacheId);
  if (cached) return cached;
  const entry = await usdaHitToEntry(hit);
  await putFoodCache(entry);
  return entry;
}
