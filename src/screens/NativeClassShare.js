import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {Text,Icon} from './NativeGymTypography';
import theme,{brandSoft} from '../utils/gymUiTheme';

export default function NativeClassShare({item,language,color,search,send,onClose,embedded=false}) {
  const pt=language==='pt', [query,setQuery]=useState(''),[rows,setRows]=useState([]),[selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const [searchedQuery,setSearchedQuery]=useState(null);
  const [bookedRecipient,setBookedRecipient]=useState(null);
  const generation=useRef(0),mounted=useRef(true),token=useRef(null),sendingLock=useRef(false);
  if(!token.current)token.current=Crypto.randomUUID();
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
  useEffect(()=>{
    const current=++generation.current;setRows([]);setError('');setSearchedQuery(null);
    if(query.trim().length<2||selected){setLoading(false);return;}
    setLoading(true);
    const timer=setTimeout(async()=>{
      try{const result=await search(query.trim());if(mounted.current&&current===generation.current){setRows(result);setSearchedQuery(query.trim());}}
      catch{if(mounted.current&&current===generation.current)setError(pt?'Não foi possível pesquisar os clientes.':'Could not search clients.');}
      finally{if(mounted.current&&current===generation.current)setLoading(false);}
    },300);
    return()=>{clearTimeout(timer);generation.current++;};
  },[query,selected,search,pt]);
  const invite=async()=>{
    if(!selected||sendingLock.current||sent||bookedRecipient===selected.id)return;sendingLock.current=true;setSending(true);setError('');
    try{await send(item,selected.id,token.current);if(mounted.current)setSent(true);}
    catch(failure){if(mounted.current){
      if(failure.reason==='already_booked'){
        setBookedRecipient(selected.id);
        Alert.alert(pt?'Já tem reserva':'Already booked',pt
          ?selected.name+' já tem uma reserva para esta aula. Não foi enviado outro convite.'
          :selected.name+' is already booked for this class. No additional invitation was sent.');
      }else setError(failure.reason==='class_started'
        ?(pt?'Esta aula já começou. Escolha uma aula futura.':'This class has already started. Choose an upcoming class.')
        :(pt?'Não foi possível enviar. Tente novamente.':'Could not send the invitation. Try again.'));
    }}
    finally{sendingLock.current=false;if(mounted.current)setSending(false);}
  };
  const content=<View style={s.overlay}><View style={s.panel}>
      <View style={s.heading}><View style={{flex:1}}><Text heading style={s.title}>{pt?'Partilhar aula':'Share class'}</Text><Text style={s.muted}>{item.class_name} · {item.date} · {item.start_time}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={pt?'Fechar':'Close'} disabled={sending} onPress={onClose} style={s.close}><Text style={{fontSize:26}}>×</Text></Pressable></View>
      {sent?<View accessibilityLiveRegion="polite" style={s.message}><Icon name="check" color={color}/><Text>{pt?'Convite enviado para':'Invitation sent to'} {selected.name}.</Text><Text style={s.muted}>{pt?'A notificação abre a aula para reservar.':'Their notification opens this class to book.'}</Text></View>:<>
        <Text style={s.label}>{pt?'Encontrar cliente':'Find a client'}</Text>
        <TextInput autoFocus maxLength={100} value={query} editable={!sending} placeholder={pt?'Escreva pelo menos 2 letras':'Type at least 2 letters'} accessibilityLabel={pt?'Pesquisar cliente':'Search client'}
          onChangeText={value=>{setQuery(value);setSelected(null);setBookedRecipient(null);}} style={s.input}/>
        {loading&&<ActivityIndicator color={color}/>}
        {selected?<View style={[s.selected,{backgroundColor:brandSoft(color)}]}><Icon name="profile" color={color}/><Text>{selected.name}</Text></View>:
          <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:230}}>{rows.map(row=><Pressable key={row.id} accessibilityRole="button" onPress={()=>{setSelected(row);setQuery(row.name);}} style={s.result}><Icon name="profile" color={color}/><Text>{row.name}</Text></Pressable>)}
            {!loading&&!error&&searchedQuery===query.trim()&&!rows.length&&<Text style={s.muted}>{pt?'Nenhum cliente encontrado.':'No matching clients.'}</Text>}</ScrollView>}
        {!!error&&<Text accessibilityRole="alert" style={{color:theme.danger}}>{error}</Text>}
        {selected&&bookedRecipient===selected.id&&<Text accessibilityLiveRegion="polite" style={s.muted}>{pt?'Este cliente já tem reserva nesta aula.':'This client is already booked for this class.'}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={pt?'Enviar convite':'Send invitation'} disabled={!selected||sending||bookedRecipient===selected?.id} onPress={invite} style={[s.send,{backgroundColor:color,opacity:(!selected||sending||bookedRecipient===selected?.id)?0.5:1}]}>
          {sending?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontWeight:'700'}}>{pt?'Enviar convite':'Send invitation'}</Text>}</Pressable>
      </>}
    </View></View>;
  return embedded?content:<Modal transparent visible animationType="fade" onRequestClose={()=>{if(!sending)onClose();}}>{content}</Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0006',justifyContent:'center',padding:20},panel:{backgroundColor:'#fff',borderRadius:24,padding:20,gap:16,maxHeight:'85%'},heading:{flexDirection:'row',alignItems:'center',gap:10},title:{fontSize:23,color:theme.text},muted:{fontSize:12,color:theme.muted,lineHeight:20},label:{fontSize:14,color:theme.text},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},input:{borderWidth:1,borderColor:theme.border,borderRadius:12,padding:14,minHeight:48,fontSize:16,color:theme.text},result:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderColor:theme.border},selected:{padding:14,borderRadius:14,flexDirection:'row',gap:12,alignItems:'center'},send:{minHeight:48,borderRadius:14,alignItems:'center',justifyContent:'center',padding:12},message:{gap:12,paddingVertical:20}});
