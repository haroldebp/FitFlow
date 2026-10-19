import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing } from '../../components/CalorieRing';
import { Card, RecipeImage, SectionTitle } from '../../components/ui';
import { colors, radius } from '../../lib/theme';
import { SLOTS, SLOT_LABEL, type MealSlot, type PlanEntry } from '../../lib/types';
import { dateKey, formatShortDate, formatTime, round, scaleMacros, sumEntries } from '../../lib/utils';
import { sortEntries, useStore } from '../../store/useStore';

export default function Home() {
  const today = dateKey();
  const entries = useStore((s) => s.plans[today]);
  const recipes = useStore((s) => s.recipes);
  const settings = useStore((s) => s.settings);
  const toggleEaten = useStore((s) => s.toggleEaten);

  const sorted = useMemo(() => sortEntries(entries), [entries]);
  const eaten = useMemo(() => sumEntries(sorted, recipes, true), [sorted, recipes]);
  const planned = useMemo(() => sumEntries(sorted, recipes), [sorted, recipes]);
  const nowHHMM = new Date().toTimeString().slice(0, 5);
  const next = sorted.find((e) => !e.eaten && e.time >= nowHHMM && recipes[e.recipeId]);

  // One row per main meal, plus any snacks.
  const rows: { slot: MealSlot; entry?: PlanEntry }[] = [];
  for (const slot of SLOTS) {
    const inSlot = sorted.filter((e) => e.slot === slot);
    if (inSlot.length === 0) {
      if (slot !== 'snacks') rows.push({ slot });
    } else inSlot.forEach((entry) => rows.push({ slot, entry }));
  }

  const remaining = settings.calorieGoal - eaten.calories;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>FitFlow</Text>
            <Text style={s.date}>Today, {formatShortDate(new Date())}</Text>
          </View>
          <Pressable onPress={() => router.push('/import')} style={s.addBtn} hitSlop={8}>
            <Ionicons name="add" size={24} color={colors.accentText} />
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <CalorieRing value={eaten.calories} goal={settings.calorieGoal} />
          <Text style={s.remaining}>
            {remaining >= 0
              ? `${round(remaining).toLocaleString()} kcal left today`
              : `${round(-remaining).toLocaleString()} kcal over goal`}
            {planned.calories > eaten.calories
              ? ` · ${round(planned.calories).toLocaleString()} planned`
              : ''}
          </Text>
        </View>

        <View style={s.macroRow}>
          <MacroProgress label="Protein" value={eaten.protein} goal={settings.proteinGoal} color={colors.protein} />
          <MacroProgress label="Carbs" value={eaten.carbs} goal={settings.carbsGoal} color={colors.carbs} />
          <MacroProgress label="Fats" value={eaten.fat} goal={settings.fatGoal} color={colors.fat} />
        </View>

        {next && (
          <Card style={[s.nextCard]}>
            <Ionicons name="alarm-outline" size={20} color={colors.accent} />
            <Text style={s.nextText}>
              Next: <Text style={{ fontWeight: '700' }}>{recipes[next.recipeId].name}</Text> at{' '}
              {formatTime(next.time)}
            </Text>
          </Card>
        )}

        <SectionTitle
          title="Today's Meals"
          right={
            <Pressable onPress={() => router.navigate('/plan')}>
              <Text style={{ color: colors.muted }}>See all</Text>
            </Pressable>
          }
        />

        {rows.map(({ slot, entry }) => {
          const recipe = entry ? recipes[entry.recipeId] : undefined;
          if (!entry || !recipe) {
            return (
              <Pressable
                key={slot}
                style={s.mealRow}
                onPress={() => router.push({ pathname: '/pick-recipe', params: { date: today, slot } })}
              >
                <RecipeImage style={s.thumb} iconSize={20} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.slot}>{SLOT_LABEL[slot]}</Text>
                  <Text style={s.empty}>Add meal</Text>
                </View>
                <Ionicons name="add-circle-outline" size={28} color={colors.muted} />
              </Pressable>
            );
          }
          const m = scaleMacros(recipe.macros, entry.portions);
          return (
            <Pressable key={entry.id} style={s.mealRow} onPress={() => router.push(`/recipe/${recipe.id}`)}>
              <RecipeImage uri={recipe.image} style={s.thumb} iconSize={20} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.slot}>
                  {SLOT_LABEL[slot]} · {formatTime(entry.time)}
                </Text>
                <Text style={s.name} numberOfLines={1}>
                  {recipe.name}
                </Text>
                <Text style={s.kcal}>{round(m.calories)} kcal</Text>
              </View>
              <Pressable onPress={() => toggleEaten(today, entry.id)} hitSlop={10}>
                <Ionicons
                  name={entry.eaten ? 'checkmark-circle' : 'ellipse-outline'}
                  size={30}
                  color={entry.eaten ? colors.accent : colors.faint}
                />
              </Pressable>
            </Pressable>
          );
        })}
        <Text style={s.hint}>Tick a meal once you've eaten it and it counts towards today's wheel.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroProgress({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.macroValue}>{round(value)}g</Text>
      <Text style={s.macroLabel}>
        {label} <Text style={{ color: colors.faint }}>/ {goal}g</Text>
      </Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.text, fontSize: 28, fontWeight: '800' },
  date: { color: colors.muted, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remaining: { color: colors.muted, marginTop: 12, fontSize: 13 },
  macroRow: { flexDirection: 'row', marginTop: 22 },
  macroValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  macroLabel: { color: colors.muted, fontSize: 13, marginTop: 2 },
  track: { height: 4, width: 64, borderRadius: 2, backgroundColor: colors.cardAlt, marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  nextCard: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingVertical: 12 },
  nextText: { color: colors.text, marginLeft: 10, flex: 1 },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  slot: { color: colors.muted, fontSize: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  kcal: { color: colors.muted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.text, fontSize: 15, marginTop: 2 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
