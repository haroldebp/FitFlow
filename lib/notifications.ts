import * as Notifications from 'expo-notifications';
import type { PlanEntry, Recipe } from './types';
import { SLOT_LABEL } from './types';
import { addDays, dateKey, keyToDate, round, timeToDate } from './utils';

// Show reminders as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

const DAYS_AHEAD = 14; // iOS allows 64 pending reminders; 14 days x 4 meals stays under it.

/**
 * Cancels every meal reminder and schedules fresh ones for each planned meal
 * in the next two weeks. Called whenever the meal plan or settings change.
 */
export async function rescheduleMealReminders(
  plans: Record<string, PlanEntry[]>,
  recipes: Record<string, Recipe>,
  enabled: boolean,
) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  if (!(await ensurePermission())) return;

  const now = new Date();
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const key = dateKey(addDays(now, i));
    const entries = plans[key] ?? [];
    for (const e of entries) {
      if (e.eaten) continue;
      const recipe = recipes[e.recipeId];
      if (!recipe) continue;
      const when = timeToDate(keyToDate(key), e.time);
      if (when <= now) continue;

      const kcal = round(recipe.macros.calories * e.portions);
      const protein = round(recipe.macros.protein * e.portions);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${SLOT_LABEL[e.slot].toLowerCase()} 🍽️`,
          body: `${recipe.name} · ${kcal} kcal · ${protein}g protein`,
          data: { date: key, entryId: e.id, recipeId: recipe.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  }
}
