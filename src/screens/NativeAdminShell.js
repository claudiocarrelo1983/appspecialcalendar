import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from './NativeGymTypography';
import { ShareIcon } from './NativeAdminHeader';
import { classBookingShareTarget } from '../utils/classLinks';
import { createClassCalendarHandler } from '../utils/nativeCalendar';
import {showCalendarFailure} from '../utils/calendarAlerts';
import { adminTranslations } from '../utils/nativeAdminCore';
import companyAppConfig from '../utils/companyAppConfig';
import theme, { brandSoft } from '../utils/gymUiTheme';
import NativeScheduleFilter from './NativeScheduleFilter';
import NativeClassShare from './NativeClassShare';

const safePhoto = (value, base) => {
  if (!value || typeof value !== 'string') return undefined;
  try { const url = new URL(value, base); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
};
function Button({ label, onPress, disabled, secondary, color, style, accessibilityLabel }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={[s.button, { backgroundColor: secondary ? brandSoft(color, .08) : color, opacity: disabled ? .45 : 1 }, style]}>
    <Text style={[s.buttonText, { color: secondary ? color : '#fff' }]}>{label}</Text>
  </Pressable>;
}
export default function NativeAdminShell({ admin, framed = false, children, brandColor, accountKey, enabled=true }) {
  const insets = useSafeAreaInsets(), { color: defaultColor, siteUrl } = companyAppConfig();
  const color = brandColor || defaultColor;
  const t = adminTranslations(admin.context?.language), native = admin.screen === 'classes' && !!admin.context;
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(null);
  const [shareItem,setShareItem]=useState(null);
  useEffect(()=>{if(admin.sharedClass)setShareItem(admin.sharedClass);},[admin.sharedClass]);
  useEffect(()=>{setShareItem(null);},[admin.context===null]);
  const listRef = useRef(null), currentClass = admin.roster?.class;
  const calendarAction = useRef(null);
  if (!calendarAction.current) calendarAction.current = createClassCalendarHandler(siteUrl);
  const pt = admin.context?.language === 'pt';
  const shareLabel = pt ? 'Partilhar aula' : 'Share class', calendarLabel = pt ? 'Adicionar ao calendário' : 'Add to calendar';
  const shareClass = item => {
    setShareItem(item);
  };
  useEffect(() => { setQuery(''); setSelected(null); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [currentClass?.schedule_id]);
  useEffect(() => {
    const timer = setTimeout(() => admin.searchMembers(query), 300);
    return () => clearTimeout(timer);
  }, [query, admin.searchMembers]);
  const mutate = (action, params) => admin.mutate(action, params).catch(() => {});
  const add = async (guest = false, confirm = false) => {
    const params = { client_guid: guest ? '' : selected?.guid || '', member_query: query.trim(),
      experimental_guest: guest ? 1 : 0, confirm_missing_membership: confirm ? 1 : 0 };
    try { const result = await admin.mutate('add', params); if (result) { setQuery(''); setSelected(null); } }
    catch (failure) {
      if (failure.confirmation && failure.reason === 'missing_membership') Alert.alert(t.add, failure.message, [
        { text: t.cancel, style: 'cancel' }, { text: t.confirm, onPress: () => add(guest, true) },
      ]);
    }
  };
  const error = admin.error && <View accessibilityLiveRegion="polite" style={s.error}>
    <Text style={{ color: theme.warning }}>{['offline','navigating','invalid_response'].includes(admin.error) ? t.error : admin.error}</Text>
  </View>;
  const classCard = ({ item }) => <View style={s.card}>
    <View style={s.cardTop}><View style={{ flex: 1 }}>
      <Text style={[s.time, { color }]}>{item.start_time} – {item.end_time}</Text>
      <Text heading style={s.title}>{item.class_name}</Text>
      <Text style={s.muted}>{[item.coach, item.room].filter(Boolean).join(' · ')}</Text>
    </View><Text style={[s.status, { backgroundColor: brandSoft(color), color }]}>{item.status?.label || ''}</Text></View>
    <View style={s.capacity}><Text>{t.capacity}</Text><Text style={s.strong}>{item.stats?.registered || 0} / {item.capacity || '∞'}</Text></View>
    <View style={s.track}><View style={{ height: 6, borderRadius: 3, backgroundColor: color,
      width: Math.min(100, item.capacity ? (item.stats?.registered || 0) / item.capacity * 100 : 0) + '%' }}/></View>
    <View style={s.classActions}>
      {!!item.calendarEvent && !!item.calendarUrl && <Pressable accessibilityRole="button" accessibilityLabel={calendarLabel}
        onPress={() => calendarAction.current(item, admin.context.language, accountKey).catch(error => showCalendarFailure(error,admin.context.language))}
        style={[s.utility, { backgroundColor: '#e9f4ff', borderColor: '#91caff' }]}><View><Icon name="bookings" size={21} color="#1264a3"/>
          <View style={{position:'absolute',left:7,top:9,width:8,height:8,backgroundColor:'#e9f4ff',alignItems:'center',justifyContent:'center'}}>
            <View style={{position:'absolute',width:8,height:2,backgroundColor:'#1264a3'}}/><View style={{position:'absolute',width:2,height:8,backgroundColor:'#1264a3'}}/>
          </View></View></Pressable>}
      {!!classBookingShareTarget(item, siteUrl) && <Pressable accessibilityRole="button" accessibilityLabel={shareLabel}
        onPress={() => shareClass(item)} style={[s.utility, { backgroundColor: brandSoft(color, .06), borderColor: brandSoft(color, .4) }]}>
        <ShareIcon color={color}/></Pressable>}
      <Button color={color} style={{ flex: 1 }} label={t.manage} onPress={() => admin.loadRoster(Number(item.schedule_id), item.date)}/>
    </View>
  </View>;
  if(!enabled)return children;
  return <View style={s.root}>
    {!!shareItem&&<NativeClassShare item={shareItem} language={shareItem.language||admin.context?.language} color={color}
      search={admin.searchShareClients} send={admin.sendClassInvitation} onClose={()=>{setShareItem(null);admin.closeShareClass?.();}}/>}
    {!framed && admin.context && admin.onDashboard && <View testID="native-admin-navigation" style={s.toolbar}>
      {[['web', t.dashboard, admin.showDashboard], ['classes', t.classes, admin.showClasses]].map(([key, label, onPress]) =>
        <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: admin.screen === key }}
          onPress={onPress} style={[s.segment, { backgroundColor: admin.screen === key ? brandSoft(color) : '#fff' }]}>
          <Text style={{ color: admin.screen === key ? color : theme.muted, fontWeight: '600' }}>{label}</Text>
        </Pressable>)}
    </View>}
    <View style={native ? s.hidden : s.web} pointerEvents={native ? 'none' : 'auto'}
      accessibilityElementsHidden={native} importantForAccessibility={native ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {native && <FlatList testID="native-admin-classes" data={admin.context.classes} keyExtractor={item => String(item.schedule_id)}
      renderItem={classCard} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={admin.busy} onRefresh={() => admin.loadClasses()} tintColor={color}/>}
      ListHeaderComponent={<>
        <NativeScheduleFilter date={admin.context.date} today={admin.context.today || admin.context.date}
          language={admin.context.language} classCode={admin.context.classCode} classes={admin.context.classFilters}
          disabled={admin.busy} color={color} onDate={date => admin.loadClasses(date)}
          onClass={code => admin.loadClasses(admin.context.date, false, code)}/>
        <Text heading style={s.heading}>{t.classes} · {admin.context.total ?? admin.context.classes.length}</Text>{error}
      </>}
      ListEmptyComponent={<Text style={s.empty}>{t.empty}</Text>}
      ListFooterComponent={admin.context.hasMore ? <Button color={color} secondary label={t.more} disabled={admin.busy}
        onPress={() => admin.loadClasses(admin.context.date, true)}/> : null}/>}
    <Modal visible={admin.rosterOpen} animationType="slide" onRequestClose={admin.closeRoster}>
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.modalHeader}><View style={{ flex: 1 }}><Text heading style={s.title}>{currentClass?.class_name || t.manage}</Text>
          {!!currentClass && <Text style={s.muted}>{currentClass.date_label || currentClass.date} · {currentClass.start_time} – {currentClass.end_time}</Text>}
        </View><Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={admin.closeRoster} style={s.close}>
          <Text style={{ fontSize: 30, color: theme.muted }}>×</Text></Pressable></View>
        {admin.rosterLoading ? <ActivityIndicator style={{ margin: 32 }} color={color}/> :
          <FlatList ref={listRef} testID="native-admin-roster" data={admin.roster?.participants || []}
            keyExtractor={item => String(item.booking_id)} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
            ListHeaderComponent={<>
              {error}
              {!!admin.error && <Button color={color} secondary label={t.retry} onPress={admin.retryRoster}/>}
              {currentClass?.can_manage === true && <View style={s.card}>
                <Text heading style={s.sectionTitle}>{t.add}</Text>
                <TextInput accessibilityLabel={t.search} placeholder={t.search} value={query}
                  onChangeText={value => { setQuery(value); setSelected(null); }} maxLength={128} style={s.input}/>
                {!selected && admin.members.slice(0, 10).map(member => <Pressable accessibilityRole="button" key={member.guid}
                  onPress={() => { setSelected(member); setQuery(member.name); }} style={s.memberOption}>
                  <Text style={s.strong}>{member.name}</Text><Text style={s.muted}>{member.secondary}</Text></Pressable>)}
                <Button color={color} label={t.add} disabled={!selected || admin.busy} onPress={() => add()}/>
                {currentClass.can_add_experimental_guest === true && <Button color={color} secondary label={t.addGuest}
                  disabled={query.trim().length < 2 || admin.busy} onPress={() => add(true)}/>}
              </View>}
              <View style={s.capacity}><Text style={s.strong}>{t.registered}: {currentClass?.stats?.registered || 0}</Text>
                <Text style={s.strong}>{t.capacity}: {currentClass?.capacity || '∞'}</Text></View>
            </>}
            ListEmptyComponent={<Text style={s.empty}>{t.noMembers}</Text>}
            renderItem={({ item }) => <View style={s.card}>
              <View style={s.person}>
                {safePhoto(item.member_photo, siteUrl) ? <Image source={{ uri: safePhoto(item.member_photo, siteUrl) }} style={s.avatar}/> :
                  <View style={[s.avatar, s.avatarPlaceholder]}><Text heading style={s.title}>{item.member_name?.slice(0, 1) || '?'}</Text></View>}
                <View style={{ flex: 1 }}><Text heading style={s.title}>{item.member_name}</Text>
                  <View style={s.badges}><Text style={s.muted}>{item.is_experimental_guest ? t.guest : t.member}</Text>
                    <Text style={[s.status, { color: item.status === 'attended' ? theme.success : item.status === 'missed' ? theme.danger : theme.warning,
                      backgroundColor: item.status === 'attended' ? theme.successSoft : theme.warningSoft }]}>
                      {item.status_label || t[item.status] || t.pending}</Text></View>
                </View>
              </View>
              {currentClass?.can_manage === true && <View style={s.actions}>
                <Button color={theme.success} secondary label="✓" accessibilityLabel={t.attended} disabled={admin.busy}
                  style={[s.attendance, item.status === 'attended' && { borderColor: theme.success, borderWidth: 2 }]}
                  onPress={() => mutate('attendance', { booking_id: item.booking_id, status: 'attended' })}/>
                <Button color={theme.danger} secondary label="×" accessibilityLabel={t.missed} disabled={admin.busy}
                  style={[s.attendance, item.status === 'missed' && { borderColor: theme.danger, borderWidth: 2 }]}
                  onPress={() => mutate('attendance', { booking_id: item.booking_id, status: 'missed' })}/>
                <Button color={theme.muted} secondary label={t.remove} disabled={admin.busy}
                  onPress={() => Alert.alert(t.remove, t.removeConfirm, [{ text: t.cancel, style: 'cancel' },
                    { text: t.confirm, style: 'destructive', onPress: () => mutate('remove', { booking_id: item.booking_id }) }])}/>
              </View>}
            </View>}/>}
      </View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  classActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  utility: { width: 44, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, backgroundColor: theme.page }, web: { flex: 1 },
  hidden: { position: 'absolute', left: -10000, width: '100%', height: '100%', opacity: 0 },
  toolbar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, gap: 8, borderBottomWidth: 1, borderColor: theme.border },
  segment: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' }, content: { padding: 16, paddingBottom: 28, gap: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.border, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, title: { fontSize: 18, color: theme.text },
  sectionTitle: { fontSize: 17, color: theme.text }, heading: { fontSize: 24, color: theme.text, marginBottom: 12 },
  muted: { fontSize: 12, color: theme.muted, lineHeight: 19 }, time: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  strong: { fontWeight: '600', color: theme.text }, dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  date: { fontSize: 18, color: theme.text }, capacity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.surfaceSoft, overflow: 'hidden' },
  button: { minHeight: 44, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' }, status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 11 },
  empty: { padding: 24, textAlign: 'center', color: theme.muted }, error: { padding: 12, borderRadius: 12, backgroundColor: theme.warningSoft, marginBottom: 12 },
  modalHeader: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: theme.border },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8 }, attendance: { flex: 1 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, color: theme.text, fontSize: 16 },
  memberOption: { paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border },
});
