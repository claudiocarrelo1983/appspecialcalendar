import React,{createContext,useContext} from 'react';
import {Text as SystemText,StyleSheet} from 'react-native';
import theme from '../utils/gymUiTheme';
export const NativeFontContext=createContext(false);
export function Text({style,heading,...props}){
  const loaded=useContext(NativeFontContext);
  const flat=StyleSheet.flatten(style)||{};
  const family=heading||flat.fontFamily==='GymHeading'?'GymHeading':Number(flat.fontWeight)>=600?'GymBodySemiBold':'GymBody';
  return <SystemText {...props} style={[style,loaded?{fontFamily:family,fontWeight:'normal'}:{fontFamily:undefined}]}/>;
}
export function Icon({name,size=24,color=theme.muted,style}){
  const loaded=useContext(NativeFontContext);
  return <SystemText accessible={false} style={[{fontSize:size,lineHeight:size,color,textAlign:'center'},
    loaded?{fontFamily:'GymBoxicons',fontWeight:'normal'}:{},style]}>
    {loaded?String.fromCodePoint(parseInt(theme.icons[name]||theme.icons.pass,16)):'•'}
  </SystemText>;
}
