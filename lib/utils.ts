import type { Macros, PlanEntry, Recipe } from './types';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Local date as "YYYY-MM-DD" (avoids UTC shifting the day). */
export const dateKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

/** Monday-start week containing the date. */
export const weekOf = (d: Date) => {
  const day = (d.getDay() + 6) % 7; // Mon = 0
  const monday = addDays(d, -day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const formatLongDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

export const formatShortDate = (d: Date) =>
  d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** "19:00" -> "7:00 PM" */
export const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const timeToDate = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

export const dateToTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export const scaleMacros = (m: Macros, k: number): Macros => ({
  calories: m.calories * k,
  protein: m.protein * k,
  carbs: m.carbs * k,
  fat: m.fat * k,
});

export const addMacros = (a: Macros, b: Macros): Macros => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

export const sumEntries = (
  entries: PlanEntry[],
  recipes: Record<string, Recipe>,
  onlyEaten = false,
): Macros =>
  entries.reduce((acc, e) => {
    const r = recipes[e.recipeId];
    if (!r || (onlyEaten && !e.eaten)) return acc;
    return addMacros(acc, scaleMacros(r.macros, e.portions));
  }, ZERO);

export const round = (n: number) => Math.round(n);

export const detectPlatform = (url: string): Recipe['sourcePlatform'] => {
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  return 'other';
};

/** Pulls the first TikTok / Instagram / YouTube link out of any pasted text. */
export const findVideoLink = (text: string | null | undefined) => {
  if (!text) return null;
  const match = text.match(
    /https?:\/\/[^\s]*(tiktok\.com|instagram\.com|youtube\.com\/shorts|youtu\.be)[^\s]*/i,
  );
  return match ? match[0] : null;
};
