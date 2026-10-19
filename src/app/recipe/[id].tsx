import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, MacroStat, MetaItem, RecipeImage } from '../../components/ui';
import { colors, radius } from '../../lib/theme';
import { SLOTS, SLOT_LABEL } from '../../lib/types';
import { addDays, dateKey, formatShortDate, round } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export default function RecipeDetail() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const recipe = useStore((s) => s.recipes[id]);
  const folders = useStore((s) => s.folders);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleRecipeFolder = useStore((s) => s.toggleRecipeFolder);
  const setSlotRecipe = useStore((s) => s.setSlotRecipe);
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted }}>This recipe was deleted.</Text>
      </View>
    );
  }

  const addToPlan = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
    const dayLabels = days.map((d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatShortDate(d)));
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Which day?', options: [...dayLabels, 'Cancel'], cancelButtonIndex: 7 },
      (dayIndex) => {
        if (dayIndex === 7) return;
        const slotLabels = SLOTS.map((sl) => SLOT_LABEL[sl]);
        ActionSheetIOS.showActionSheetWithOptions(
          { title: 'Which meal?', options: [...slotLabels, 'Cancel'], cancelButtonIndex: 4 },
          (slotIndex) => {
            if (slotIndex === 4) return;
            setSlotRecipe(dateKey(days[dayIndex]), SLOTS[slotIndex], recipe.id);
            Alert.alert('Added', `${recipe.name} is on ${dayLabels[dayIndex].toLowerCase()}'s plan for ${slotLabels[slotIndex].toLowerCase()}.`);
          },
        );
      },
    );
  };

  const totalMins = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const m = recipe.macros;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={s.headerBtn} onPress={() => toggleFavorite(recipe.id)}>
                <Ionicons name={recipe.favorite ? 'heart' : 'heart-outline'} size={20} color={recipe.favorite ? colors.danger : '#fff'} />
              </Pressable>
              <Pressable style={s.headerBtn} onPress={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })}>
                <Ionicons name="create-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <RecipeImage uri={recipe.image} style={s.hero} iconSize={48} />

        <View style={s.body}>
          {fresh === '1' && (
            <View style={s.banner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              <Text style={s.bannerText}>
                Saved. Give it a quick check: macros are estimates, and you can fix anything with the edit button.
              </Text>
            </View>
          )}

          <Text style={s.name}>{recipe.name}</Text>
          {!!recipe.description && <Text style={s.desc}>{recipe.description}</Text>}

          <View style={s.metaRow}>
            <MetaItem icon="people-outline" value={String(recipe.servings)} label="Servings" />
            <MetaItem icon="time-outline" value={totalMins ? `${totalMins} mins` : '–'} label="Total time" />
            <MetaItem icon="speedometer-outline" value={recipe.difficulty ?? '–'} label="Difficulty" />
          </View>

          <View style={s.macroCard}>
            <MacroStat value={m.calories} label="Calories" unit="" color={colors.accent} />
            <MacroStat value={m.protein} label="Protein" color={colors.protein} />
            <MacroStat value={m.carbs} label="Carbs" color={colors.carbs} />
            <MacroStat value={m.fat} label="Fats" color={colors.fat} />
          </View>
          <Text style={s.perServing}>Per serving · approximate</Text>

          <Button title="Add to meal plan" icon="calendar-outline" onPress={addToPlan} style={{ marginTop: 16 }} />

          <Text style={s.label}>Folders</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {folders.map((f) => (
              <Chip
                key={f.id}
                label={recipe.folderIds.includes(f.id) ? `✓ ${f.name}` : f.name}
                active={recipe.folderIds.includes(f.id)}
                onPress={() => toggleRecipeFolder(recipe.id, f.id)}
              />
            ))}
          </ScrollView>

          <View style={s.tabs}>
            {(['ingredients', 'steps'] as const).map((t) => (
              <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && { color: colors.accentText }]}>
                  {t === 'ingredients' ? `Ingredients (${recipe.ingredients.length})` : `Instructions (${recipe.steps.length})`}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'ingredients'
            ? recipe.ingredients.map((i) => (
                <View key={i.id} style={s.ingRow}>
                  <View style={s.bullet} />
                  <Text style={s.ingName}>{i.name}</Text>
                  <Text style={s.ingAmount}>{i.amount}</Text>
                </View>
              ))
            : recipe.steps.map((step, n) => (
                <View key={n} style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 12 }}>{n + 1}</Text>
                  </View>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}

          {recipe.sourceUrl && (
            <Pressable style={s.source} onPress={() => Linking.openURL(recipe.sourceUrl!)}>
              <Ionicons
                name={recipe.sourcePlatform === 'instagram' ? 'logo-instagram' : recipe.sourcePlatform === 'youtube' ? 'logo-youtube' : 'logo-tiktok'}
                size={16}
                color={colors.muted}
              />
              <Text style={s.sourceText}>
                Watch the original video
                {recipe.extractedFrom ? ` · read from ${recipe.extractedFrom.replace('+', ' + ')}` : ''}
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { width: '100%', height: 320 },
  body: {
    marginTop: -24,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#1C2610',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  bannerText: { color: colors.text, flex: 1, lineHeight: 19, fontSize: 13 },
  name: { color: colors.text, fontSize: 26, fontWeight: '800' },
  desc: { color: colors.muted, marginTop: 8, lineHeight: 21 },
  metaRow: { flexDirection: 'row', marginTop: 18 },
  macroCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 16,
    marginTop: 18,
  },
  perServing: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 6 },
  label: { color: colors.muted, fontSize: 13, marginTop: 20, marginBottom: 8 },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: 4, marginTop: 22 },
  tab: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.text, fontWeight: '600' },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bullet: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent, marginRight: 12 },
  ingName: { color: colors.text, flex: 1, fontSize: 15 },
  ingAmount: { color: colors.muted, fontSize: 14, marginLeft: 12, maxWidth: '45%', textAlign: 'right' },
  stepRow: { flexDirection: 'row', paddingVertical: 10 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepText: { color: colors.text, flex: 1, fontSize: 15, lineHeight: 22 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, justifyContent: 'center' },
  sourceText: { color: colors.muted, fontSize: 13 },
});
