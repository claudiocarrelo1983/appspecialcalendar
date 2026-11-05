import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Icon,Text} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';
import {NotificationIcon} from './NativeAdminHeader';
import {notificationBookings,notificationBookingAction} from '../utils/notificationBookings';

export default function NativeNotifications({gym,bookings,base,t,color,visible,onClose,onUnread}) {
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[changing,setChanging]=useState(null);
  const revision=useRef(0);
  const mutation=useRef(false),[invitations,setInvitations]=useState({});
  const pt=gym.data.language==='pt';
  const accept=result=>{
    if(!result||!Array.isArray(result.rows)||!Number.isSafeInteger(result.unread))throw Error('offline');
    setRows(result.rows);onUnread(Math.max(0,result.unread));
  };
  const load=async()=>{
    const current=++revision.current;setBusy(true);setError('');setRows([]);setChanging(null);setInvitations({});
    try{const result=await gym.request('notifications');if(current===revision.current){accept(result);const states=await notificationBookings(result.rows,base,bookings?.request);if(current===revision.current)setInvitations(states);}}
    catch(failure){if(current===revision.current)setError(failure.message);}
    finally{if(current===revision.current)setBusy(false);}
  };
  useEffect(()=>{
    if(visible)load();
    return()=>{revision.current++;};
  },[visible,gym.data.accountKey,gym.data.serverTime,gym.data.unreadNotifications]);
  const mark=async(row)=>{
    if(mutation.current||changing!==null)return;
    mutation.current=true;
    const current=revision.current;setChanging(row.id);setError('');
    try{
      const result=await gym.request('notification-read',{id:row.id,checked:row.read?'0':'1'});
      if(current===revision.current)accept(result);
    }catch(failure){if(current===revision.current)setError(failure.message);}
    finally{mutation.current=false;if(current===revision.current)setChanging(null);}
  };
  const changeBooking=async(notice,action)=>{
    if(mutation.current||action?.enabled!==true||!bookings?.request)return;
    mutation.current=true;const current=revision.current;setChanging(notice.id);setError('');
    try{
      const result=await bookings.request(action.kind,action.params);
      if(result?.success!==true)throw Error('offline');
      // Re-read booking status; the notification's read flag is independent.
      const states=await notificationBookings(rows,base,bookings.request);
      if(current===revision.current){setInvitations(states);bookings.load?.();}
    }catch{
      if(current===revision.current){setError(pt?'Não foi possível alterar a reserva. Verifique o prazo de cancelamento e tente novamente.':'Could not change the booking. Check the cancellation window and try again.');const states=await notificationBookings(rows,base,bookings.request);if(current===revision.current)setInvitations(states);}
    }finally{mutation.current=false;if(current===revision.current)setChanging(null);}
  };
  const toggle=notice=>{
    if(!notice.bookingUrl){mark(notice);return;}
    const action=notificationBookingAction(invitations[notice.id]?.row);
    if(busy||changing!==null||action?.enabled!==true)return;
    Alert.alert(action.label,pt?'Confirmar a alteração desta reserva?':'Confirm this booking change?',[
      {text:pt?'Voltar':'Back',style:'cancel'}, {text:pt?'Confirmar':'Confirm',onPress:()=>changeBooking(notice,action)}]);
  };
  const open=(row)=>{onClose();if(row?.bookingUrl)gym.openWeb('bookings',{classUrl:row.bookingUrl});else gym.openWeb('notifications',row?.id?{id:row.id}:{});};
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
        {rows.map(row=>{const invitation=!!row.bookingUrl,task=row.type==='task',accent=invitation?'#7c3aed':task?'#b45309':color,state=invitations[row.id]?.row,checked=invitation?state?.booked===true:row.read;
          const action=invitation?notificationBookingAction(state):null,disabled=changing!==null||(invitation&&(busy||action?.enabled!==true));
          const label=invitation?(checked?(pt?'Cancelar reserva':'Cancel booking'):(pt?'Reservar aula':'Book class')):(row.read?t.markUnread:t.markRead);
          return <View key={row.id} style={[s.row,(!row.read||invitation)&&{backgroundColor:brandSoft(accent,.05)}]}>
          <View style={[s.icon,{backgroundColor:brandSoft(accent)}]}><NotificationIcon invitation={invitation} task={task} color={accent}/></View>
          <Pressable accessibilityRole="button" onPress={()=>open(row)} style={s.body}>
            <Text style={s.noticeTitle}>{row.title}</Text><Text style={s.noticeBody}>{row.body}</Text>
            {invitation&&<View style={s.invitationMeta}><Text style={[s.date,{color:accent,fontWeight:'600'}]}>{pt?'Convite para aula':'Class invitation'}</Text>
              {state?<View testID={'invitation-booking-status-'+row.id} style={[s.bookingStatus,{backgroundColor:checked?'#dcfce7':'#fee2e2'}]}><Text style={{fontSize:11,fontWeight:'600',color:checked?'#15803d':'#b91c1c'}}>{checked?(pt?'Reservada':'Booked'):(pt?'Não reservada':'Not booked')}</Text></View>
                :<Text style={s.date}>{busy?(pt?'A carregar reserva…':'Loading booking…'):(pt?'Reserva indisponível':'Booking unavailable')}</Text>}
            </View>}
            {invitation&&!!state?.reason&&<Text style={s.date}>{state.reason}</Text>}
            <Text style={s.date}>{new Date(row.createdAt).toLocaleString(gym.data.language==='pt'?'pt-PT':'en-GB',{timeZone:gym.data.timezone,dateStyle:'short',timeStyle:'short'})}</Text>
          </Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled}} aria-checked={checked} disabled={disabled}
            onPress={()=>toggle(row)} style={[s.checkTouch,disabled&&invitation&&{opacity:.55}]}>
            <View style={[s.check,{borderColor:checked?accent:theme.border,backgroundColor:checked?accent:theme.surface}]}>
              {changing===row.id?<ActivityIndicator color={checked?'#fff':accent}/>:checked&&<Icon name="check" color="#fff" size={17}/>}
            </View>
          </Pressable>
        </View>;})}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel={t.viewAll} onPress={()=>{onClose();gym.openWeb('notifications');}} style={[s.footer,{backgroundColor:brandSoft(color,.07)}]}>
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
  invitationMeta:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6},bookingStatus:{alignSelf:'flex-start',borderRadius:20,paddingHorizontal:9,paddingVertical:4},
  message:{padding:20,gap:12,alignItems:'center'},error:{color:theme.warning,fontSize:13,lineHeight:20},
  action:{minHeight:44,justifyContent:'center'},footer:{minHeight:48,padding:16,alignItems:'center',justifyContent:'center'},
});
