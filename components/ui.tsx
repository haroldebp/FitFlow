import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius } from '../lib/theme';
import { useImageUri } from '../store/useImages';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? '#2A1416' : colors.cardAlt;
  const fg =
    variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  onLongPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[styles.chipText, active && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function MacroStat({
  value,
  label,
  color,
  unit = 'g',
  size = 'md',
}: {
  value: number;
  label: string;
  color: string;
  unit?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.macroValue, size === 'sm' && { fontSize: 15 }]}>
        {Math.round(value)}
        {unit}
      </Text>
      <Text style={[styles.macroLabel, size === 'sm' && { fontSize: 11 }]}>{label}</Text>
      <View style={[styles.macroBar, { backgroundColor: color }]} />
    </View>
  );
}

/** Recipe photo with a friendly placeholder when there isn't one. */
export function RecipeImage({
  uri,
  style,
  iconSize = 28,
}: {
  uri?: string;
  style: any;
  iconSize?: number;
}) {
  const resolved = useImageUri(uri);
  if (resolved) return <Image source={{ uri: resolved }} style={style} resizeMode="cover" />;
  return (
    <View style={[style, { backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="restaurant-outline" size={iconSize} color={colors.faint} />
    </View>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.faint}
        keyboardAppearance="dark"
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10, marginTop: 22 }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function MetaItem({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.row}>
        <Ionicons name={icon} size={14} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 6 }}>{value}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3, marginLeft: 20 }}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    marginRight: 8,
  },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  macroValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  macroLabel: { color: colors.muted, fontSize: 13, marginTop: 2 },
  macroBar: { height: 4, width: 44, borderRadius: 2, marginTop: 8 },
  inputLabel: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
