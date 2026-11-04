import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {Text} from './NativeGymTypography';
import {subcategoryTabsForPage} from '../utils/subcategoryTabs';
import theme,{brandSoft} from '../utils/gymUiTheme';

export default function NativeSubcategoryTabs({tree,url,language,color,onNavigate}){
 const tabs=subcategoryTabsForPage(tree,url),scroll=useRef(null),sizes=useRef({width:0,content:0,x:0}),positions=useRef({}),revealed=useRef(null);
 const [edges,setEdges]=useState({left:false,right:false});
 const update=()=>{const m=sizes.current,left=m.x>1,right=m.content>m.width+m.x+1;setEdges(previous=>previous.left===left&&previous.right===right?previous:{left,right});};
 const reveal=()=>{const active=tabs.find(t=>t.active),x=positions.current[active?.url];if(revealed.current!==url&&x!==undefined&&sizes.current.width>0&&sizes.current.content>0){revealed.current=url;scroll.current?.scrollTo({x:Math.max(0,x-12),animated:false});}update();};
 useEffect(()=>{revealed.current=null;reveal();},[url]);
 if(!tabs.length)return null;
 const pt=language==='pt';
 const arrow=direction=><Pressable accessibilityRole="button" accessibilityLabel={pt?(direction<0?'Deslocar para a esquerda':'Deslocar para a direita'):(direction<0?'Scroll left':'Scroll right')}
   onPress={()=>scroll.current?.scrollTo({x:Math.max(0,sizes.current.x+direction*sizes.current.width*.75),animated:true})} style={[s.arrow,{backgroundColor:brandSoft(color,.08)}]}><Text style={{fontSize:23,lineHeight:28,color}}>{direction<0?'‹':'›'}</Text></Pressable>;
 return <View testID="native-subcategory-tabs" style={s.row}>
   {edges.left&&arrow(-1)}
   <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator onLayout={e=>{sizes.current.width=e.nativeEvent.layout.width;reveal();}}
     onContentSizeChange={width=>{sizes.current.content=width;reveal();}} onScroll={e=>{sizes.current.x=e.nativeEvent.contentOffset.x;update();}} scrollEventThrottle={32} contentContainerStyle={s.content} style={s.scroll}>
     {tabs.map(tab=><Pressable key={tab.url} accessibilityRole="tab" accessibilityState={{selected:tab.active}} aria-selected={tab.active} onPress={()=>onNavigate(tab.url)}
       onLayout={e=>{positions.current[tab.url]=e.nativeEvent.layout.x;if(tab.active)reveal();}} style={[s.pill,{backgroundColor:tab.active?color:'#f1f5f9',borderColor:tab.active?color:theme.border}]}>
       <Text numberOfLines={1} style={[s.label,{color:tab.active?'#fff':theme.text}]}>{tab.label}</Text></Pressable>)}
   </ScrollView>
   {edges.right&&arrow(1)}
 </View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingTop:8,paddingBottom:8,backgroundColor:'#fff'},scroll:{flex:1,minWidth:0},content:{gap:8,paddingVertical:2},pill:{alignSelf:'flex-start',flexShrink:0,borderWidth:1,borderRadius:20,paddingHorizontal:14,paddingVertical:9},label:{fontSize:13,lineHeight:20,fontWeight:'600'},arrow:{width:28,height:34,alignItems:'center',justifyContent:'center',borderRadius:12}});
