export type Macros = {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  fiber?: number;
  sugar?: number;
};

export type Ingredient = {
  id: string;
  name: string;
  amount: string; // e.g. "500 g", "1 can (400 g)"
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  image?: string; // data URI or https URL
  imageSource?: 'video' | 'stock' | 'none';
  sourceUrl?: string;
  sourcePlatform?: 'tiktok' | 'instagram' | 'youtube' | 'other' | 'manual';
  extractedFrom?: 'caption' | 'audio' | 'caption+audio' | 'manual';
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  ingredients: Ingredient[];
  steps: string[];
  macros: Macros; // per serving
  folderIds: string[];
  favorite: boolean;
  createdAt: number;
};

export type Folder = { id: string; name: string; builtIn?: boolean };

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type PlanEntry = {
  id: string;
  slot: MealSlot;
  recipeId: string;
  time: string; // "HH:MM", 24-hour
  portions: number; // how many servings you eat, usually 1
  eaten: boolean;
};

export type Settings = {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  serverUrl: string; // blank = work it out automatically from the Expo dev server
  notificationsEnabled: boolean;
  defaultTimes: Record<MealSlot, string>;
};

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};
