import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../lib/theme';

type Props = {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
  label?: string; // text under the number
  compact?: boolean;
};

/** The lime progress wheel from the mockups. Turns orange once you go over goal. */
export function CalorieRing({ value, goal, size = 220, stroke = 16, label, compact }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = value > goal;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={over ? colors.fat : '#D7FF7A'} />
            <Stop offset="1" stopColor={over ? '#FF7A45' : colors.accent} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.value, compact && { fontSize: size * 0.2 }]}>
          {Math.round(value).toLocaleString()}
        </Text>
        <Text style={[styles.label, compact && { fontSize: 9 }]}>
          {label ?? `of ${goal.toLocaleString()} kcal`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.text, fontSize: 46, fontWeight: '800', letterSpacing: -1 },
  label: { color: colors.muted, fontSize: 14, marginTop: 2 },
});
