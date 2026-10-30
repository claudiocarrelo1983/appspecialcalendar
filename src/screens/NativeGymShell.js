import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, PixelRatio, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, useWindowDimensions, View } from 'react-native';
import {useFonts} from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import nativeGymTranslations from '../utils/nativeGymTranslations';
import { formatDuration, qrRuns } from '../utils/nativeGymCore';
import NativeWorkoutTimer from './NativeWorkoutTimer';
import NativeNotifications from './NativeNotifications';
import NativeBirthdays from './NativeBirthdays';
import {Icon,Text,NativeFontContext} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';
import companyAppConfig from '../utils/companyAppConfig';
import {companyLogoImage} from '../utils/nativeCompanyBranding';

function Button({label,onPress,color,disabled,secondary}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled:!!disabled}} disabled={disabled}
    onPress={onPress} style={[s.button,{backgroundColor:secondary?brandSoft(color,.07):color,opacity:disabled ? 0.45 : 1}]}>
    <Text style={[s.buttonText,{color:secondary?color:'#fff'}]}>{label}</Text></Pressable>;
}
function Card({title,icon,color=theme.primaryFallback,frameless=false,children}) { return <View testID={frameless?'native-frameless-surface':undefined} style={[s.card,frameless&&s.frameless]}>{title && <View style={s.sectionHeading}>
  {icon&&<View style={[s.iconPlate,{backgroundColor:brandSoft(color)}]}><Icon name={icon} color={color}/></View>}
  <Text heading style={s.cardTitle}>{title}</Text></View>}{children}</View>; }
function SessionClock({session}) {
  const [now,setNow]=useState(Date.now());
  const base=useRef({seconds:session?.elapsedSeconds||0,at:Date.now()});
  useEffect(()=>{base.current={seconds:session?.elapsedSeconds||0,at:Date.now()};setNow(Date.now());},[session?.elapsedSeconds,session?.startedAt]);
  useEffect(()=>{if(!session?.inGym)return;const tick=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(tick);},[session?.inGym]);
  const seconds = session?.inGym ? base.current.seconds+Math.max(0,now-base.current.at)/1000 : session?.elapsedSeconds;
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.metric,{color:theme.success}]}>{formatDuration(seconds)}</Text>;
}
function NativePass({data,t,color}) {
  const {width}=useWindowDimensions();
  const pass=data.pass, runs=useMemo(()=>qrRuns(pass?.matrix),[pass?.matrix]);
  if(!pass)return <Card frameless><Text style={s.muted}>{t.noPass}</Text></Card>;
  const units=pass.matrix.length+8;
  const cell=Math.floor(Math.min(width-theme.gutter*2,320)*PixelRatio.get()/units)/PixelRatio.get();
  return <Card title={t.pass} icon="pass" color={color} frameless>
    <View style={s.passHeading}><Text heading style={s.name}>{data.client.name}</Text>
      <Text style={s.muted}>{data.company.name} · {t.member} {data.client.number}</Text>
      <View style={s.badge}><Text style={s.badgeText}>{t[pass.status==='active'?'active':'upcomingPass']}</Text></View>
      <Text style={s.cardTitle}>{pass.title}</Text></View>
    <View accessible accessibilityLabel={t.pass+' · '+t.member+' '+data.client.number}
      style={[s.qr,{width:cell*units,height:cell*units}]}>
      {runs.map((run,index)=><View key={index} style={{position:'absolute',backgroundColor:'#000',
        left:run.x*cell,top:run.y*cell,width:run.width*cell,height:cell}}/>)}
    </View>
    <Text style={s.center}>{t.showReception}</Text>
    <Text style={s.center}>{t.validUntil} {pass.validUntil}</Text>
  </Card>;
}
function NativeSessions({gym,t,color}) {
  const [days,setDays]=useState(30),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const revision=useRef(0);
  const load=async(page=1)=>{
    const requestRevision=++revision.current;setBusy(true);setError('');
    try {
      // Anchor the range to the club's server date rather than the phone's timezone.
      const to=gym.data.serverTime.slice(0,10);
      const from=new Date(Date.parse(to+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
      const next=await gym.request('sessions',{from,to,page});
      if(requestRevision!==revision.current)return;
      setResult(previous=>({...next,rows:page===1?next.rows:[...(previous?.rows||[]),...next.rows]}));
    }catch(failure){if(requestRevision===revision.current)setError(failure.message);}
    finally{if(requestRevision===revision.current)setBusy(false);}
  };
  useEffect(()=>{setResult(null);load();return()=>{revision.current++;};},[days,gym.data.accountKey,gym.data.serverTime]);
  const stats=result?.stats;
  const daily=result?.stats?.daily||{},chartDates=[];
  if(result?.from&&result?.to){for(let d=new Date(result.from+'T12:00:00Z');d<=new Date(result.to+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1))chartDates.push(d.toISOString().slice(0,10));}
  const max=Math.max(1,...Object.values(daily));
  return <View style={s.stack}>
    <View style={s.pageHeading}><View style={[s.pageIcon,{backgroundColor:brandSoft(color)}]}><Icon name="sessions" color={color}/></View>
      <View><Text style={s.muted}>{t.healthTools}</Text><Text heading style={s.pageTitle}>{t.sessions}</Text></View></View>
    <View style={s.chips}>{[7,30,90].map(value=><Pressable key={value} accessibilityRole="button"
      accessibilityState={{selected:days===value}} onPress={()=>setDays(value)}
      style={[s.chip,{backgroundColor:days===value?color:'#edf3f8'}]}>
      <Text style={{color:days===value?'#fff':'#475569'}}>{t['last'+value]}</Text></Pressable>)}</View>
    {days!==30&&<Button secondary label={t.resetFilters} color={color} onPress={()=>setDays(30)}/>}
    {!!error && <Card><Text style={s.warning}>{error==='offline'?t.offline:error}</Text>
      <Button label={t.retry} color={color} onPress={()=>load()}/></Card>}
    {stats && <View style={s.grid}>{[[t.visits,stats.visits],[t.days,stats.days],
      [t.total,formatDuration(stats.seconds)],[t.average,formatDuration(stats.average)]].map(([label,value])=>
      <View key={label} style={s.stat}><View style={[s.iconPlate,{width:36,height:36,backgroundColor:brandSoft(color)}]}>
        <Icon name={label===t.visits?'sessions':label===t.days?'bookings':label===t.total?'timer':'week'} color={color}/></View>
        <View style={{flex:1,gap:4}}><Text style={s.metricSmall}>{value}</Text><Text style={s.muted}>{label}</Text></View></View>)}</View>}
    {stats&&<Card title={t.sessionChart} icon="sessions" color={color}>
      <View accessibilityLabel={t.sessionChart} style={s.chart}>{chartDates.map(date=><View key={date} style={s.chartColumn}>
        <View style={{height:Math.max(3,100*(daily[date]||0)/max),backgroundColor:daily[date]?color:theme.border,borderTopLeftRadius:3,borderTopRightRadius:3}}/>
      </View>)}</View><View style={s.row}><Text style={s.muted}>{result.from}</Text><Text style={s.muted}>{result.to}</Text></View></Card>}
    <Card title={t.sessions} icon="sessions" color={color}>{result?.rows?.length===0 && <Text style={s.muted}>{t.noSessions}</Text>}
      {result?.rows?.map(row=><View key={row.id} style={s.historyRow}><View style={{flex:1,gap:4}}>
        <Text style={s.strong}>{row.date}</Text><Text style={s.muted}>{row.entry} → {row.exit||'—'}</Text></View>
        <View style={{alignItems:'flex-end',gap:4}}><Text style={s.strong}>{formatDuration(row.seconds)}</Text>
          <View style={[s.status,{backgroundColor:row.status==='completed'?theme.successSoft:row.status==='in_progress'?brandSoft(color):theme.surfaceSoft}]}>
            {row.status==='completed'&&<Icon name="check" color={theme.success} size={14}/>}
            <Text style={{fontSize:12,color:row.status==='completed'?theme.success:row.status==='in_progress'?color:theme.muted}}>{t[row.status]}</Text></View></View></View>)}
      {busy && <ActivityIndicator color={color}/>}
      {result?.hasMore && <Button disabled={busy} label={t.loadMore} color={color} onPress={()=>load(result.page+1)}/>}
    </Card>
  </View>;
}
function Home({gym,t,color}) {
  const data=gym.data, session=data.session;
  const [avatarFailed,setAvatarFailed]=useState(false);
  useEffect(()=>setAvatarFailed(false),[data.accountKey,data.client.avatarUrl]);
  return <View style={s.stack}>
    <View style={s.hero}><View style={s.heroPanel}><View style={s.heroIdentity}>
      <View style={s.avatar}>{!avatarFailed&&/^https?:\/\//.test(data.client.avatarUrl||'')?
        <Image key={data.client.avatarUrl} source={{uri:data.client.avatarUrl}} resizeMode="cover" accessibilityLabel={data.client.name}
          style={s.avatarImage} onError={()=>setAvatarFailed(true)}/>:<Icon name="profile" color="#fff" size={32}/>}</View>
      <View style={{flex:1,gap:6}}><Text style={s.heroEyebrow}>{t.welcome.toUpperCase()}</Text>
        <Text heading style={s.heroName}>{data.client.name}</Text><Text style={s.heroText}>{data.company.name}</Text>
        <Text style={s.heroText}>{data.pass?.title||t.noPass}</Text><Text style={s.heroText}>{t.member} {data.client.number}</Text></View>
      {data.pass&&<View style={s.heroBadge}><Icon name="check" color="#fff" size={14}/><Text style={s.heroBadgeText}>{t[data.pass.status==='active'?'active':'upcomingPass']}</Text></View>}
    </View>{data.features.pass && <Pressable accessibilityRole="button" onPress={()=>gym.select('pass')} style={s.heroAction}>
      <Icon name="pass" color={color} size={20}/><Text style={{color:theme.text,fontWeight:'600'}}>{t.pass}</Text></Pressable>}</View></View>
    {data.features.sessions && <Card title={t.today} icon="session" color={color}>
      <View style={s.row}><Text style={session?.inGym?s.success:s.muted}>{session?.inGym?t.inside:t.outside}</Text></View>
      <View style={s.sessionMetrics}><View style={s.sessionMetric}><Text style={s.muted}>{t.entry}</Text><Text style={s.metric}>{session?.entryTime||'—'}</Text></View>
        <View style={[s.sessionMetric,s.sessionMetricRight]}><Text style={s.muted}>{t.duration}</Text><SessionClock session={session}/></View></View>
      <Button label={gym.busy?t.loading:(session?.inGym?t.checkout:t.checkin)} color={color}
        disabled={gym.busy||!!gym.error||(!session?.inGym&&!data.canCheckin)}
        onPress={()=>session?.inGym?Alert.alert(t.checkoutConfirm,'',[{text:t.cancel,style:'cancel'},
          {text:t.confirm,onPress:gym.checkout}]):gym.checkin()}/>
      {!data.canCheckin&&!session?.inGym && <Text style={s.muted}>{t.unavailable}</Text>}
      <View style={[s.infoStrip,{backgroundColor:brandSoft(color,.07)}]}><Icon name="sessions" size={17} color={theme.muted}/>
        <Text style={s.muted}>{session?.previousVisit?t.previous+': '+session.previousVisit.slice(0,10):t.noPrevious}</Text></View>
    </Card>}
    {data.features.week && data.week && <Card title={t.week} icon="week" color={color}>
      <Text style={s.strong}>{data.week.count} / {data.week.goal} {t.training}</Text>
      <View style={s.week}>{data.week.days.map(day=><View key={day.date} style={[s.day,day.attended&&{backgroundColor:color}]}>
        {day.attended?<Icon name="check" color="#fff" size={20}/>:<Text style={s.muted}>{new Date(day.date+'T12:00:00').toLocaleDateString(data.language,{weekday:'narrow'})}</Text>}</View>)}</View>
      <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:data.week.percent}} style={s.track}>
        <View style={{height:8,borderRadius:6,backgroundColor:color,width:data.week.percent+'%'}}/></View>
      <View style={[s.infoStrip,{backgroundColor:brandSoft(color,.07)}]}><Icon name="week" color={color}/><View style={{flex:1,gap:4}}>
        <Text style={s.strong}>{Math.max(0,data.week.goal-data.week.count)} {t.weekRemaining}</Text><Text style={s.muted}>{data.week.streak} {t.streak}</Text></View></View>
    </Card>}
    <Card title={t.upcoming} icon="bookings" color={color}>{data.bookings.length===0&&<Text style={s.muted}>{t.noBookings}</Text>}
      {data.bookings.map(booking=><View key={booking.id} style={s.historyRow}><View style={{flex:1,gap:4}}>
        <Text style={s.strong}>{booking.title}</Text>
        <Text style={s.muted}>{new Date(booking.startsAt).toLocaleString(data.language,{timeZone:data.timezone,dateStyle:'medium',timeStyle:'short'})}</Text>
      </View></View>)}
      <Button label={t.bookings} color={color} onPress={()=>gym.openWeb('bookings')}/></Card>
  </View>;
}
export default function NativeGymShell({gym,bottomExtension=0,children}) {
  const insets=useSafeAreaInsets(), data=gym.data;
  const [refreshing,setRefreshing]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false),[logoFailed,setLogoFailed]=useState(false);
  const [logoRatio,setLogoRatio]=useState(1);
  const [languageOpen,setLanguageOpen]=useState(false);
  const [birthdaysOpen,setBirthdaysOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false),[unread,setUnread]=useState(0);
  useEffect(()=>{setNotificationsOpen(false);setMenuOpen(false);setLanguageOpen(false);setBirthdaysOpen(false);},[data?.accountKey]);
  useEffect(()=>setUnread(Math.max(0,Number(data?.unreadNotifications)||0)),[data?.accountKey,data?.unreadNotifications]);
  const [fontsLoaded]=useFonts({
    GymBoxicons:require('../assets/fonts/boxicons.ttf'),
    GymBody:require('../assets/fonts/Poppins-Regular.ttf'),
    GymBodySemiBold:require('../assets/fonts/Poppins-SemiBold.ttf'),
    GymHeading:require('../assets/fonts/BricolageGrotesque-Bold.ttf'),
  });
  useEffect(()=>{setLogoFailed(false);setLogoRatio(1);},[data?.company.logoUrl]);
  const t=nativeGymTranslations(data?.language);
  const color=/^#[a-f0-9]{6}$/i.test(data?.company?.color||'')?data.company.color:companyAppConfig().color;
  const native=!!data && gym.screen!=='web';
  const setup=!data && ['loading','failed'].includes(gym.bootstrapState);
  const tabs=data?['bookings',...(data.features.pass?['pass']:[]),
    ...(data.features.sessions?['sessions']:[]),...(data.features.timer?['timer']:[]),'settings']:[];
  useEffect(()=>{
    if(data && ((gym.screen==='pass'&&!data.features.pass)||(gym.screen==='sessions'&&!data.features.sessions)
      ||(gym.screen==='timer'&&!data.features.timer)))gym.openWeb('bookings');
  },[gym.screen,data?.features.pass,data?.features.sessions,data?.features.timer]);
  const doRefresh=async()=>{setRefreshing(true);try{await gym.refresh();}finally{setRefreshing(false);}};
  return <NativeFontContext.Provider value={fontsLoaded}><View style={[s.root,{marginBottom:-bottomExtension}]}>
    {!!data&&<View style={s.header}>
      {gym.screen==='web'&&gym.webSection!=='bookings'&&<Pressable accessibilityRole="button" accessibilityLabel={t.back} accessibilityHint={t.leaveWeb}
        onPress={()=>gym.openWeb('bookings')} style={s.headerButton}><Icon name="back" color={theme.text}/></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={t.bookings} onPress={()=>gym.openWeb('bookings')} style={s.headerIdentity}>
        <Image accessibilityLabel={data.company.name} source={!logoFailed&&/^https?:\/\//.test(data.company.logoUrl||'')?
          {uri:data.company.logoUrl}:companyLogoImage()} resizeMode="contain"
          onError={()=>{setLogoFailed(true);setLogoRatio(1);}}
          onLoad={({nativeEvent})=>{
            const {width,height}=nativeEvent.source||{};
            if(width>0&&height>0)setLogoRatio(width/height);
          }} style={[s.logo,{width:Math.min(150,48*logoRatio)}]}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.language} accessibilityState={{expanded:languageOpen,disabled:gym.busy}}
        disabled={gym.busy} onPress={()=>setLanguageOpen(true)} style={s.languageButton}>
        <Text style={s.languageCode}>{data.language.toUpperCase()}</Text><Text style={s.languageChevron}>⌄</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.notifications+(unread?' ('+unread+')':'')} onPress={()=>setNotificationsOpen(true)} style={s.headerButton}>
        <Icon name="bell" color={theme.text}/>
        {unread>0&&<View style={s.unreadBadge}><Text style={s.unreadText}>{unread>99?'99+':unread}</Text></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.birthdays} onPress={()=>setBirthdaysOpen(true)} style={s.headerButton}>
        <Icon name="gift" color={theme.text}/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.more} onPress={()=>setMenuOpen(true)} style={s.headerButton}>
        <Icon name="settings" color={theme.text}/></Pressable>
    </View>}
    <View style={native||setup?s.hiddenWeb:s.web} pointerEvents={native||setup?'none':'auto'}
      accessibilityElementsHidden={native||setup} importantForAccessibility={native||setup?'no-hide-descendants':'auto'}>{children}</View>
    {setup&&<View testID="native-client-setup" style={s.setup}>
      <Image source={companyLogoImage()} resizeMode="contain" style={{width:160,height:64}}/>
      <Text heading style={s.cardTitle}>{gym.bootstrapState==='loading'?t.appLoading:t.appLoadFailed}</Text>
      {gym.bootstrapState==='loading'?<ActivityIndicator color={color}/>:<>
        <Text style={[s.muted,{textAlign:'center'}]}>{t.appLoadHelp}</Text>
        {!!gym.bootstrapError&&<Text selectable style={[s.muted,{textAlign:'center'}]}>{t.errorReference}: {gym.bootstrapError}</Text>}
        <Button label={t.retry} color={color} onPress={()=>gym.refresh()}/>
        <Button secondary label={t.signInAgain} color={color} onPress={gym.signIn}/>
      </>}
    </View>}
    {native && <View style={s.native}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor={color}/>}>
        <View style={s.contentColumn}>
          {!!gym.error && <View style={s.error}><Text style={s.warning} accessibilityLiveRegion="polite">{gym.error==='offline'?t.offline:gym.error}</Text>
            <Button label={t.retry} color={color} onPress={doRefresh}/></View>}
          {gym.screen==='home'&&<Home gym={gym} t={t} color={color}/>}
          {gym.screen==='pass'&&data.features.pass&&<NativePass data={data} t={t} color={color}/>}
          {gym.screen==='sessions'&&data.features.sessions&&<NativeSessions gym={gym} t={t} color={color}/>}
          {gym.screen==='timer'&&data.features.timer&&<NativeWorkoutTimer key={data.accountKey} accountKey={data.accountKey} t={t} color={color}/>}
        </View>
      </ScrollView>
    </View>}
    {!!data&&<View style={[s.tabs,{paddingBottom:(Platform.OS==='ios'?theme.iosFooterPadding:theme.androidFooterPadding)+Math.min(insets.bottom,bottomExtension)}]}>
      {tabs.map(route=>{const active=gym.screen===route||(gym.screen==='web'&&gym.webSection===route);return <Pressable key={route}
        accessibilityRole="tab" accessibilityLabel={t[route]} accessibilityState={{selected:active}}
        onPress={()=>['bookings','settings'].includes(route)?gym.openWeb(route):gym.select(route)} style={s.tab}>
        <Icon name={route} size={28} color={active?color:'#999999'}/>
        <Text numberOfLines={1} style={[s.tabLabel,{color:active?color:'#999999'}]}>{t[route]}</Text></Pressable>;})}
    </View>}
    <Modal transparent visible={!!data&&languageOpen} animationType="fade" onRequestClose={()=>setLanguageOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={()=>setLanguageOpen(false)}
        style={[s.languageOverlay,{paddingTop:insets.top+70}]}>
        <View style={s.languagePanel}>
          {['en','pt'].map(language=><Pressable key={language} accessibilityRole="radio" accessibilityState={{checked:data?.language===language,disabled:gym.busy}}
            disabled={gym.busy} onPress={()=>{
              setLanguageOpen(false);gym.setLanguage(language).catch(failure=>Alert.alert(t.language,failure.message==='offline'?t.offline:failure.message));
            }} style={s.languageOption}>
            <Text style={[s.strong,data?.language===language&&{color}]}>{language==='en'?'English':'Português'}</Text>
            {data?.language===language&&<Icon name="check" color={color} size={18}/>}
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
    <Modal transparent visible={!!data&&menuOpen} animationType="fade" onRequestClose={()=>setMenuOpen(false)}>
      <Pressable onPress={()=>setMenuOpen(false)} style={s.menuOverlay}><View style={s.menuPanel}>
        <Text heading style={s.cardTitle}>{t.more}</Text>
        {['profile','packages','performance','notifications','settings'].map(route=><Pressable key={route} accessibilityRole="button"
          onPress={()=>{setMenuOpen(false);gym.openWeb(route);}} style={s.menuRow}>
          <Icon name={route==='performance'?'week':route==='packages'?'pass':route==='notifications'?'bell':route} color={color}/>
          <Text style={s.strong}>{t[route]}</Text></Pressable>)}
        <Pressable accessibilityRole="button" disabled={gym.busy} onPress={()=>{
          setMenuOpen(false);gym.logout().catch(failure=>Alert.alert(t.logout,failure.message==='offline'?t.offline:failure.message));
        }} style={s.menuRow}><Icon name="logout" color={theme.danger}/><Text style={[s.strong,{color:theme.danger}]}>{t.logout}</Text></Pressable>
        <Button secondary label={t.close} color={color} onPress={()=>setMenuOpen(false)}/>
      </View></Pressable>
    </Modal>
    {!!data&&<NativeNotifications gym={gym} t={t} color={color} visible={notificationsOpen} onClose={()=>setNotificationsOpen(false)} onUnread={setUnread}/>}
    {!!data&&<NativeBirthdays gym={gym} t={t} color={color} visible={birthdaysOpen} onClose={()=>setBirthdaysOpen(false)}/>}
  </View></NativeFontContext.Provider>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:theme.page},web:{flex:1},hiddenWeb:{position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0},
  setup:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:20},
  native:{flex:1},header:{minHeight:70,backgroundColor:theme.surface,paddingVertical:10,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:theme.border},
  club:{fontSize:19,fontWeight:'800',color:theme.text},subtitle:{color:theme.muted,fontSize:12,marginTop:4},
  headerIdentity:{flex:1,minWidth:0,alignItems:'flex-start',justifyContent:'center'},logo:{width:150,height:48,maxWidth:'100%'},
  headerButton:{position:'relative',width:44,height:48,alignItems:'center',justifyContent:'center'},
  languageButton:{minWidth:52,height:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4},
  languageCode:{fontSize:13,color:theme.text},languageChevron:{fontSize:18,color:theme.muted},
  languageOverlay:{flex:1,alignItems:'flex-end',paddingHorizontal:16,backgroundColor:'rgba(15,23,42,.12)'},
  languagePanel:{width:180,backgroundColor:theme.surface,borderRadius:12,borderWidth:1,borderColor:theme.border,padding:6,
    shadowColor:'#15243b',shadowOpacity:.12,shadowOffset:{width:0,height:3},shadowRadius:12,elevation:5},
  languageOption:{minHeight:48,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  unreadBadge:{position:'absolute',top:1,right:1,minWidth:17,height:17,paddingHorizontal:4,borderRadius:99,backgroundColor:theme.danger,alignItems:'center',justifyContent:'center'},
  unreadText:{fontSize:9,color:'#fff',fontWeight:'600'},
  settings:{width:48,height:48,alignItems:'center',justifyContent:'center'},content:{padding:16,paddingBottom:28,alignItems:'center'},
  contentColumn:{width:'100%',maxWidth:760,gap:theme.gap},stack:{gap:theme.gap},
  card:{backgroundColor:theme.surface,padding:theme.cardPadding,borderRadius:theme.cardRadius,borderWidth:1,borderColor:theme.border,gap:16,
    shadowColor:'#15243b',shadowOpacity:.05,shadowOffset:{width:0,height:2},shadowRadius:6,elevation:1},
  frameless:{padding:0,backgroundColor:'transparent',borderWidth:0,borderRadius:0,shadowOpacity:0,shadowRadius:0,elevation:0},
  sectionHeading:{flexDirection:'row',alignItems:'center',gap:12},iconPlate:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',flexShrink:0},
  cardTitle:{fontSize:18,fontWeight:'700',color:theme.text,flexShrink:1},
  hero:{padding:12,borderRadius:theme.cardRadius,backgroundColor:theme.hero,borderWidth:1,borderColor:'rgba(255,255,255,.08)'},
  heroPanel:{padding:16,borderRadius:16,backgroundColor:'rgba(255,255,255,.055)',borderWidth:1,borderColor:'rgba(255,255,255,.1)',gap:16},
  heroIdentity:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:24},
  avatar:{width:56,height:66,borderRadius:18,borderWidth:3,borderColor:'rgba(255,255,255,.2)',backgroundColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center'},
  avatarImage:{width:'100%',height:'100%',borderRadius:14},
  heroBadge:{position:'absolute',top:0,right:0,borderRadius:99,paddingVertical:5,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:theme.success},
  heroBadgeText:{fontSize:10,color:'#fff',fontWeight:'600'},
  heroAction:{alignSelf:'flex-start',minHeight:44,borderRadius:99,backgroundColor:theme.surface,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:8},
  heroEyebrow:{color:theme.heroMuted,fontSize:11,fontWeight:'600'},heroName:{color:theme.heroText,fontSize:25,fontWeight:'700'},heroText:{color:theme.heroMuted,fontSize:13},
  button:{borderRadius:theme.buttonRadius,minHeight:48,paddingHorizontal:16,paddingVertical:13,alignItems:'center',justifyContent:'center'},
  buttonText:{fontSize:15,fontWeight:'600',textAlign:'center'},muted:{color:theme.muted,fontSize:13,lineHeight:20},
  strong:{fontSize:14,color:theme.text,fontWeight:'600'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  success:{color:theme.success,fontSize:13,fontWeight:'600'},metric:{fontSize:28,fontWeight:'700',color:theme.text,fontVariant:['tabular-nums']},
  sessionMetrics:{flexDirection:'row',backgroundColor:'#f3f7fb',borderRadius:16,padding:18,gap:12},
  sessionMetric:{flex:1,gap:10,alignItems:'center'},sessionMetricRight:{borderLeftWidth:1,borderColor:theme.border},
  infoStrip:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14},
  week:{flexDirection:'row',gap:6,justifyContent:'space-between'},
  day:{flex:1,maxWidth:48,aspectRatio:1,backgroundColor:theme.surfaceSoft,borderRadius:99,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center'},
  track:{height:8,backgroundColor:'#edf2f7',borderRadius:6,overflow:'hidden'},historyRow:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:14,borderTopWidth:1,borderColor:'#eef2f6'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},stat:{flexGrow:1,flexBasis:'45%',backgroundColor:theme.surface,borderRadius:theme.cardRadius,borderWidth:1,borderColor:theme.border,padding:16,gap:10,flexDirection:'row',alignItems:'center'},
  status:{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4,paddingHorizontal:8,borderRadius:99},
  chart:{height:112,flexDirection:'row',alignItems:'flex-end',gap:2,borderBottomWidth:1,borderColor:theme.border},
  chartColumn:{flex:1,minWidth:1,justifyContent:'flex-end'},
  pageHeading:{flexDirection:'row',alignItems:'center',gap:12},pageIcon:{width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center'},
  pageTitle:{fontSize:24,color:theme.text,fontWeight:'700'},
  metricSmall:{fontSize:18,fontWeight:'600',color:theme.text,fontVariant:['tabular-nums']},chips:{flexDirection:'row',gap:8},
  chip:{minHeight:44,borderRadius:12,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  passHeading:{alignItems:'center',gap:12},name:{fontSize:23,fontWeight:'800',color:'#0f172a',textAlign:'center'},
  badge:{backgroundColor:theme.successSoft,borderRadius:30,paddingHorizontal:14,paddingVertical:6},badgeText:{color:theme.success,fontWeight:'600'},
  qr:{alignSelf:'center',backgroundColor:'#fff'},center:{textAlign:'center',fontSize:13,color:'#64748b'},
  tabs:{flexDirection:'row',backgroundColor:theme.surface,borderTopWidth:1,borderColor:theme.border,paddingTop:12,paddingHorizontal:6},
  tab:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',gap:4},tabIcon:{fontSize:25},tabLabel:{fontSize:10,fontWeight:'600'},
  back:{backgroundColor:'#fff',paddingHorizontal:18,minHeight:44,justifyContent:'center',borderBottomWidth:1,borderColor:'#e6edf4'},
  error:{backgroundColor:theme.warningSoft,padding:16,borderRadius:16,gap:12},warning:{color:theme.warning,fontSize:13,lineHeight:20},
  menuOverlay:{flex:1,backgroundColor:'rgba(15,23,42,.3)',padding:16,justifyContent:'center'},
  menuPanel:{width:'100%',maxWidth:460,alignSelf:'center',backgroundColor:theme.surface,borderRadius:theme.cardRadius,padding:20,gap:12},
  menuRow:{flexDirection:'row',alignItems:'center',gap:12,minHeight:48,borderBottomWidth:1,borderColor:theme.border},
});
