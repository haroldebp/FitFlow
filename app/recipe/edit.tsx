import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Chip, Input, RecipeImage } from '../../components/ui';
import { colors, radius } from '../../lib/theme';
import type { Ingredient, Recipe } from '../../lib/types';
import { uid } from '../../lib/utils';
import { storeImage, useImages } from '../../store/useImages';
import { useStore } from '../../store/useStore';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.recipes[id] : undefined));
  const folders = useStore((s) => s.folders);
  const saveRecipe = useStore((s) => s.saveRecipe);
  const deleteRecipe = useStore((s) => s.deleteRecipe);

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [image, setImage] = useState(existing?.image);
  const [servings, setServings] = useState(String(existing?.servings ?? 1));
  const [prep, setPrep] = useState(existing?.prepMinutes ? String(existing.prepMinutes) : '');
  const [cook, setCook] = useState(existing?.cookMinutes ? String(existing.cookMinutes) : '');
  const [difficulty, setDifficulty] = useState<Recipe['difficulty']>(existing?.difficulty);
  const [cal, setCal] = useState(existing ? String(Math.round(existing.macros.calories)) : '');
  const [protein, setProtein] = useState(existing ? String(Math.round(existing.macros.protein)) : '');
  const [carbs, setCarbs] = useState(existing ? String(Math.round(existing.macros.carbs)) : '');
  const [fat, setFat] = useState(existing ? String(Math.round(existing.macros.fat)) : '');
  const [folderIds, setFolderIds] = useState<string[]>(existing?.folderIds ?? []);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    existing?.ingredients ?? [{ id: uid(), name: '', amount: '' }],
  );
  const [steps, setSteps] = useState<string[]>(existing?.steps ?? ['']);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.35,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Give the recipe a name first.');
      return;
    }
    // Only move a newly picked photo into the image store when saving.
    let imageRef = image;
    if (image !== existing?.image) {
      useImages.getState().remove(existing?.image);
      imageRef = storeImage(image);
    }
    const recipe: Recipe = {
      ...(existing ?? {
        id: uid(),
        favorite: false,
        createdAt: Date.now(),
        sourcePlatform: 'manual',
        extractedFrom: 'manual',
      }),
      name: name.trim(),
      description: description.trim(),
      image: imageRef,
      imageSource: imageRef ? existing?.imageSource ?? 'none' : 'none',
      servings: Math.max(1, num(servings)),
      prepMinutes: num(prep) || undefined,
      cookMinutes: num(cook) || undefined,
      difficulty,
      macros: { calories: num(cal), protein: num(protein), carbs: num(carbs), fat: num(fat) },
      folderIds,
      ingredients: ingredients.filter((i) => i.name.trim()),
      steps: steps.map((s) => s.trim()).filter(Boolean),
    };
    saveRecipe(recipe);
    if (existing) router.back();
    else router.replace(`/recipe/${recipe.id}`);
  };

  const remove = () =>
    Alert.alert('Delete recipe?', 'It will also be removed from your meal plans.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!existing) return;
          useImages.getState().remove(existing.image);
          deleteRecipe(existing.id);
          router.dismissAll();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Recipe' : 'New Recipe',
          headerRight: () => (
            <Pressable onPress={save} style={s.saveBtn}>
              <Text style={{ color: colors.accentText, fontWeight: '700' }}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Pressable style={s.photoRow} onPress={pickPhoto}>
          <RecipeImage uri={image} style={s.photo} />
          <View style={s.changePhoto}>
            <Ionicons name="camera-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, marginLeft: 6 }}>{image ? 'Change photo' : 'Add photo'}</Text>
          </View>
        </Pressable>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Chicken Burrito Bowl" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />

        <View style={s.grid}>
          <View style={{ flex: 1 }}>
            <Input label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Prep (min)" value={prep} onChangeText={setPrep} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Cook (min)" value={cook} onChangeText={setCook} keyboardType="number-pad" />
          </View>
        </View>

        <Text style={s.label}>Difficulty</Text>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
            <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? undefined : d)} />
          ))}
        </View>

        <Text style={s.label}>Macros per serving</Text>
        <View style={s.grid}>
          {[
            ['Calories', cal, setCal],
            ['Protein (g)', protein, setProtein],
            ['Carbs (g)', carbs, setCarbs],
            ['Fats (g)', fat, setFat],
          ].map(([label, value, setter]) => (
            <View key={label as string} style={{ flex: 1 }}>
              <Input
                label={label as string}
                value={value as string}
                onChangeText={setter as (t: string) => void}
                keyboardType="decimal-pad"
                style={{ paddingHorizontal: 10 }}
              />
            </View>
          ))}
        </View>

        <Text style={s.label}>Folders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {folders.map((f) => {
            const on = folderIds.includes(f.id);
            return (
              <Chip
                key={f.id}
                label={f.name}
                active={on}
                onPress={() => setFolderIds(on ? folderIds.filter((x) => x !== f.id) : [...folderIds, f.id])}
              />
            );
          })}
        </ScrollView>

        <Text style={s.heading}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={ing.id} style={s.ingRow}>
            <TextInput
              value={ing.name}
              placeholder="Chicken breast"
              placeholderTextColor={colors.faint}
              keyboardAppearance="dark"
              onChangeText={(t) => setIngredients(ingredients.map((x, j) => (j === i ? { ...x, name: t } : x)))}
              style={[s.cell, { flex: 1.6 }]}
            />
            <TextInput
              value={ing.amount}
              placeholder="500 g"
              placeholderTextColor={colors.faint}
              keyboardAppearance="dark"
              onChangeText={(t) => setIngredients(ingredients.map((x, j) => (j === i ? { ...x, amount: t } : x)))}
              style={[s.cell, { flex: 1 }]}
            />
            <Pressable onPress={() => setIngredients(ingredients.filter((_, j) => j !== i))} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        <Pressable style={s.addRow} onPress={() => setIngredients([...ingredients, { id: uid(), name: '', amount: '' }])}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '600', marginLeft: 4 }}>Add ingredient</Text>
        </Pressable>

        <Text style={s.heading}>Instructions</Text>
        {steps.map((step, i) => (
          <View key={i} style={s.ingRow}>
            <Text style={{ color: colors.muted, width: 20 }}>{i + 1}.</Text>
            <TextInput
              value={step}
              multiline
              placeholder="Describe this step"
              placeholderTextColor={colors.faint}
              keyboardAppearance="dark"
              onChangeText={(t) => setSteps(steps.map((x, j) => (j === i ? t : x)))}
              style={[s.cell, { flex: 1, minHeight: 44 }]}
            />
            <Pressable onPress={() => setSteps(steps.filter((_, j) => j !== i))} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        <Pressable style={s.addRow} onPress={() => setSteps([...steps, ''])}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '600', marginLeft: 4 }}>Add step</Text>
        </Pressable>

        <Button title="Save recipe" onPress={save} style={{ marginTop: 24 }} />
        {existing && <Button title="Delete recipe" variant="danger" onPress={remove} style={{ marginTop: 12 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  saveBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  photo: { width: 110, height: 82, borderRadius: radius.md },
  changePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  grid: { flexDirection: 'row', gap: 8 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cell: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
});
