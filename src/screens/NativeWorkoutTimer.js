import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, TextInput, useWindowDimensions, Vibration, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { formatDuration, timerElapsed, timerFrame, validTimer } from '../utils/nativeGymCore';
import {Text,Icon} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';
import timerAlerts from '../utils/nativeTimerAlerts';

const initial = () => ({mode: 'stopwatch', status: 'idle', elapsed: 0, startedAt: 0, work: 40, rest: 20, rounds: 8});
export default function NativeWorkoutTimer({accountKey, t, color}) {
  const [timer, setTimer] = useState(initial), [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false), [warning, setWarning] = useState('');
  const [draft, setDraft] = useState({work: '40', rest: '20', rounds: '8'});
  const [now, setNow] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const {width:windowWidth}=useWindowDimensions();
  const [dialWidth,setDialWidth]=useState(null);
  const diameter=Math.min(252,dialWidth||Math.max(120,windowWidth-theme.gutter*2));
  const storage = 'native-gym-timer-' + accountKey;
  const writes = useRef(Promise.resolve()), foreground = useRef(AppState.currentState === 'active');
  useEffect(() => {
    let disposed = false; setReady(false); setTimer(initial()); setHistory([]);
    SecureStore.getItemAsync(storage).then(raw => {
      if (disposed || !raw) return;
      const saved = JSON.parse(raw);
      if (validTimer(saved.timer)) {
        setTimer(saved.timer);
        setDraft({work: String(saved.timer.work), rest: String(saved.timer.rest), rounds: String(saved.timer.rounds)});
        setHistory(Array.isArray(saved.history) ? saved.history.filter(row => Number.isFinite(row.seconds)
          && ['stopwatch','countdown','interval'].includes(row.mode) && Number.isFinite(row.at)).slice(0,10) : []);
      }
    }).catch(() => { if (!disposed) setWarning(t.storageError); })
      .finally(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; };
  }, [storage]);
  useEffect(() => {
    if (!ready) return;
    // Serialize writes so a slow earlier save cannot overwrite pause/completion.
    const saved = JSON.stringify({timer, history});
    writes.current = writes.current.catch(() => {}).then(() => SecureStore.setItemAsync(storage, saved))
      .catch(() => setWarning(t.storageError));
  }, [timer, history, ready, storage]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    timerAlerts.sync(accountKey, timer, t.timerDone, t.timerAlertBody)
      .catch(() => { if (!disposed) setWarning(t.timerSoundDisabled); });
    // Keep the OS alert scheduled when navigating to another screen.
    return () => { disposed = true; };
  }, [ready, accountKey, timer.status, timer.startedAt, timer.elapsed, timer.mode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active'; if (foreground.current) setNow(Date.now());
    });
    const tick = setInterval(() => { if (foreground.current) setNow(Date.now()); }, 250);
    return () => { clearInterval(tick); subscription.remove(); };
  }, []);
  const frame = timerFrame(timer, now);
  const runningHere = useRef(false);
  const complete = (seconds) => {
    setTimer(current => ({...current, status: 'completed', elapsed: seconds, startedAt: 0}));
    setHistory(rows => [{mode: timer.mode, seconds, at: Date.now()}, ...rows].slice(0,10));
  };
  useEffect(() => {
    if (ready && timer.status === 'running' && !frame.finished) runningHere.current = true;
    if (ready && timer.status === 'running' && frame.finished) {
      if (foreground.current) Vibration.vibrate(300);
      if (foreground.current && runningHere.current && timer.mode !== 'stopwatch') {
        timerAlerts.finish(accountKey, t.timerDone, t.timerAlertBody)
          .catch(() => { if (alive.current) setWarning(t.timerSoundDisabled); });
      }
      runningHere.current = false;
      complete(frame.planned);
    }
  }, [ready, timer.status, frame.finished]);
  const start = async () => {
    const work = timer.mode === 'stopwatch' ? 40 : Number(draft.work);
    const rest = timer.mode === 'stopwatch' ? 20 : Number(draft.rest);
    const rounds = timer.mode === 'interval' ? Number(draft.rounds) : 1;
    const next = {...timer, work, rest, rounds, elapsed: 0, startedAt: Date.now(), status: 'running'};
    const planned = timerFrame(next).planned;
    if (!validTimer(next) || planned > 86400) { Alert.alert(t.timer, t.timerInvalid); return; }
    setWarning(''); setStarting(true);
    if (next.mode !== 'stopwatch') {
      try { if (!await timerAlerts.permission() && alive.current) setWarning(t.timerSoundDisabled); }
      catch (_) { if (alive.current) setWarning(t.timerSoundDisabled); }
    }
    if (!alive.current) return;
    next.startedAt = Date.now();
    setStarting(false); setNow(next.startedAt); setTimer(next);
  };
  const reset = () => Alert.alert(t.resetConfirm, '', [
    {text: t.cancel, style: 'cancel'}, {text: t.reset, style: 'destructive', onPress: () => setTimer(current => ({...current, status:'idle', elapsed:0, startedAt:0}))},
  ]);
  const button = (label, action, primary = false) => <Pressable key={label} accessibilityRole="button"
    disabled={!ready || starting} onPress={action} style={[s.button,{backgroundColor:primary?color:brandSoft(color,.07),borderColor:brandSoft(color,.3)}]}>
    <Text style={[s.buttonText,{color:primary?'#fff':color}]}>{label}</Text></Pressable>;
  const idle = ['idle','completed'].includes(timer.status);
  return <View style={s.stack}>
    <View testID="native-timer-surface" style={[s.card,s.frameless]}>
      <View style={s.heading}><View style={[s.iconPlate,{backgroundColor:brandSoft(color)}]}><Icon name="timer" color={color}/></View>
        <View><Text style={s.muted}>{t.healthTools}</Text><Text heading style={s.title}>{t.timer}</Text></View></View>
      <View style={s.modeRow}>{['stopwatch','countdown','interval'].map(mode => <Pressable key={mode}
        accessibilityRole="button" accessibilityState={{selected:timer.mode===mode, disabled:!idle}}
        disabled={!idle || !ready} onPress={() => setTimer({...initial(), mode, rounds:mode==='interval'?8:1})}
        style={[s.chip,timer.mode===mode&&{backgroundColor:brandSoft(color),borderColor:brandSoft(color,.3)}]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{color:timer.mode===mode?color:theme.muted,fontSize:12}}>{t[mode]}</Text></Pressable>)}</View>
      {idle && timer.mode!=='stopwatch' && <View style={s.fieldsRow}>{(timer.mode==='interval'?['work','rest','rounds']:['work']).map(key =>
        <View key={key} style={s.field}><View style={s.fieldLabel}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.muted,s.fieldLabelText]}>{t[key]}</Text>
          <Text numberOfLines={1} style={[s.muted,s.fieldLabelText]}>{key==='rounds'?' ':'('+t.seconds+')'}</Text></View>
          <TextInput accessibilityLabel={t[key]} keyboardType="number-pad" maxLength={4} value={draft[key]}
            onChangeText={value=>setDraft({...draft,[key]:value.replace(/\D/g,'')})} style={s.input}/></View>)}</View>}
      <View style={s.dialMeasure} onLayout={event=>{const size=Math.floor(event.nativeEvent.layout.width);if(size>0)setDialWidth(size);}}>
      <View testID="native-workout-dial" style={[s.dial,{width:diameter,height:diameter,borderRadius:diameter/2,borderColor:brandSoft(color,.16)}]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.clock,{color:theme.text}]} accessibilityLiveRegion="off">{formatDuration(frame.display)}</Text>
        <Text style={s.muted}>{t[timer.mode]}</Text>
      </View>
      </View>
      <View style={s.track}><View style={{height:6,width:(100*Math.min(1,frame.elapsed/frame.planned))+'%',backgroundColor:color,borderRadius:4}}/></View>
      {timer.mode==='interval' && !idle && <Text style={s.center}>{t.round} {frame.round}/{timer.rounds} · {t[frame.phase]}</Text>}
      {timer.status==='completed' && <Text accessibilityLiveRegion="polite" style={s.center}>{t.timerDone}</Text>}
      <View style={s.row}>{idle ? button(t.start,start,true) : <>
        {timer.status==='running' ? button(t.pause,()=>setTimer({...timer,elapsed:timerElapsed(timer),status:'paused',startedAt:0}),true)
          : button(t.resume,()=>setTimer({...timer,status:'running',startedAt:Date.now()}),true)}
        {button(t.finish,()=>{timerAlerts.cancel(accountKey).catch(()=>setWarning(t.timerSoundDisabled));complete(Math.floor(timerElapsed(timer)));})}</>}
        {button(t.reset,reset)}</View>
      <Text style={s.hint}>{t.timerHint}</Text>
      {!!warning && <Text accessibilityLiveRegion="polite" style={s.warning}>{warning}</Text>}
    </View>
    <View style={s.card}><View style={s.heading}><View style={[s.iconPlate,{backgroundColor:brandSoft(color)}]}><Icon name="sessions" color={color}/></View>
      <Text heading style={[s.title,{flexShrink:1}]}>{t.recent}</Text></View>
      {history.map((row,index)=><View key={row.at+':'+index} style={s.history}>
        <View><Text>{t[row.mode]}</Text><Text style={s.muted}>{new Date(row.at).toLocaleDateString()}</Text></View>
        <Text style={s.time}>{formatDuration(row.seconds)}</Text></View>)}
    </View>
  </View>;
}
const s = StyleSheet.create({
  stack:{gap:theme.gap},card:{backgroundColor:theme.surface,borderRadius:theme.cardRadius,padding:theme.cardPadding,borderWidth:1,borderColor:theme.border,gap:16,
    shadowColor:'#15243b',shadowOpacity:.05,shadowOffset:{width:0,height:2},shadowRadius:6,elevation:1},
  frameless:{padding:0,backgroundColor:'transparent',borderWidth:0,borderRadius:0,shadowOpacity:0,shadowRadius:0,elevation:0},
  heading:{flexDirection:'row',alignItems:'center',gap:12},iconPlate:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  title:{fontSize:18,fontWeight:'700',color:theme.text},row:{flexDirection:'row',flexWrap:'wrap',gap:8},
  modeRow:{flexDirection:'row',gap:8},chip:{flex:1,minWidth:0,minHeight:44,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:theme.surfaceSoft,borderRadius:8,borderWidth:1,borderColor:theme.border},
  fieldsRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
  field:{flex:1,minWidth:0,gap:8},fieldLabel:{height:42,justifyContent:'flex-start',gap:2},fieldLabelText:{height:18,lineHeight:18},
  input:{fontFamily:'GymBody',height:56,minHeight:56,borderWidth:1,borderColor:theme.border,borderRadius:12,paddingHorizontal:12,paddingVertical:0,fontSize:18,color:theme.text,textAlignVertical:'center',includeFontPadding:false},
  dialMeasure:{width:'100%',alignItems:'center'},
  dial:{flexShrink:0,borderWidth:10,alignItems:'center',justifyContent:'center',paddingHorizontal:8,gap:8},
  track:{height:6,borderRadius:4,backgroundColor:theme.surfaceSoft},
  clock:{fontSize:38,fontWeight:'600',textAlign:'center',fontVariant:['tabular-nums']},
  center:{textAlign:'center',fontSize:16,color:theme.text},button:{minHeight:48,borderRadius:theme.buttonRadius,borderWidth:1,paddingHorizontal:18,justifyContent:'center'},
  buttonText:{fontWeight:'600',color:theme.text},muted:{fontSize:12,color:theme.muted},hint:{color:theme.muted,lineHeight:20,fontSize:13},
  warning:{color:'#b45309',lineHeight:20},history:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderTopWidth:1,borderColor:'#eef2f6',paddingTop:12},
  time:{fontWeight:'700',fontVariant:['tabular-nums'],color:'#0f172a'},
});
