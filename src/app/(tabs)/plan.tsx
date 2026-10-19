import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing } from '../../components/CalorieRing';
import { TimePickerModal } from '../../components/TimePickerModal';
import { Card, MacroStat, RecipeImage } from '../../components/ui';
import { colors, radius } from '../../lib/theme';
import { SLOTS, SLOT_LABEL, type MealSlot, type PlanEntry } from '../../lib/types';
import {
  addDays,
  DAY_SHORT,
  dateKey,
  formatLongDate,
  formatTime,
  round,
  scaleMacros,
  sumEntries,
  weekOf,
} from '../../lib/utils';
import { sortEntries, useStore } from '../../store/useStore';

export default function Plan() {
  const [selected, setSelected] = useState(new Date());
  const [editingTime, setEditingTime] = useState<PlanEntry | null>(null);

  const key = dateKey(selected);
  const todayKey = dateKey();
  const entries = useStore((s) => s.plans[key]);
  const plans = useStore((s) => s.plans);
  const recipes = useStore((s) => s.recipes);
  const goal = useStore((s) => s.settings.calorieGoal);
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const toggleEaten = useStore((s) => s.toggleEaten);

  const week = weekOf(selected);
  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const totals = useMemo(() => sumEntries(sorted, recipes), [sorted, recipes]);

  const pick = (slot: MealSlot, entryId?: string) =>
    router.push({ pathname: '/pick-recipe', params: { date: key, slot, ...(entryId ? { entryId } : {}) } });

  const entryMenu = (e: PlanEntry) => {
    const options = ['Change recipe', 'Change time', 'Portions: 0.5', 'Portions: 1', 'Portions: 1.5', 'Portions: 2', 'Remove', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, destructiveButtonIndex: 6, cancelButtonIndex: 7, title: `Portions now: ${e.portions}` },
      (i) => {
        if (i === 0) pick(e.slot, e.id);
        if (i === 1) setEditingTime(e);
        if (i >= 2 && i <= 5) updateEntry(key, e.id, { portions: [0.5, 1, 1.5, 2][i - 2] });
        if (i === 6) removeEntry(key, e.id);
      },
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={s.title}>Meal Plan</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable style={s.navBtn} onPress={() => setSelected(addDays(selected, -7))}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable style={s.navBtn} onPress={() => setSelected(new Date())}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Today</Text>
            </Pressable>
            <Pressable style={s.navBtn} onPress={() => setSelected(addDays(selected, 7))}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={s.week}>
          {week.map((d, i) => {
            const k = dateKey(d);
            const active = k === key;
            const hasMeals = (plans[k]?.length ?? 0) > 0;
            return (
              <Pressable key={k} style={s.day} onPress={() => setSelected(d)}>
                <Text style={[s.dayName, k === todayKey && { color: colors.accent }]}>{DAY_SHORT[i]}</Text>
                <View style={[s.dayNum, active && { backgroundColor: colors.accent }]}>
                  <Text style={[s.dayNumText, active && { color: colors.accentText }]}>{d.getDate()}</Text>
                </View>
                <View style={[s.dot, hasMeals && { backgroundColor: active ? colors.text : colors.accent }]} />
              </Pressable>
            );
          })}
        </View>

        <Text style={s.dateTitle}>{formatLongDate(selected)}</Text>

        {SLOTS.map((slot) => {
          const inSlot = sorted.filter((e) => e.slot === slot);
          return (
            <View key={slot}>
              {inSlot.map((e) => {
                const r = recipes[e.recipeId];
                if (!r) return null;
                const m = scaleMacros(r.macros, e.portions);
                return (
                  <Pressable key={e.id} style={s.row} onPress={() => router.push(`/recipe/${r.id}`)} onLongPress={() => entryMenu(e)}>
                    <RecipeImage uri={r.image} style={s.thumb} iconSize={20} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.slot}>
                        {SLOT_LABEL[slot]}
                        {e.portions !== 1 ? ` · ${e.portions}× portion` : ''}
                      </Text>
                      <Text style={s.name} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={s.macros}>
                        {round(m.calories)} kcal · {round(m.protein)}g P · {round(m.carbs)}g C · {round(m.fat)}g F
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Pressable style={s.timePill} onPress={() => setEditingTime(e)} hitSlop={6}>
                        <Ionicons name="notifications-outline" size={12} color={colors.accent} />
                        <Text style={s.timeText}>{formatTime(e.time)}</Text>
                      </Pressable>
                      <View style={{ flexDirection: 'row', gap: 14 }}>
                        <Pressable onPress={() => toggleEaten(key, e.id)} hitSlop={8}>
                          <Ionicons
                            name={e.eaten ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={e.eaten ? colors.accent : colors.faint}
                          />
                        </Pressable>
                        <Pressable onPress={() => entryMenu(e)} hitSlop={8}>
                          <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {(inSlot.length === 0 || slot === 'snacks') && (
                <Pressable style={[s.row, s.emptyRow]} onPress={() => pick(slot)}>
                  <View style={s.plus}>
                    <Ionicons name="add" size={22} color={colors.text} />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={s.slot}>{SLOT_LABEL[slot]}</Text>
                    <Text style={s.name}>
                      {slot === 'snacks' ? (inSlot.length ? 'Add another snack' : 'Add a snack') : `Add ${slot}`}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          );
        })}

        <Card style={{ marginTop: 8 }}>
          <Text style={s.totalsTitle}>Daily Totals</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <CalorieRing value={totals.calories} goal={goal} size={92} stroke={9} compact />
            <View style={{ flex: 1, flexDirection: 'row', marginLeft: 12 }}>
              <MacroStat value={totals.protein} label="Protein" color={colors.protein} size="sm" />
              <MacroStat value={totals.carbs} label="Carbs" color={colors.carbs} size="sm" />
              <MacroStat value={totals.fat} label="Fats" color={colors.fat} size="sm" />
            </View>
          </View>
        </Card>
        <Text style={s.hint}>Tap a time to change it. You'll get a reminder when each meal is due.</Text>
      </ScrollView>

      <TimePickerModal
        visible={!!editingTime}
        value={editingTime?.time ?? '12:00'}
        title={editingTime ? `${SLOT_LABEL[editingTime.slot]} time` : undefined}
        onClose={() => setEditingTime(null)}
        onSave={(t) => editingTime && updateEntry(key, editingTime.id, { time: t })}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  navBtn: {
    height: 32,
    minWidth: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  day: { alignItems: 'center', flex: 1 },
  dayName: { color: colors.muted, fontSize: 12 },
  dayNum: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  dayNumText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4, backgroundColor: 'transparent' },
  dateTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
  },
  emptyRow: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'transparent' },
  plus: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  slot: { color: colors.muted, fontSize: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  macros: { color: colors.muted, fontSize: 11, marginTop: 3 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  timeText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  totalsTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
