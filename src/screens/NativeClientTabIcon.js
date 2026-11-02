import React from 'react';
import {StyleSheet,View} from 'react-native';
import {Icon} from './NativeGymTypography';

// Fixed drawing area keeps every footer symbol centered independently of font metrics.
export default function NativeClientTabIcon({name,color}){
  const stroke={borderColor:color},line={backgroundColor:color};
  return <View accessible={false} style={s.frame}>
    {name==='bookings'?<View style={[s.calendar,stroke]}>
      <View style={[s.calendarRule,line]}/>{[3,12].map(left=><View key={left} style={[s.binding,line,{left}]}/>)}
      <View style={[s.check,stroke]}/>
    </View>:name==='pass'?<View style={[s.pass,stroke]}>
      <View style={[s.head,stroke]}/><View style={[s.shoulders,stroke]}/>
      <View style={[s.cardLine,line,{top:5}]}/><View style={[s.cardLine,line,{top:10,width:5}]}/>
    </View>:name==='sessions'||name==='timer'?<>
      {name==='timer'&&<><View style={[s.timerTop,line]}/><View style={[s.timerStem,line]}/></>}
      <View style={[s.clock,stroke,name==='timer'&&s.timerClock]}>
        <View style={[s.minute,line]}/><View style={[s.hour,line]}/>
      </View>
      {name==='sessions'&&<View style={[s.historyArrow,stroke]}/>}
    </>:<Icon name={name} color={color} size={25} style={{width:28,height:28,lineHeight:28,includeFontPadding:false,textAlignVertical:'center'}}/>}
  </View>;
}
const s=StyleSheet.create({frame:{width:28,height:28,alignItems:'center',justifyContent:'center'},calendar:{width:21,height:21,borderWidth:2,borderRadius:4,marginTop:2},calendarRule:{position:'absolute',top:4,left:0,right:0,height:2},binding:{position:'absolute',top:-5,width:2,height:7,borderRadius:1},check:{position:'absolute',top:8,left:6,width:5,height:8,borderRightWidth:2,borderBottomWidth:2,transform:[{rotate:'45deg'}]},pass:{width:25,height:19,borderWidth:2,borderRadius:4},head:{position:'absolute',top:3,left:3,width:5,height:5,borderWidth:1.5,borderRadius:3},shoulders:{position:'absolute',top:9,left:2,width:8,height:4,borderWidth:1.5,borderTopLeftRadius:5,borderTopRightRadius:5},cardLine:{position:'absolute',left:13,width:6,height:2,borderRadius:1},clock:{width:23,height:23,borderWidth:2,borderRadius:12},minute:{position:'absolute',left:9,top:3,width:2,height:8,borderRadius:1},hour:{position:'absolute',left:9,top:9,width:6,height:2,borderRadius:1},historyArrow:{position:'absolute',left:0,top:11,width:7,height:7,borderLeftWidth:2,borderBottomWidth:2,transform:[{rotate:'-20deg'}]},timerClock:{width:21,height:21,marginTop:5},timerTop:{position:'absolute',top:0,left:10,width:8,height:2,borderRadius:1},timerStem:{position:'absolute',top:1,left:13,width:2,height:4}});
