// Language Picker Sheet: 20 languages with native scripts, flag icons,
// smooth selection feedback, and search filter.
import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, TextInput, View } from 'react-native'
import { Check, Globe, Search, X } from 'lucide-react-native'
import { LANGUAGES, type LanguageMeta } from '../../lib/i18n'
import { useStore } from '../../lib/store'
import { Sheet } from './BottomSheet'
import { T } from './Text'
import { PressScale, tick } from '../animated/SpringPressable'
import { C, brand500, brand600, ink } from '../../theme/colors'
import { F } from '../../theme/typography'

interface LanguagePickerProps {
  visible: boolean
  onClose: () => void
}

export function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
  const currentLang = useStore(s => s.language) || 'en'
  const setLanguage = useStore(s => s.setLanguage)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LANGUAGES
    return LANGUAGES.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [query])

  const select = (code: string) => {
    tick('selection')
    setLanguage(code)
    onClose()
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose Language / ভাষা / भाषा">
      <View style={styles.container}>
        {/* Search */}
        <View style={styles.searchRow}>
          <Search size={16} color={ink(0.5)} />
          <TextInput
            placeholder="Search language / ভাষা খুঁজুন..."
            placeholderTextColor={ink(0.4)}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query ? (
            <PressScale onPress={() => setQuery('')} style={styles.clearBtn} haptic="selection">
              <X size={14} color={ink(0.6)} />
            </PressScale>
          ) : null}
        </View>

        {/* List of 20 languages */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = item.code === currentLang
            return (
              <PressScale
                onPress={() => select(item.code)}
                style={[styles.langItem, isSelected && styles.selectedItem]}
                haptic="selection"
              >
                <View style={styles.flagBox}>
                  <T variant="h3">{item.flag}</T>
                </View>
                <View style={styles.langTexts}>
                  <T variant="title" color={isSelected ? C.brand500 : C.ink}>
                    {item.nativeName}
                  </T>
                  <T variant="tiny" color={ink(0.55)}>
                    {item.name}
                  </T>
                </View>
                {isSelected && (
                  <View style={styles.checkCircle}>
                    <Check size={14} color={C.white} strokeWidth={2.6} />
                  </View>
                )}
              </PressScale>
            )
          }}
        />
      </View>
    </Sheet>
  )
}

/** Small trigger pill to open LanguagePicker on headers or landing */
export function LanguageTriggerButton({ onPress }: { onPress: () => void }) {
  const currentLang = useStore(s => s.language) || 'en'
  const langMeta = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0]

  return (
    <PressScale onPress={onPress} style={styles.triggerBtn} haptic="selection">
      <Globe size={14} color={C.brand500} />
      <T variant="smallMedium" color={C.brand500} style={styles.triggerText}>
        {langMeta.flag} {langMeta.nativeName}
      </T>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  container: { maxHeight: 420 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(108,62,200,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.ink,
    paddingVertical: 0,
  },
  clearBtn: { padding: 4 },
  listContent: { gap: 8, paddingBottom: 16 },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108,62,200,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  selectedItem: {
    backgroundColor: brand600(0.1),
    borderColor: brand500(0.4),
  },
  flagBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTexts: { flex: 1 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.brand500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: brand600(0.08),
    borderWidth: 1,
    borderColor: brand500(0.25),
  },
  triggerText: { fontSize: 12 },
})
