import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, RecipeImage } from '../components/ui';
import { colors, radius } from '../lib/theme';
import { SLOT_LABEL, type MealSlot } from '../lib/types';
import { round } from '../lib/utils';
import { useStore } from '../store/useStore';

export default function PickRecipe() {
  const { date, slot, entryId } = useLocalSearchParams<{ date: string; slot: MealSlot; entryId?: string }>();
  const recipes = useStore((s) => s.recipes);
  const folders = useStore((s) => s.folders);
  const setSlotRecipe = useStore((s) => s.setSlotRecipe);

  // Start on the matching folder (e.g. Breakfast) if it has anything in it.
  const all = Object.values(recipes);
  const slotHasRecipes = all.some((r) => r.folderIds.includes(slot));
  const [filter, setFilter] = useState<string>(slotHasRecipes ? slot : 'all');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => filter === 'all' || r.folderIds.includes(filter))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt);
  }, [recipes, filter, query]);

  const choose = (recipeId: string) => {
    setSlotRecipe(date, slot, recipeId, entryId);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={{ color: colors.muted, marginBottom: 10 }}>For {SLOT_LABEL[slot] ?? 'meal'}</Text>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes…"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            style={s.searchInput}
          />
        </View>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          {folders.map((f) => (
            <Chip key={f.id} label={f.name} active={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              {all.length === 0 ? 'You have no saved recipes yet.' : 'No recipes in this folder.'}
            </Text>
            <Button title="Import a recipe" icon="add" onPress={() => router.replace('/import')} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={s.row} onPress={() => choose(item.id)}>
            <RecipeImage uri={item.image} style={s.thumb} iconSize={20} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name} numberOfLines={1}>
                {item.favorite ? '♥ ' : ''}
                {item.name}
              </Text>
              <Text style={s.macros}>
                {round(item.macros.calories)} kcal · {round(item.macros.protein)}g P · {round(item.macros.carbs)}g C ·{' '}
                {round(item.macros.fat)}g F
              </Text>
            </View>
            <Ionicons name="add-circle" size={26} color={colors.accent} />
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.text, marginLeft: 8, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  macros: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
