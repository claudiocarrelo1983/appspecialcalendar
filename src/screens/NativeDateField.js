import React,{useState} from 'react';
import {Keyboard,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text,Icon} from './NativeGymTypography';
import theme from '../utils/gymUiTheme';
import {isoDate,parseDate,calendarDays,dateAllowed} from '../utils/authDate';

export default function NativeDateField({value,onChange,label,language='en',color,disabled=false,min,max}){
  const [open,setOpen]=useState(false),[cursor,setCursor]=useState({year:2000,month:0}),[panel,setPanel]=useState('days'),[yearStart,setYearStart]=useState(2000);
  const pt=language==='pt',insets=useSafeAreaInsets(),selected=parseDate(value);
  const months=Array.from({length:12},(_,month)=>new Intl.DateTimeFormat(pt?'pt-PT':'en-GB',{month:'long'}).format(new Date(2000,month,1,12)));
  const show=()=>{Keyboard.dismiss();const now=new Date(),date=selected||{year:now.getFullYear(),month:now.getMonth()};setCursor(date);setYearStart(Math.min(9976,Math.max(1,date.year-11)));setPanel('days');setOpen(true);};
  const shift=amount=>{const date=new Date(2000,cursor.month,1,12);date.setFullYear(cursor.year);date.setMonth(date.getMonth()+amount);if(date.getFullYear()>0&&date.getFullYear()<10000)setCursor({year:date.getFullYear(),month:date.getMonth()});};
  const choose=day=>{const date=isoDate(cursor.year,cursor.month,day);if(dateAllowed(date,min,max)){onChange(date);setOpen(false);}};
  const display=selected?String(selected.day).padStart(2,'0')+'/'+String(selected.month+1).padStart(2,'0')+'/'+selected.year:(pt?'Selecionar data':'Select date');
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label+': '+display} accessibilityState={{disabled}} disabled={disabled} onPress={show} style={s.input}>
      <Text style={{flex:1,color:selected?theme.text:theme.muted,fontSize:16}}>{display}</Text><Icon name="bookings" color={color} size={21}/>
    </Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={s.overlay}><View style={[s.sheet,{paddingBottom:Math.max(20,insets.bottom)}]}>
        <View style={s.row}><Text heading style={s.title}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={pt?'Fechar':'Close'} onPress={()=>setOpen(false)} style={s.button}><Text style={{fontSize:26}}>×</Text></Pressable></View>
        <ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:12}} keyboardShouldPersistTaps="handled">
        <View style={s.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={panel==='years'?(pt?'Anos anteriores':'Previous years'):(pt?'Mês anterior':'Previous month')} onPress={()=>panel==='years'?setYearStart(Math.max(1,yearStart-24)):shift(-1)} style={s.button}><Text style={{fontSize:26,color}}>‹</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={pt?'Escolher mês':'Choose month'} onPress={()=>setPanel(panel==='months'?'days':'months')} style={s.button}><Text style={{color,fontWeight:'600'}}>{months[cursor.month]}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={pt?'Escolher ano':'Choose year'} onPress={()=>{setYearStart(Math.min(9976,Math.max(1,cursor.year-11)));setPanel(panel==='years'?'days':'years');}} style={s.button}><Text style={{color,fontWeight:'600'}}>{cursor.year}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={panel==='years'?(pt?'Anos seguintes':'Next years'):(pt?'Mês seguinte':'Next month')} onPress={()=>panel==='years'?setYearStart(Math.min(9976,yearStart+24)):shift(1)} style={s.button}><Text style={{fontSize:26,color}}>›</Text></Pressable>
        </View>
        {panel==='months'?<View style={s.grid}>{months.map((month,index)=><Pressable key={index} accessibilityRole="button" onPress={()=>{setCursor({...cursor,month:index});setPanel('days');}} style={s.choice}><Text style={{color,textAlign:'center'}}>{month}</Text></Pressable>)}</View>:
          panel==='years'?<View style={s.grid}>{Array.from({length:24},(_,index)=>yearStart+index).map(year=><Pressable key={year} accessibilityRole="button" onPress={()=>{setCursor({...cursor,year});setPanel('days');}} style={s.choice}><Text style={{color}}>{year}</Text></Pressable>)}</View>:<>
            <View style={s.grid}>{(pt?['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map((day,index)=><View key={index} style={s.cell}><Text style={{color:theme.muted,fontSize:12}}>{day}</Text></View>)}</View>
            <View style={s.grid}>{calendarDays(cursor.year,cursor.month).map((day,index)=>{const date=day?isoDate(cursor.year,cursor.month,day):'',allowed=day&&dateAllowed(date,min,max),active=date===value;return <View key={index} style={s.cell}>{day&&<Pressable accessibilityRole="button" accessibilityLabel={date} accessibilityState={{selected:active,disabled:!allowed}} disabled={!allowed} onPress={()=>choose(day)} style={[s.day,active&&{backgroundColor:color}]}><Text style={{color:active?'#fff':allowed?theme.text:theme.muted,opacity:allowed?1:.35}}>{day}</Text></Pressable>}</View>;})}</View>
          </>}
        {!!value&&<Pressable accessibilityRole="button" onPress={()=>{onChange('');setOpen(false);}} style={s.button}><Text style={{color}}>{pt?'Limpar data':'Clear date'}</Text></Pressable>}
        </ScrollView>
      </View></View>
    </Modal>
  </>;
}
const s=StyleSheet.create({input:{minHeight:52,flexDirection:'row',alignItems:'center',borderRadius:14,borderWidth:1,borderColor:theme.border,paddingHorizontal:14,backgroundColor:'#fff'},overlay:{flex:1,backgroundColor:'#0005',justifyContent:'flex-end'},sheet:{maxHeight:'90%',backgroundColor:'#fff',padding:20,borderTopLeftRadius:24,borderTopRightRadius:24,gap:12},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},title:{flex:1,fontSize:20,color:theme.text},button:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:6},grid:{flexDirection:'row',flexWrap:'wrap'},cell:{width:'14.285714%',height:44,alignItems:'center',justifyContent:'center'},day:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},choice:{width:'25%',minHeight:44,alignItems:'center',justifyContent:'center',padding:4}});
