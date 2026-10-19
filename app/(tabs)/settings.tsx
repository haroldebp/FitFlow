import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePickerModal } from '../../components/TimePickerModal';
import { Button } from '../../components/ui';
import { checkServer, resolveServerUrl } from '../../lib/api';
import { ensurePermission } from '../../lib/notifications';
import { colors, radius } from '../../lib/theme';
import { SLOTS, SLOT_LABEL, type MealSlot, type Settings } from '../../lib/types';
import { formatTime } from '../../lib/utils';
import { useStore } from '../../store/useStore';

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [checking, setChecking] = useState(false);

  const testServer = async () => {
    setChecking(true);
    const { ok, base } = await checkServer(settings.serverUrl);
    setChecking(false);
    Alert.alert(
      ok ? 'Connected ✅' : "Can't reach the server",
      ok
        ? `Recipe server is running at ${base}.`
        : `Tried ${base}.\n\nCheck the server is running on your Mac (see the setup guide) and your phone is on the same Wi-Fi.`,
    );
  };

  const testReminder = async () => {
    if (!(await ensurePermission())) {
      Alert.alert('Notifications are off', 'Turn them on in the iPhone Settings app → Notifications.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Time for lunch 🍽️', body: 'This is what your meal reminders look like.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    Alert.alert('Test sent', 'Lock your phone, a reminder arrives in 5 seconds.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Settings</Text>

        <Text style={s.section}>Daily goals</Text>
        <View style={s.group}>
          <NumberRow label="Calories" unit="kcal" field="calorieGoal" settings={settings} update={update} />
          <NumberRow label="Protein" unit="g" field="proteinGoal" settings={settings} update={update} />
          <NumberRow label="Carbs" unit="g" field="carbsGoal" settings={settings} update={update} />
          <NumberRow label="Fats" unit="g" field="fatGoal" settings={settings} update={update} last />
        </View>

        <Text style={s.section}>Meal reminders</Text>
        <View style={s.group}>
          <View style={s.row}>
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            <Text style={s.rowLabel}>Remind me when a meal is due</Text>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => update({ notificationsEnabled: v })}
              trackColor={{ true: colors.accent, false: colors.cardAlt }}
            />
          </View>
          {SLOTS.map((slot, i) => (
            <Pressable key={slot} style={[s.row, i === SLOTS.length - 1 && { borderBottomWidth: 0 }]} onPress={() => setEditingSlot(slot)}>
              <Text style={[s.rowLabel, { marginLeft: 0 }]}>Default {SLOT_LABEL[slot].toLowerCase()} time</Text>
              <Text style={s.value}>{formatTime(settings.defaultTimes[slot])}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>New meals you add to the plan start at these times. You can change any meal's time on the Plan tab.</Text>
        <Button title="Send a test reminder" variant="secondary" icon="alarm-outline" onPress={testReminder} style={{ marginTop: 10 }} />

        <Text style={s.section}>Recipe server</Text>
        <View style={[s.group, { padding: 14 }]}>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
            Leave blank to find it automatically. Currently: {resolveServerUrl(settings.serverUrl)}
          </Text>
          <TextInput
            defaultValue={settings.serverUrl}
            onEndEditing={(e) => update({ serverUrl: e.nativeEvent.text.trim() })}
            placeholder="http://192.168.1.20:8000"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            keyboardAppearance="dark"
            style={s.input}
          />
        </View>
        <Button title="Test connection" variant="secondary" icon="wifi-outline" loading={checking} onPress={testServer} style={{ marginTop: 10 }} />

        <Text style={s.section}>Data</Text>
        <Button
          title="Delete all meal plans"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete all meal plans?', 'Your saved recipes are kept.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => useStore.setState({ plans: {} }) },
            ])
          }
        />
      </ScrollView>

      <TimePickerModal
        visible={!!editingSlot}
        value={editingSlot ? settings.defaultTimes[editingSlot] : '12:00'}
        title={editingSlot ? `Default ${SLOT_LABEL[editingSlot].toLowerCase()} time` : undefined}
        onClose={() => setEditingSlot(null)}
        onSave={(t) => editingSlot && update({ defaultTimes: { ...settings.defaultTimes, [editingSlot]: t } })}
      />
    </SafeAreaView>
  );
}

function NumberRow({
  label,
  unit,
  field,
  settings,
  update,
  last,
}: {
  label: string;
  unit: string;
  field: 'calorieGoal' | 'proteinGoal' | 'carbsGoal' | 'fatGoal';
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={[s.rowLabel, { marginLeft: 0 }]}>{label}</Text>
      <TextInput
        defaultValue={String(settings[field])}
        keyboardType="number-pad"
        keyboardAppearance="dark"
        returnKeyType="done"
        onEndEditing={(e) => {
          const n = parseInt(e.nativeEvent.text, 10);
          if (Number.isFinite(n) && n > 0) update({ [field]: n });
        }}
        style={s.numInput}
      />
      <Text style={[s.value, { width: 34 }]}>{unit}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  section: { color: colors.muted, fontSize: 13, marginTop: 26, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.text, fontSize: 15, flex: 1, marginLeft: 10 },
  value: { color: colors.muted, fontSize: 15, marginRight: 6 },
  numInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 70,
    paddingVertical: 8,
    marginRight: 6,
  },
  note: { color: colors.faint, fontSize: 12, marginTop: 8, lineHeight: 17 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    height: 44,
  },
});
