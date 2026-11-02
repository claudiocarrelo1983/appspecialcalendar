import React,{useEffect,useRef} from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './NativeGymTypography';
import theme from '../utils/gymUiTheme';

export function shiftScheduleDate(date, days) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Same Monday–Sunday strip and ±day/±week navigation as the booking WebView.
export default function NativeScheduleFilter({ date, today, language = 'en', classCode = '', classes = [], disabled, color, onDate, onClass }) {
  const pt = language === 'pt', locale = pt ? 'pt-PT' : 'en-GB';
  const selected = new Date(date + 'T12:00:00Z');
  const days=useRef(null);
  const centerDay=()=>days.current?.scrollTo({x:Math.max(0,((selected.getUTCDay()+6)%7)*78-110),animated:false});
  useEffect(centerDay,[date]);
  const monday = shiftScheduleDate(date, -((selected.getUTCDay() + 6) % 7));
  const item = (label, active, onPress, key, extra = {}) => <Pressable key={key} accessibilityRole="button"
    accessibilityLabel={extra.accessibilityLabel || label} accessibilityState={{ selected: active, disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={[s.pill, extra.navigation && s.navigationPill, extra.today && s.todayPill, active && { backgroundColor: color, borderColor: color }, disabled && { opacity: .5 }]}>
    <Text numberOfLines={extra.navigation ? 1 : undefined} adjustsFontSizeToFit={!!extra.navigation} minimumFontScale={.8} style={[s.label, active && s.white]}>{label}</Text></Pressable>;
  return <View style={s.card} testID="native-schedule-filter">
    <Text heading style={s.month}>{selected.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
    <View style={s.arrows}>
      {item('«', false, () => onDate(shiftScheduleDate(date, -7)), 'previous-week', { navigation: true, accessibilityLabel: pt ? 'Semana anterior' : 'Previous week' })}
      {item('‹', false, () => onDate(shiftScheduleDate(date, -1)), 'previous-day', { navigation: true, accessibilityLabel: pt ? 'Dia anterior' : 'Previous day' })}
      {item(pt ? 'Hoje' : 'Today', date === today, () => onDate(today), 'today', { navigation: true, today: true })}
      {item('›', false, () => onDate(shiftScheduleDate(date, 1)), 'next-day', { navigation: true, accessibilityLabel: pt ? 'Dia seguinte' : 'Next day' })}
      {item('»', false, () => onDate(shiftScheduleDate(date, 7)), 'next-week', { navigation: true, accessibilityLabel: pt ? 'Semana seguinte' : 'Next week' })}
    </View>
    <ScrollView ref={days} onLayout={centerDay} horizontal showsHorizontalScrollIndicator contentContainerStyle={s.strip}>
      {Array.from({ length: 7 }, (_, index) => {
        const value = shiftScheduleDate(monday, index), day = new Date(value + 'T12:00:00Z'), active = value === date;
        return <Pressable key={value} accessibilityRole="button" accessibilityLabel={day.toLocaleDateString(locale, { dateStyle: 'full', timeZone: 'UTC' })}
          accessibilityState={{ selected: active, disabled: !!disabled }} disabled={disabled} onPress={() => onDate(value)}
          style={[s.day, active && { backgroundColor: color, borderColor: color }]}>
          <Text style={[s.weekday, active && s.white]}>{day.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</Text>
          <View style={s.number}><Text style={s.label}>{day.getUTCDate()}</Text></View>
        </Pressable>;
      })}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.strip}>
      {[{ code: '', label: pt ? 'Todas' : 'All' }, ...classes.filter(row => row.code)].map(row =>
        item(row.label, row.code === classCode, () => onClass(row.code), row.code || 'all'))}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 22, padding: 14, gap: 16, marginBottom: 20 },
  month: { fontSize: 22, color: theme.text, textTransform: 'capitalize' },
  arrows: { flexDirection: 'row', gap: 7 },
  pill: { flexGrow: 1, minWidth: 54, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 24, backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  navigationPill: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0, paddingHorizontal: 4 },
  todayPill: { flexGrow: 1.4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.text },
  white: { color: '#fff' }, strip: { gap: 10, paddingBottom: 8 },
  day: { width: 68, minHeight: 76, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center', gap: 7 },
  weekday: { fontSize: 11, fontWeight: '700', color: theme.muted },
  number: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f2f4f7', alignItems: 'center', justifyContent: 'center' },
});
