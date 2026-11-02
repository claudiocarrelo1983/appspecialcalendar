import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text,Icon} from './NativeGymTypography';
import {fitnessCalendar} from '../utils/fitnessCalendar';
import theme,{brandSoft} from '../utils/gymUiTheme';
export default function NativeFitnessCalendar({accountKey,language='en',color,visible,onClose}){
  const pt=language==='pt',insets=useSafeAreaInsets();
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0);
  const load=async()=>{const version=++generation.current;setBusy(true);setError('');try{const next=await fitnessCalendar(accountKey).list();if(version===generation.current)setRows(next);}catch{if(version===generation.current)setError(pt?'Permita o acesso ao calendário nas definições do telemóvel.':'Allow calendar access in your phone settings, then try again.');}finally{if(version===generation.current)setBusy(false);}};
  useEffect(()=>{setRows([]);if(visible)load();return()=>{generation.current++;};},[visible,accountKey]);
  const remove=row=>Alert.alert(pt?'Eliminar do calendário?':'Delete from phone calendar?',row.title,[{text:pt?'Cancelar':'Cancel',style:'cancel'},{text:pt?'Eliminar':'Delete',style:'destructive',onPress:async()=>{setBusy(true);try{await fitnessCalendar(accountKey).remove(row.id);await load();}catch{setError(pt?'Não foi possível eliminar. Tente novamente.':'Could not delete the event. Try again.');setBusy(false);}}}]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={[s.page,{paddingTop:Math.max(16,insets.top),paddingBottom:insets.bottom}]}>
    <View style={s.heading}><Text heading style={s.title}>{pt?'O meu calendário':'My calendar'}</Text><Pressable accessibilityRole="button" accessibilityLabel={pt?'Fechar':'Close'} onPress={onClose} style={s.touch}><Text style={{fontSize:28}}>×</Text></Pressable></View>
    <Text style={s.hint}>{pt?'Apenas eventos adicionados por esta aplicação. Eliminar um evento não cancela a reserva da aula.':'Only events added by this app. Deleting an event does not cancel your class booking.'}</Text>
    {busy&&<ActivityIndicator color={color}/>}
    {!!error&&<Pressable onPress={load} style={s.card}><Text style={{color:theme.danger}}>{error}</Text></Pressable>}
    <ScrollView contentContainerStyle={s.list}>{!busy&&!error&&!rows.length&&<Text style={s.hint}>{pt?'Ainda não adicionou aulas ao calendário.':'No classes added to your phone calendar yet.'}</Text>}
      {rows.map(row=><View key={row.id} style={s.card}><Icon name="bookings" color={color}/><View style={{flex:1,gap:6}}><Text heading>{row.title}</Text><Text style={s.hint}>{new Date(row.startDate).toLocaleString(pt?'pt-PT':'en-GB')}</Text></View><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={(pt?'Eliminar ':'Delete ')+row.title} onPress={()=>remove(row)} style={[s.touch,{backgroundColor:brandSoft(color,.08)}]}><Text style={{color:theme.danger,fontSize:13}}>{pt?'Eliminar':'Delete'}</Text></Pressable></View>)}
    </ScrollView></View></Modal>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:theme.surface,paddingHorizontal:16,gap:16},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:24,color:theme.text},hint:{fontSize:13,lineHeight:20,color:theme.muted},touch:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12},list:{gap:12,paddingBottom:24},card:{flexDirection:'row',gap:12,alignItems:'center',padding:16,borderRadius:18,borderWidth:1,borderColor:theme.border}});
