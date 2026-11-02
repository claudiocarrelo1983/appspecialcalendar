import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './NativeGymTypography';
import { adminMemberTarget } from '../utils/nativeAdminPages';

export default function NativeAdminScanner({ visible, config, base, t, onClose, onOpen, color }) {
  const [permission,requestPermission]=useCameraPermissions(), [error,setError]=useState(''), [foreground,setForeground]=useState(AppState.currentState==='active');
  const locked=useRef(false),insets=useSafeAreaInsets();
  useEffect(()=>{locked.current=false;setError('');},[visible]);
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove();},[]);
  const scan=({data})=>{
    if(locked.current)return;
    const target=adminMemberTarget(data,config,base);
    if(!target){setError(t.invalidQr);return;}
    locked.current=true;onClose();onOpen(target);
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={[s.root,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
      <View style={s.header}><Text heading style={s.title}>{t.scan}</Text><Pressable accessibilityRole="button" onPress={onClose} style={s.button}><Text>{t.close}</Text></Pressable></View>
      {permission?.granted && visible && foreground ? <CameraView testID="native-admin-camera" style={s.camera} facing="back"
        barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={scan} onMountError={()=>setError(t.cameraDenied)}/> :
        <View style={s.permission}><Text>{t.cameraDenied}</Text><Pressable accessibilityRole="button" style={[s.button,{backgroundColor:color}]}
          onPress={()=>permission?.canAskAgain===false ? Linking.openSettings() : requestPermission().catch(()=>setError(t.cameraDenied))}>
          <Text style={{color:'#fff'}}>{permission?.canAskAgain===false?t.settings:t.camera}</Text></Pressable></View>}
      {!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
    </View>
  </Modal>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#fff'},header:{padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  title:{fontSize:20,flex:1},button:{minHeight:44,padding:12,borderRadius:12},camera:{flex:1,margin:16,borderRadius:20},
  permission:{flex:1,justifyContent:'center',alignItems:'center',gap:20,padding:24},error:{padding:20,color:'#b45309'}});
