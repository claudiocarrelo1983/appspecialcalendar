import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Modal,Pressable,RefreshControl,ScrollView,StyleSheet,Switch,View} from 'react-native';
import {Text,Icon} from './NativeGymTypography';
import NativeScheduleFilter from './NativeScheduleFilter';
import NativeClassShare from './NativeClassShare';
import {ShareIcon} from './NativeAdminHeader';
import {createClassCalendarHandler} from '../utils/nativeCalendar';
import {showCalendarFailure} from '../utils/calendarAlerts';
import theme,{brandSoft} from '../utils/gymUiTheme';

function Button({label,onPress,color,disabled,secondary,style}){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress} style={[s.button,{backgroundColor:secondary?brandSoft(color,.08):color,opacity:disabled ? .45 : 1},style]}><Text style={{color:secondary?color:'#fff',fontWeight:'700',textAlign:'center'}}>{label}</Text></Pressable>;}
export default function NativeClientBookings({bookings,language='en',color,base,sharing,onSignIn,accountKey}){
  const pt=language==='pt',page=bookings.page;
  const [classCode,setClassCode]=useState(''),[hidePast,setHidePast]=useState(false),[alertsOpen,setAlertsOpen]=useState(false),[detail,setDetail]=useState(null),[share,setShare]=useState(null),[familyOpen,setFamilyOpen]=useState(false),[waiver,setWaiver]=useState(null),[agreed,setAgreed]=useState(false);
  const [detailsOpen,setDetailsOpen]=useState({});
  const calendar=useRef(null),scroll=useRef(null);if(!calendar.current)calendar.current=createClassCalendarHandler(base);
  useEffect(()=>{setClassCode('');setDetailsOpen({});setDetail(null);setShare(null);setWaiver(null);},[page?.clientGuid]);
  useEffect(()=>{setDetailsOpen({});setDetail(null);setShare(null);scroll.current?.scrollTo({y:0,animated:false});},[page?.date]);
  useEffect(()=>{if(classCode&&page&&!page.classFilters.some(item=>item.code===classCode))setClassCode('');},[classCode,page?.classFilters]);
  useEffect(()=>{if(page&&bookings.focused){const row=page.rows.find(item=>String(item.schedule_id)===String(bookings.focused));if(row)setDetail(row.key);else Alert.alert(pt?'Aula indisponível':'Class unavailable',pt?'Esta aula já não está disponível.':'This class is no longer available.');bookings.closeFocused();}},[page,bookings.focused]);
  const rows=useMemo(()=>page?.rows.filter(row=>(!classCode||row.class_code===classCode)&&(!hidePast||!row.past))||[],[page,classCode,hidePast]);
  const selected=page?.rows.find(row=>row.key===detail);
  const confirm=action=>Alert.alert(action.label,pt?'Confirmar esta ação para a aula selecionada?':'Confirm this action for the selected class?',[
    {text:pt?'Voltar':'Back',style:'cancel'},{text:pt?'Confirmar':'Confirm',onPress:()=>bookings.perform(action)}]);
  const calendarOpen=row=>calendar.current(row,language,accountKey).catch(error=>showCalendarFailure(error,language));
  const bookingButton=(action,style)=>{const removing=['cancel-booking','leave-waitlist'].includes(action.kind);return <Button key={action.kind} style={style} label={action.label} secondary={removing} color={removing?theme.danger:color} disabled={bookings.busy||!action.enabled} onPress={()=>confirm(action)}/>;};
  const unavailableLabel=row=>row.status==='finished'?(pt?'Aula terminada':'Class finished')
    :row.booked?(pt?'Reservada':'Booked')
    :row.waitlisted?(pt?'Lista de espera':'Waitlisted')
    :/abrem|not open|open on|opens at/i.test(row.reason||'')?(pt?'Reservas por abrir':'Bookings not open')
    :row.status==='in_progress'?(pt?'Aula em curso':'Class in progress')
    :row.available===0?(pt?'Aula completa':'Class full')
    :(pt?'Reservas encerradas':'Bookings closed');
  const details=row=><View testID={'class-details-'+row.key} style={s.details}><Text style={s.description}>{row.description|| (pt?'Sem descrição adicional.':'No additional description.')}</Text><Text heading style={s.section}>{pt?'Participantes':'Participants'} · {row.participants.length}</Text>{row.participants.map((person,index)=><View key={index} style={s.person}><Icon name="profile" color={color}/><Text>{person.name}</Text></View>)}</View>;
  const controls=row=><View style={s.actions}>
    <Pressable accessibilityRole="button" accessibilityLabel={pt?'Adicionar ao calendário':'Add to calendar'} style={[s.utility,{backgroundColor:'#e9f4ff'}]} onPress={()=>calendarOpen(row)}><Icon name="bookings" color="#1264a3" size={22}/><Text style={{position:'absolute',fontSize:10,left:21,top:19,color:'#1264a3',backgroundColor:'#e9f4ff'}}>+</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={pt?'Partilhar aula':'Share class'} style={[s.utility,{backgroundColor:brandSoft(color)}]} onPress={()=>{setDetail(null);setShare(row);}}><ShareIcon color={color}/></Pressable>
    {row.actions[0]?bookingButton(row.actions[0],{flex:1,minWidth:0}):row.status!=='finished'&&<Button
      label={unavailableLabel(row)} accessibilityLabel={unavailableLabel(row)+(row.reason?'. '+row.reason:'')}
      disabled secondary color={theme.muted} style={{flex:1,minWidth:0,opacity:1,backgroundColor:theme.surfaceSoft}}/>}
  </View>;
  const card=(row,expanded=false)=><View style={s.card}>
    <View style={s.top}><Text style={{color,fontWeight:'700'}}>{row.start_time} – {row.end_time}</Text>{row.status!=='finished'&&<Text style={[s.status,{color,backgroundColor:brandSoft(color)}]}>{row.booked?(pt?'Reservada':'Booked'):row.waitlisted?(pt?'Lista de espera':'Waitlisted'):({in_progress:pt?'Em curso':'In progress',upcoming:pt?'Próxima':'Upcoming'}[row.status])}</Text>}</View>
    <Pressable accessibilityRole="button" onPress={()=>setDetail(row.key)}><Text heading style={s.classTitle}>{row.class_name}</Text></Pressable>
    <Text style={s.muted}>{[row.coach,row.room].filter(Boolean).join(' · ')}</Text>
    {expanded&&<Text style={s.muted}>{row.date}</Text>}
    {(!expanded||row.status==='finished')&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      {!expanded&&<Pressable accessibilityRole="button" accessibilityLabel={(pt?'Detalhes: ':'Details: ')+row.class_name} accessibilityState={{expanded:!!detailsOpen[row.key]}} onPress={()=>setDetailsOpen(previous=>({...previous,[row.key]:!previous[row.key]}))} style={s.detailsToggle}><Text style={{color,fontWeight:'600',fontSize:13}}>{pt?'Detalhes':'Details'}</Text><View accessible={false} style={[s.detailsChevron,{borderColor:color,transform:[{rotate:detailsOpen[row.key]?'225deg':'45deg'}],marginTop:detailsOpen[row.key]?4:-4}]}/></Pressable>}
      {row.status==='finished'&&<Button label={pt?'Terminada':'Finished'} disabled color={theme.danger||'#dc2626'} style={{minWidth:112,marginLeft:'auto',opacity:1}}/>}
    </View>}
    {(expanded||detailsOpen[row.key])&&details(row)}
    <View style={s.top}><Text>{pt?'Lugares disponíveis':'Available places'}</Text><Text style={{fontWeight:'700'}}>{row.capacity>0?row.available+' / '+row.capacity:'∞'}</Text></View>
    <View style={s.track}><View style={{height:6,backgroundColor:color,borderRadius:4,width:(row.capacity?Math.min(100,Math.max(0,row.registered/row.capacity*100)):0)+'%'}}/></View>
    {!!row.reason&&<Text style={s.muted}>{row.reason}</Text>}
    {!!row.opensAt&&row.status==='upcoming'&&<Text style={s.muted}>{pt?'Abertura das reservas: ':'Bookings open: '}{row.opensAt}</Text>}
    {controls(row)}
    {row.actions.slice(1).map(action=>bookingButton(action))}
  </View>;
  const knownErrors=['connection','offline','server','request_failed','invalid_response','navigating','forbidden','push_permission','csrf_unavailable'];
    const errorText=['connection','offline'].includes(bookings.error)?(pt?'A ligação foi interrompida. Não foi possível confirmar as aulas atualizadas. Tente novamente.':'The connection was interrupted. Updated classes could not be confirmed. Try again.'):
      bookings.error==='push_permission'?(pt?'Ative as notificações para receber alertas de abertura.':'Enable notifications to receive booking alerts.'):
    knownErrors.includes(bookings.error)?(pt?'Não foi possível atualizar as aulas. Tente novamente.':'Could not update classes. Try again.'):bookings.error;
  if(!page)return <View testID="native-client-bookings-startup" style={s.loading}>
    {!bookings.error?<View testID="native-client-bookings-spinner" style={{alignItems:'center',justifyContent:'center',gap:14}}>
      <ActivityIndicator color={color}/>
      <Text accessibilityLiveRegion="polite" style={[s.muted,{textAlign:'center',fontSize:14}]}>{pt?'A carregar aulas…':'Loading classes…'}</Text>
    </View>:<><Text heading style={s.title}>{pt?'Reservar uma aula':'Book a class'}</Text><Text style={s.muted}>{errorText}</Text>{!!bookings.reference&&<Text style={s.muted}>{bookings.reference}</Text>}<Button label={pt?'Tentar novamente':'Try again'} color={color} onPress={()=>bookings.load()}/>{bookings.error==='forbidden'&&onSignIn&&<Button label={pt?'Iniciar sessão':'Sign in'} secondary color={color} onPress={onSignIn}/>}</>}
  </View>;
  return <View style={{flex:1}} testID="native-client-bookings"><ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={bookings.busy} tintColor={color} onRefresh={()=>bookings.load()}/>}>
    <Text heading style={s.title}>{pt?'Reservar uma aula':'Book a class'}</Text>
    {page.family.length>1&&<Button secondary label={(pt?'Reservar para: ':'Booking for: ')+(page.family.find(person=>person.guid===page.clientGuid)?.name||'')} color={color} disabled={bookings.busy} onPress={()=>setFamilyOpen(true)}/>}
    {!!bookings.error&&<View accessibilityLiveRegion="polite" style={s.error}><Text style={{color:theme.danger}}>{errorText}</Text><Text style={s.muted}>{bookings.reference}</Text><Button label={pt?'Tentar novamente':'Try again'} secondary color={color} onPress={()=>bookings.load()}/></View>}
    {!!bookings.notice&&<Text accessibilityLiveRegion="polite" style={{color}}>{bookings.notice}</Text>}
    <NativeScheduleFilter date={page.date} today={page.today} language={language} classCode={classCode} classes={page.classFilters} color={color} disabled={bookings.busy} onDate={date=>bookings.load({date})} onClass={setClassCode}/>
    <View style={s.card}><Button secondary label={(alertsOpen?'▾ ':'▸ ')+(page.openingWindow?(pt?'Alertas quando as reservas abrirem':'Alerts when bookings open'):(pt?'Alertas de aulas':'Class alerts'))} color={color} onPress={()=>setAlertsOpen(!alertsOpen)}/>
      {alertsOpen&&(page.alertsReady?page.alerts.map(alert=><View key={alert.code} style={s.top}><Text style={{flex:1}}>{alert.name}</Text><Switch accessibilityLabel={alert.name} value={alert.enabled} disabled={bookings.busy} trackColor={{true:color}} onValueChange={enabled=>bookings.perform({kind:'booking-alert',enabled:true,params:{class_code:alert.code,company_code:page.companyCode,enabled:enabled?'1':'0'}})}/></View>):<Text style={s.muted}>{pt?'Os alertas ainda não estão disponíveis neste clube.':'Alerts are not available for this club yet.'}</Text>)}</View>
    <View style={s.top}><Text heading style={s.section}>{page.date.split('-').reverse().join('/')} · {rows.length}</Text><Button secondary label={hidePast?(pt?'Mostrar aulas passadas':'Show past classes'):(pt?'Ocultar aulas passadas':'Hide past classes')} color={color} onPress={()=>setHidePast(!hidePast)}/></View>
    {rows.map(row=><View key={row.key}>{card(row)}</View>)}
    {!rows.length&&<Text style={s.muted}>{pt?'Não existem aulas para esta seleção.':'No classes for this selection.'}</Text>}
    {!!page.membership&&<View style={s.card}><Text heading style={s.section}>{page.membership.title}</Text><Text style={s.muted}>{page.membership.start} – {page.membership.end}</Text><View style={s.top}><Text>{pt?'Aulas restantes':'Classes remaining'}: {page.kpis.classes_remaining??'—'}</Text><Text>{pt?'Saldo em aberto':'Outstanding balance'}: {page.kpis.outstanding_balance??0}</Text></View></View>}
    {!!page.waivers.length&&<View style={s.card}><Text heading style={s.section}>{pt?'Documentos por assinar':'Documents to sign'}</Text>{page.waivers.map(item=><Button key={item.code} secondary color={color} label={item.title} onPress={()=>{setAgreed(false);setWaiver(item);}}/>)}</View>}
  </ScrollView>
    <Modal transparent visible={!!selected||!!share} animationType="slide" onRequestClose={()=>{setDetail(null);setShare(null);}}>{share?<NativeClassShare embedded item={share} language={language} color={color} search={sharing.searchShareClients} send={sharing.sendClassInvitation} onClose={()=>setShare(null)}/>:<View style={s.overlay}><View style={s.detailsPanel}><View style={s.detailsHeading}><Text heading style={s.section}>{pt?'Detalhes da aula':'Class details'}</Text><Pressable accessibilityRole="button" accessibilityLabel={pt?'Fechar':'Close'} onPress={()=>setDetail(null)} style={s.closeTouch}><View accessible={false} style={s.cross}><View style={[s.crossLine,{transform:[{rotate:'45deg'}]}]}/><View style={[s.crossLine,{transform:[{rotate:'-45deg'}]}]}/></View></Pressable></View><ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={s.content}>{selected&&card(selected,true)}{!!bookings.error&&<Text accessibilityRole="alert" style={{color:theme.danger}}>{errorText}</Text>}{!!bookings.notice&&<Text style={{color}}>{bookings.notice}</Text>}</ScrollView></View></View>}</Modal>
    <Modal transparent visible={familyOpen} animationType="fade" onRequestClose={()=>setFamilyOpen(false)}><View style={s.overlay}><View style={s.card}>{page.family.map(person=><Button key={person.guid} secondary color={color} label={person.name} onPress={()=>{setFamilyOpen(false);bookings.load({client_guid:person.guid});}}/>)}<Button color={color} label={pt?'Fechar':'Close'} onPress={()=>setFamilyOpen(false)}/></View></View></Modal>
    <Modal visible={!!waiver} animationType="slide" onRequestClose={()=>setWaiver(null)}><View style={s.modal}><Button secondary color={color} label={pt?'Fechar':'Close'} onPress={()=>setWaiver(null)}/><ScrollView contentContainerStyle={s.content}><Text heading style={s.title}>{waiver?.title}</Text><Text style={s.description}>{waiver?.content}</Text><View style={s.top}><Text>{pt?'Li e aceito este documento':'I have read and agree to this document'}</Text><Switch accessibilityLabel={pt?'Aceitar documento':'Agree to document'} value={agreed} onValueChange={setAgreed} trackColor={{true:color}}/></View><Button color={color} label={pt?'Assinar':'Sign'} disabled={!agreed||bookings.busy} onPress={async()=>{if(await bookings.perform({kind:'sign-waiver',enabled:true,params:{waiver_code:waiver.code,company_code:page.companyCode,client_guid:page.clientGuid}}))setWaiver(null);}}/>{!!bookings.error&&<Text style={{color:theme.danger}}>{errorText}</Text>}</ScrollView></View></Modal>
  </View>;
}
const s=StyleSheet.create({detailsPanel:{width:'100%',maxHeight:'85%',backgroundColor:'#fff',borderRadius:24,overflow:'hidden'},detailsHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingLeft:18,paddingRight:8,paddingVertical:8,borderBottomWidth:1,borderColor:theme.border},closeTouch:{width:44,height:44,alignItems:'center',justifyContent:'center'},cross:{width:20,height:20,alignItems:'center',justifyContent:'center'},crossLine:{position:'absolute',width:19,height:2,borderRadius:1,backgroundColor:theme.text},content:{padding:16,gap:16,paddingBottom:30},loading:{flex:1,padding:24,gap:20,justifyContent:'center'},title:{fontSize:25,color:theme.text},section:{fontSize:17,color:theme.text},card:{padding:18,borderWidth:1,borderColor:theme.border,borderRadius:22,backgroundColor:'#fff',gap:12},classTitle:{fontSize:21,color:theme.text},muted:{fontSize:12,lineHeight:20,color:theme.muted},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'},status:{fontSize:11,padding:8,borderRadius:20},track:{height:6,borderRadius:4,backgroundColor:theme.surfaceSoft},button:{minHeight:44,borderRadius:14,padding:12,alignItems:'center',justifyContent:'center'},details:{gap:10,paddingVertical:8},detailsToggle:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:10,minHeight:44},detailsChevron:{width:8,height:8,borderRightWidth:2,borderBottomWidth:2},actions:{flexDirection:'row',alignItems:'stretch',gap:8},utility:{minWidth:44,minHeight:44,borderRadius:10,alignItems:'center',justifyContent:'center'},description:{fontSize:15,lineHeight:25,color:theme.text},person:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},history:{paddingVertical:12,borderBottomWidth:1,borderColor:theme.border,gap:5},error:{padding:14,borderRadius:14,backgroundColor:'#fff5f5',gap:8},modal:{flex:1,paddingTop:42,paddingHorizontal:12,paddingBottom:20,backgroundColor:theme.page},overlay:{flex:1,backgroundColor:'#0006',justifyContent:'center',padding:24}});
