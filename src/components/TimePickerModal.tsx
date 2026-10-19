import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { dateToTime, timeToDate } from '../lib/utils';
import { Button } from './ui';

export function TimePickerModal({
  visible,
  value,
  title = 'Meal time',
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string; // "HH:MM"
  title?: string;
  onClose: () => void;
  onSave: (hhmm: string) => void;
}) {
  const [date, setDate] = useState(() => timeToDate(new Date(), value));
  useEffect(() => {
    if (visible) setDate(timeToDate(new Date(), value));
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <Text style={s.title}>{title}</Text>
        <DateTimePicker
          value={date}
          mode="time"
          display="spinner"
          minuteInterval={5}
          themeVariant="dark"
          textColor={colors.text}
          onChange={(_, d) => d && setDate(d)}
          style={{ alignSelf: 'stretch' }}
        />
        <Button
          title="Save time"
          onPress={() => {
            onSave(dateToTime(date));
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 40,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
