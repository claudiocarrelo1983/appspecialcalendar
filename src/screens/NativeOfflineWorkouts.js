import React,{useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import NativeWorkoutTimer from './NativeWorkoutTimer';
import {Text} from './NativeGymTypography';
import {NativePass} from './NativeGymShell';
import offlinePass from '../utils/offlinePass';
export default function NativeOfflineWorkouts({available,t,color,base}){
  const [account,setAccount]=useState(null),[open,setOpen]=useState(false),insets=useSafeAreaInsets();
  const [pass,setPass]=useState(null);
  useEffect(()=>{let active=true;setPass(null);if(account&&base)offlinePass.read(account,new URL(base).origin).then(value=>{if(active)setPass(value);}).catch(()=>{});return()=>{active=false;};},[account,base]);
  useEffect(()=>{let active=true;if(available)SecureStore.getItemAsync('fitness-last-account').then(key=>{if(active)setAccount(/^[a-f0-9]{64}$/.test(key||'')?key:null);}).catch(()=>{});else{setOpen(false);setAccount(null);}return()=>{active=false;};},[available]);
  if(!available||!account)return null;
  return <View style={{position:'absolute',bottom:Math.max(16,insets.bottom),left:16,right:16,zIndex:101}}><Pressable accessibilityRole="button" onPress={()=>setOpen(true)} style={{minHeight:48,padding:12,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'}}><Text style={{color}}>{pass?t.pass+' · '+t.offlineWorkouts:(t.offlineWorkouts||'Offline workout timer & history')}</Text></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom,backgroundColor:'#fff'}}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={()=>setOpen(false)} style={{minHeight:48,alignItems:'flex-end',justifyContent:'center',paddingHorizontal:20}}><Text style={{fontSize:28}}>×</Text></Pressable>
      <ScrollView contentContainerStyle={{padding:16}}><Text style={{marginBottom:16}}>{t.offlineWorkoutHelp||'Saved on this phone. Workouts sync after you sign back into this account online.'}</Text>
        {pass&&<><Text style={{marginBottom:12}}>{pass.language==='pt'?'Passe guardado offline. A receção valida o acesso atual.':'Offline saved pass. Reception verifies current access.'}</Text><NativePass offline data={pass} t={t} color={color}/></>}
        <NativeWorkoutTimer key={account} accountKey={account} t={t} color={color}/></ScrollView>
    </View></Modal></View>;
}
