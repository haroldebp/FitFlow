import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? on : off} size={24} color={color} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes', tabBarIcon: icon('book', 'book-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }}
      />
    </Tabs>
  );
}
