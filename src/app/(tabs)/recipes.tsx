import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, RecipeImage } from '../../components/ui';
import { colors, radius } from '../../lib/theme';
import type { Folder } from '../../lib/types';
import { round } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export default function Recipes() {
  const recipes = useStore((s) => s.recipes);
  const folders = useStore((s) => s.folders);
  const addFolder = useStore((s) => s.addFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'fav' | folderId

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(recipes)
      .filter((r) => (filter === 'all' ? true : filter === 'fav' ? r.favorite : r.folderIds.includes(filter)))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [recipes, filter, query]);

  const newFolder = () =>
    Alert.prompt('New folder', 'e.g. Meal prep, High protein, Desserts', (name) => {
      if (name?.trim()) setFilter(addFolder(name));
    });

  const editFolder = (f: Folder) => {
    if (f.builtIn) return;
    Alert.alert(f.name, undefined, [
      {
        text: 'Rename',
        onPress: () =>
          Alert.prompt('Rename folder', undefined, (name) => name?.trim() && renameFolder(f.id, name), 'plain-text', f.name),
      },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () => {
          deleteFolder(f.id);
          setFilter('all');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={s.header}>
          <Text style={s.title}>Recipes</Text>
          <Pressable onPress={() => router.push('/import')} style={s.addBtn} hitSlop={8}>
            <Ionicons name="add" size={24} color={colors.accentText} />
          </Pressable>
        </View>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes or ingredients…"
            placeholderTextColor={colors.faint}
            keyboardAppearance="dark"
            style={s.searchInput}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="♥ Favourites" active={filter === 'fav'} onPress={() => setFilter('fav')} />
          {folders.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              active={filter === f.id}
              onPress={() => setFilter(f.id)}
              onLongPress={() => editFolder(f)}
            />
          ))}
          <Chip label="+ Folder" onPress={newFolder} />
        </ScrollView>
      </View>

      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="logo-tiktok" size={34} color={colors.faint} />
            <Text style={s.emptyTitle}>
              {Object.keys(recipes).length === 0 ? 'No recipes yet' : 'Nothing here'}
            </Text>
            <Text style={s.emptyText}>
              {Object.keys(recipes).length === 0
                ? 'Copy a TikTok or Instagram reel link, then tap + to import it.'
                : 'Try another folder or search. Open a recipe to add it to folders.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => router.push(`/recipe/${item.id}`)}>
            <RecipeImage uri={item.image} style={s.image} />
            <View style={s.cardBody}>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={s.kcal}>
                  {round(item.macros.calories)} kcal · {round(item.macros.protein)}g P
                </Text>
              </View>
              <Pressable onPress={() => toggleFavorite(item.id)} hitSlop={10}>
                <Ionicons
                  name={item.favorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={item.favorite ? colors.danger : colors.muted}
                />
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.text, marginLeft: 8, fontSize: 15 },
  chips: { paddingHorizontal: 20, paddingVertical: 14 },
  card: { flex: 1, maxWidth: '48.5%', backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.15 },
  cardBody: { flexDirection: 'row', padding: 10, alignItems: 'flex-start' },
  name: { color: colors.text, fontWeight: '600', fontSize: 14 },
  kcal: { color: colors.muted, fontSize: 12, marginTop: 4 },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
