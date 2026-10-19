import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Folder, MealSlot, PlanEntry, Recipe, Settings } from '../lib/types';
import { uid } from '../lib/utils';

type State = {
  recipes: Record<string, Recipe>;
  folders: Folder[];
  plans: Record<string, PlanEntry[]>; // keyed by "YYYY-MM-DD"
  settings: Settings;

  // recipes
  saveRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleRecipeFolder: (recipeId: string, folderId: string) => void;

  // folders
  addFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  // meal plan
  setSlotRecipe: (date: string, slot: MealSlot, recipeId: string, entryId?: string) => void;
  updateEntry: (date: string, entryId: string, patch: Partial<PlanEntry>) => void;
  removeEntry: (date: string, entryId: string) => void;
  toggleEaten: (date: string, entryId: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
};

export const DEFAULT_FOLDERS: Folder[] = [
  { id: 'breakfast', name: 'Breakfast', builtIn: true },
  { id: 'lunch', name: 'Lunch', builtIn: true },
  { id: 'dinner', name: 'Dinner', builtIn: true },
  { id: 'snacks', name: 'Snacks', builtIn: true },
];

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  proteinGoal: 160,
  carbsGoal: 220,
  fatGoal: 70,
  serverUrl: '',
  notificationsEnabled: true,
  defaultTimes: { breakfast: '07:30', lunch: '12:30', dinner: '19:00', snacks: '15:30' },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      recipes: {},
      folders: DEFAULT_FOLDERS,
      plans: {},
      settings: DEFAULT_SETTINGS,

      saveRecipe: (r) => set((s) => ({ recipes: { ...s.recipes, [r.id]: r } })),

      deleteRecipe: (id) =>
        set((s) => {
          const recipes = { ...s.recipes };
          delete recipes[id];
          // Remove the recipe from any meal plans too.
          const plans: State['plans'] = {};
          for (const [k, entries] of Object.entries(s.plans)) {
            plans[k] = entries.filter((e) => e.recipeId !== id);
          }
          return { recipes, plans };
        }),

      toggleFavorite: (id) =>
        set((s) => {
          const r = s.recipes[id];
          if (!r) return s;
          return { recipes: { ...s.recipes, [id]: { ...r, favorite: !r.favorite } } };
        }),

      toggleRecipeFolder: (recipeId, folderId) =>
        set((s) => {
          const r = s.recipes[recipeId];
          if (!r) return s;
          const has = r.folderIds.includes(folderId);
          const folderIds = has
            ? r.folderIds.filter((f) => f !== folderId)
            : [...r.folderIds, folderId];
          return { recipes: { ...s.recipes, [recipeId]: { ...r, folderIds } } };
        }),

      addFolder: (name) => {
        const id = uid();
        set((s) => ({ folders: [...s.folders, { id, name: name.trim() }] }));
        return id;
      },

      renameFolder: (id, name) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
        })),

      deleteFolder: (id) =>
        set((s) => {
          const recipes: State['recipes'] = {};
          for (const r of Object.values(s.recipes)) {
            recipes[r.id] = { ...r, folderIds: r.folderIds.filter((f) => f !== id) };
          }
          return { folders: s.folders.filter((f) => f.id !== id), recipes };
        }),

      setSlotRecipe: (date, slot, recipeId, entryId) =>
        set((s) => {
          const entries = [...(s.plans[date] ?? [])];
          const time = s.settings.defaultTimes[slot];
          if (entryId) {
            const i = entries.findIndex((e) => e.id === entryId);
            if (i >= 0) entries[i] = { ...entries[i], recipeId, eaten: false };
          } else if (slot !== 'snacks' && entries.some((e) => e.slot === slot)) {
            // Breakfast, lunch and dinner hold one recipe each; picking again replaces it.
            const i = entries.findIndex((e) => e.slot === slot);
            entries[i] = { ...entries[i], recipeId, eaten: false };
          } else {
            entries.push({ id: uid(), slot, recipeId, time, portions: 1, eaten: false });
          }
          return { plans: { ...s.plans, [date]: entries } };
        }),

      updateEntry: (date, entryId, patch) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [date]: (s.plans[date] ?? []).map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
          },
        })),

      removeEntry: (date, entryId) =>
        set((s) => ({
          plans: { ...s.plans, [date]: (s.plans[date] ?? []).filter((e) => e.id !== entryId) },
        })),

      toggleEaten: (date, entryId) => {
        const e = get().plans[date]?.find((x) => x.id === entryId);
        if (e) get().updateEntry(date, entryId, { eaten: !e.eaten });
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'fitflow-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        recipes: s.recipes,
        folders: s.folders,
        plans: s.plans,
        settings: s.settings,
      }),
    },
  ),
);

/** Sorted entries for a day (by time). */
export const sortEntries = (entries: PlanEntry[] = []) =>
  [...entries].sort((a, b) => a.time.localeCompare(b.time));
