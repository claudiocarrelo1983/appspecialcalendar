import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Text,Icon} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';

export default function NativeBirthdays({gym,t,color,visible,onClose}) {
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!visible)return;
    let disposed=false;setRows([]);setBusy(true);setError(false);
    gym.request('birthdays').then(result=>{
      if(!Array.isArray(result?.rows))throw Error('offline');
      if(!disposed)setRows(result.rows);
    }).catch(()=>{if(!disposed)setError(true);}).finally(()=>{if(!disposed)setBusy(false);});
    return()=>{disposed=true;};
  },[visible,gym.data.accountKey,retry]);
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={s.overlay}><View style={s.panel}>
      <View style={s.header}><View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}>
        <Icon name="gift" color={color}/><Text heading style={s.title}>{t.birthdays}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={s.close}><Text style={{fontSize:24,color:theme.muted}}>×</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {busy&&<ActivityIndicator color={color}/>}
        {error&&<View style={{gap:12}}><Text style={s.muted}>{t.offline}</Text>
          <Pressable accessibilityRole="button" onPress={()=>setRetry(value=>value+1)} style={s.close}><Text style={{color}}>{t.retry}</Text></Pressable></View>}
        {!busy&&!error&&!rows.length&&<Text style={s.muted}>{t.noBirthdays}</Text>}
        {[true,false].map(today=>{
          const group=rows.filter(row=>row.today===today);
          return group.length>0&&<View key={String(today)} style={{gap:12}}>
            <Text style={[s.section,{color:today?theme.success:theme.text}]}>{today?t.birthdaysToday:t.upcomingBirthdays}</Text>
            {group.map((row,index)=><View key={index} style={s.row}>
              <View style={[s.icon,{backgroundColor:brandSoft(color)}]}><Icon name="gift" color={color} size={20}/></View>
              <Text style={s.name}>{row.name}</Text><Text style={s.muted}>{row.date}</Text>
            </View>)}
          </View>;
        })}
      </ScrollView>
    </View></View>
  </Modal>;
}
const s=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(15,23,42,.3)',padding:16,justifyContent:'center'},
  panel:{width:'100%',maxWidth:480,maxHeight:'80%',alignSelf:'center',backgroundColor:theme.surface,borderRadius:20,overflow:'hidden'},
  header:{paddingLeft:20,paddingRight:8,paddingVertical:12,borderBottomWidth:1,borderColor:theme.border,flexDirection:'row',alignItems:'center',gap:8},
  title:{fontSize:18,color:theme.text,flexShrink:1},close:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},
  content:{padding:20,gap:20},section:{fontSize:14,fontWeight:'600'},muted:{fontSize:12,color:theme.muted,lineHeight:20},
  row:{flexDirection:'row',alignItems:'center',gap:10},icon:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},
  name:{flex:1,color:theme.text,fontSize:13},
});
