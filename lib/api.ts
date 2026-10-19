import Constants from 'expo-constants';
import { storeImage } from '../store/useImages';
import type { Recipe } from './types';
import { detectPlatform, uid } from './utils';

/**
 * Works out where the recipe server lives. While developing, the phone is
 * already talking to your Mac for Expo, so we reuse that address on port 8000.
 */
export function resolveServerUrl(override: string) {
  if (override.trim()) return override.trim().replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:8000` : 'http://localhost:8000';
}

type ExtractResponse = {
  name: string;
  description: string;
  servings: number;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  category?: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | null;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  macros_per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
  };
  image?: string | null; // data URI
  image_source?: 'video' | 'stock' | 'none';
  extracted_from: 'caption' | 'audio' | 'caption+audio';
};

export async function extractRecipe(url: string, serverOverride: string): Promise<Recipe> {
  const base = resolveServerUrl(serverOverride);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

  let res: Response;
  try {
    res = await fetch(`${base}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new Error(
      e?.name === 'AbortError'
        ? 'That took too long. Try again, or try a shorter video.'
        : `Can't reach the recipe server at ${base}. Make sure it's running on your Mac and your phone is on the same Wi-Fi.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = `Server error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new Error(detail);
  }

  const d: ExtractResponse = await res.json();
  const m = d.macros_per_serving;
  return {
    id: uid(),
    name: d.name,
    description: d.description,
    image: storeImage(d.image),
    imageSource: d.image_source ?? 'none',
    sourceUrl: url,
    sourcePlatform: detectPlatform(url),
    extractedFrom: d.extracted_from,
    servings: d.servings || 1,
    prepMinutes: d.prep_minutes ?? undefined,
    cookMinutes: d.cook_minutes ?? undefined,
    difficulty: d.difficulty ?? undefined,
    ingredients: d.ingredients.map((i) => ({ id: uid(), name: i.name, amount: i.amount })),
    steps: d.steps,
    macros: {
      calories: m.calories,
      protein: m.protein_g,
      carbs: m.carbs_g,
      fat: m.fat_g,
      fiber: m.fiber_g ?? undefined,
      sugar: m.sugar_g ?? undefined,
    },
    folderIds: d.category ? [d.category] : [],
    favorite: false,
    createdAt: Date.now(),
  };
}

export async function checkServer(serverOverride: string) {
  const base = resolveServerUrl(serverOverride);
  try {
    const res = await fetch(`${base}/health`);
    return { ok: res.ok, base };
  } catch {
    return { ok: false, base };
  }
}
