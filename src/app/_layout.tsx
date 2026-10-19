import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { rescheduleMealReminders } from '../lib/notifications';
import { colors } from '../lib/theme';
import { useStore } from '../store/useStore';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  // Keep meal reminders in sync with the plan (debounced so typing doesn't thrash).
  useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const s = useStore.getState();
      rescheduleMealReminders(s.plans, s.recipes, s.settings.notificationsEnabled).catch(() => {});
    };
    run();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.plans === prev.plans && s.recipes === prev.recipes && s.settings === prev.settings) return;
      clearTimeout(timer);
      timer = setTimeout(run, 800);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [hydrated]);

  // Tapping a meal reminder opens that recipe.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const recipeId = response.notification.request.content.data?.recipeId;
      if (typeof recipeId === 'string') router.push(`/recipe/${recipeId}`);
    });
    return () => sub.remove();
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ title: 'Add Recipe', presentation: 'modal' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="recipe/edit" options={{ title: 'Edit Recipe' }} />
        <Stack.Screen name="pick-recipe" options={{ title: 'Choose a Recipe', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
