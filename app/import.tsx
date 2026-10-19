import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card } from '../components/ui';
import { extractRecipe } from '../lib/api';
import { colors, radius } from '../lib/theme';
import { findVideoLink } from '../lib/utils';
import { useStore } from '../store/useStore';

const STAGES = [
  'Fetching the video…',
  'Reading the caption…',
  'Listening to the audio…',
  'Writing out the recipe…',
  'Estimating macros…',
  'Picking the best photo…',
];

export default function ImportScreen() {
  // Opening fitflow://import?url=… (e.g. from an iOS Shortcut) pre-fills the link.
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(params.url ?? '');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const saveRecipe = useStore((s) => s.saveRecipe);
  const startedFromLink = useRef(false);

  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const t = setInterval(() => setStage((n) => Math.min(n + 1, STAGES.length - 1)), 6000);
    return () => clearInterval(t);
  }, [loading]);

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    const link = findVideoLink(text);
    if (link) {
      setUrl(link);
      setError(null);
    } else setError("Your clipboard doesn't have a TikTok, Instagram or YouTube Shorts link.");
  };

  const extract = async (link = url) => {
    const clean = findVideoLink(link) ?? link.trim();
    if (!/^https?:\/\//i.test(clean)) {
      setError('Paste a full link, e.g. https://www.tiktok.com/@chef/video/…');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const recipe = await extractRecipe(clean, serverUrl);
      saveRecipe(recipe);
      router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id, fresh: '1' } });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-start when the screen was opened with a link already attached.
  useEffect(() => {
    if (params.url && !startedFromLink.current) {
      startedFromLink.current = true;
      extract(params.url);
    }
  }, [params.url]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[s.logo, { backgroundColor: '#E1306C' }]}>
              <Ionicons name="logo-instagram" size={28} color="#fff" />
            </View>
            <View style={[s.logo, { backgroundColor: '#000', borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name="logo-tiktok" size={26} color="#fff" />
            </View>
          </View>
          <Text style={s.title}>Import a recipe from Instagram or TikTok</Text>
          <Text style={s.sub}>
            Paste a link to a recipe video and we'll pull out the ingredients and steps from the caption or the
            audio, then work out the macros.
          </Text>

          <View style={s.inputRow}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.instagram.com/reel/…"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              keyboardAppearance="dark"
              style={s.input}
              editable={!loading}
              onSubmitEditing={() => extract()}
            />
            <Pressable onPress={paste} style={s.pasteBtn} disabled={loading}>
              <Ionicons name="clipboard-outline" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 4 }}>Paste</Text>
            </Pressable>
          </View>

          <Button
            title={loading ? '' : 'Extract Recipe'}
            icon="sparkles"
            loading={loading}
            onPress={() => extract()}
            style={{ alignSelf: 'stretch', marginTop: 12 }}
          />
          {loading && <Text style={s.stage}>{STAGES[stage]} This can take up to a minute.</Text>}
          {error && <Text style={s.error}>{error}</Text>}
        </Card>

        <Text style={s.or}>or</Text>
        <Button
          title="Type a recipe in manually"
          variant="secondary"
          icon="create-outline"
          onPress={() => router.replace('/recipe/edit')}
          disabled={loading}
        />

        <Card style={{ marginTop: 24 }}>
          <Text style={s.tipTitle}>How to copy a link</Text>
          <Text style={s.tip}>
            TikTok: tap Share → Copy link.{'\n'}Instagram: tap the paper plane → Copy link.{'\n'}Then come back and tap
            Paste.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  sub: { color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 20, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  stage: { color: colors.muted, marginTop: 12, textAlign: 'center' },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  or: { color: colors.muted, textAlign: 'center', marginVertical: 14 },
  tipTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  tip: { color: colors.muted, lineHeight: 21 },
});
