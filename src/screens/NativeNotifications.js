import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Icon,Text} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';

export default function NativeNotifications({gym,t,color,visible,onClose,onUnread}) {
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[changing,setChanging]=useState(null);
  const revision=useRef(0);
  const accept=result=>{
    if(!result||!Array.isArray(result.rows)||!Number.isSafeInteger(result.unread))throw Error('offline');
    setRows(result.rows);onUnread(Math.max(0,result.unread));
  };
  const load=async()=>{
    const current=++revision.current;setBusy(true);setError('');setRows([]);setChanging(null);
    try{const result=await gym.request('notifications');if(current===revision.current)accept(result);}
    catch(failure){if(current===revision.current)setError(failure.message);}
    finally{if(current===revision.current)setBusy(false);}
  };
  useEffect(()=>{
    if(visible)load();
    return()=>{revision.current++;};
  },[visible,gym.data.accountKey,gym.data.serverTime,gym.data.unreadNotifications]);
  const mark=async(row)=>{
    if(changing!==null)return;
    const current=revision.current;setChanging(row.id);setError('');
    try{
      const result=await gym.request('notification-read',{id:row.id,checked:row.read?'0':'1'});
      if(current===revision.current)accept(result);
    }catch(failure){if(current===revision.current)setError(failure.message);}
    finally{if(current===revision.current)setChanging(null);}
  };
  const open=(id)=>{onClose();gym.openWeb('notifications',id?{id}:{});};
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={s.overlay}><View style={s.panel}>
      <View style={s.heading}><View style={{flex:1,gap:4}}><Text heading style={s.title}>{t.notifications}</Text>
        <Text style={s.company}>{gym.data.company.name}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={s.close}><Text style={{fontSize:24,color:theme.muted}}>×</Text></Pressable></View>
      <ScrollView style={{flexGrow:0}} contentContainerStyle={s.list}>
        {busy&&<ActivityIndicator color={color}/>}
        {!!error&&<View style={s.message}><Text style={s.error}>{error==='offline'?t.offline:error}</Text>
          <Pressable accessibilityRole="button" onPress={load} style={s.action}><Text style={{color}}>{t.retry}</Text></Pressable></View>}
        {!busy&&!error&&rows.length===0&&<View style={s.message}><Icon name="bell" color={color} size={32}/><Text style={s.company}>{t.noNotifications}</Text></View>}
        {rows.map(row=><View key={row.id} style={[s.row,!row.read&&{backgroundColor:brandSoft(color,.05)}]}>
          <View style={[s.icon,{backgroundColor:brandSoft(color)}]}><Icon name="bell" color={color} size={20}/></View>
          <Pressable accessibilityRole="button" onPress={()=>open(row.id)} style={s.body}>
            <Text style={s.noticeTitle}>{row.title}</Text><Text style={s.noticeBody}>{row.body}</Text>
            <Text style={s.date}>{new Date(row.createdAt).toLocaleString(gym.data.language==='pt'?'pt-PT':'en-GB',{timeZone:gym.data.timezone,dateStyle:'short',timeStyle:'short'})}</Text>
          </Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={row.read?t.markUnread:t.markRead}
            accessibilityState={{checked:row.read,disabled:changing!==null}} disabled={changing!==null}
            onPress={()=>mark(row)} style={s.checkTouch}>
            <View style={[s.check,{borderColor:row.read?color:theme.border,backgroundColor:row.read?color:theme.surface}]}>
              {changing===row.id?<ActivityIndicator color={row.read?'#fff':color}/>:row.read&&<Icon name="check" color="#fff" size={17}/>}
            </View>
          </Pressable>
        </View>)}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={()=>open()} style={[s.footer,{backgroundColor:brandSoft(color,.07)}]}>
        <Text style={{color,fontWeight:'600'}}>{t.viewAll}</Text></Pressable>
    </View></View>
  </Modal>;
}
const s=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(15,23,42,.3)',padding:16,justifyContent:'center'},
  panel:{width:'100%',maxWidth:480,maxHeight:'85%',alignSelf:'center',backgroundColor:theme.surface,borderRadius:20,overflow:'hidden'},
  heading:{flexDirection:'row',alignItems:'center',padding:20,borderBottomWidth:1,borderColor:theme.border,gap:8},
  title:{fontSize:20,fontWeight:'700',color:theme.text},company:{fontSize:12,color:theme.muted,lineHeight:18},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},list:{paddingVertical:8},
  row:{flexDirection:'row',alignItems:'flex-start',padding:16,gap:10,borderBottomWidth:1,borderColor:theme.border},
  icon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},
  body:{flex:1,minWidth:0,gap:6},noticeTitle:{fontSize:14,color:theme.text,fontWeight:'600',textAlign:'left'},
  noticeBody:{fontSize:13,color:theme.muted,lineHeight:20,textAlign:'left'},date:{fontSize:10,color:theme.muted,textAlign:'left'},
  checkTouch:{width:36,minHeight:44,alignItems:'center',justifyContent:'flex-start',paddingTop:3},
  check:{width:21,height:21,borderWidth:1,borderRadius:4,alignItems:'center',justifyContent:'center'},
  message:{padding:20,gap:12,alignItems:'center'},error:{color:theme.warning,fontSize:13,lineHeight:20},
  action:{minHeight:44,justifyContent:'center'},footer:{minHeight:48,padding:16,alignItems:'center',justifyContent:'center'},
});
