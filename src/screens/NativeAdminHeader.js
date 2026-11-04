import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from './NativeGymTypography';
import NativeCompanyLogo from './NativeCompanyLogo';
import { userLevelLabel } from '../utils/nativeAdminNavigation';
import theme, { brandSoft } from '../utils/gymUiTheme';

function HeaderButton({label,onPress,children,count=0,disabled=false,style}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}}
    disabled={disabled} onPress={onPress} style={[s.button,style,disabled&&{opacity:.45}]}>
    {children}{count>0&&<View style={s.badge}><Text style={s.badgeText}>{count>99?'99+':count}</Text></View>}
  </Pressable>;
}
export function ShareIcon({color=theme.muted}) {
  return <View accessible={false} style={s.shareIcon}>
    <View style={[s.shareLine,{backgroundColor:color,top:5,transform:[{rotate:'-30deg'}]}]}/><View style={[s.shareLine,{backgroundColor:color,top:12,transform:[{rotate:'30deg'}]}]}/>
    {[{left:0,top:6.5},{right:0,top:0},{right:0,bottom:0}].map((position,i)=><View key={i} style={[s.shareDot,{borderColor:color},position]}/>)}
  </View>;
}
export function NotificationIcon({task,color}) {
  if (!task) return <Icon name="bell" color={color}/>;
  return <View accessible={false} style={{width:20,height:24,borderWidth:2,borderColor:color,borderRadius:3,alignItems:'center',justifyContent:'center',gap:3}}>
    <View style={{position:'absolute',top:-4,width:10,height:6,borderWidth:2,borderColor:color,borderRadius:2,backgroundColor:'#fffbeb'}}/>
    {[0,1,2].map(line=><View key={line} style={{width:10,height:2,backgroundColor:color,borderRadius:1}}/>)}</View>;
}
export default function NativeAdminHeader({pages,t,color,onMenu,onHome,onBack,backVisible=false}) {
  const [panel,setPanel]=useState(null),header=pages.document.header||{},insets=useSafeAreaInsets();
  useEffect(()=>setPanel(null),[pages.document.page.url]);
  const title=panel==='language'?t.language:panel==='notifications'?t.notifications:t.birthdays;
  const language=header.language?.value?.split('-')[0]?.toUpperCase()||pages.document.language?.toUpperCase();
  const open=url=>{setPanel(null);if(url)pages.navigate(url);};
  // No public store listing is configured yet. Never share a website as the app.
  const storeUrl=null;
  const share=()=>{if(storeUrl)Share.share({message:storeUrl}).catch(()=>Alert.alert(t.share,t.error));};
  return <>
    <View testID="native-admin-header" style={s.appBar}>
    <View style={s.header}>
      {backVisible&&<HeaderButton label={t.back} onPress={onBack}><Icon name="back" color={theme.muted}/></HeaderButton>}
      <Pressable accessibilityRole="button" accessibilityLabel={t.dashboard} onPress={onHome} style={s.logoButton}>
        <NativeCompanyLogo url={header.logoUrl} label={header.company||t.dashboard}/></Pressable>
      <View style={s.identity}><Text heading numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.brand}>{header.company||t.dashboard}</Text>
        <Text numberOfLines={1} accessibilityLabel={[header.user?.name,header.user?.level].filter(Boolean).join(' · ')||t.adminLabel} style={s.role}>
          {[header.user?.name,userLevelLabel(header.user?.level)].filter(Boolean).join(' · ')||t.adminLabel}</Text></View>
      {header.notifications&&<HeaderButton label={t.notifications} count={header.notifications.count} onPress={()=>setPanel('notifications')}>
        <Icon name="bell" color={theme.muted}/></HeaderButton>}
      <HeaderButton label={t.menu} onPress={onMenu}><Text style={s.menuIcon}>☰</Text></HeaderButton>
    </View>
    <View style={s.shortcuts}>
      {header.language&&<HeaderButton style={s.shortcut} label={t.language} onPress={()=>setPanel('language')} disabled={pages.busy}>
        <Text style={s.shortcutText}>{language}</Text><View accessible={false} style={s.chevronBox}><View style={s.chevron}/></View></HeaderButton>}
      {storeUrl&&<HeaderButton style={s.shortcut} label={t.share} onPress={share}><ShareIcon/><Text numberOfLines={1} style={s.shortcutText}>{t.shareShort}</Text></HeaderButton>}
      {header.birthdays&&<HeaderButton style={s.shortcut} label={t.birthdays} count={header.birthdays.rows.filter(row=>row.today===true).length} onPress={()=>setPanel('birthdays')}>
        <Icon name="gift" size={19} color={theme.muted}/><Text numberOfLines={1} style={s.shortcutText}>{t.birthdays}</Text></HeaderButton>}
    </View>
    </View>
    <Modal visible={!!panel} transparent animationType="slide" onRequestClose={()=>setPanel(null)}>
      <View style={s.overlay}><View style={[s.sheet,{paddingBottom:Math.max(16,insets.bottom)}]}>
        <View style={s.sheetHeader}><Text heading style={s.title}>{title}</Text><HeaderButton label={t.close} onPress={()=>setPanel(null)}><Text style={s.menuIcon}>×</Text></HeaderButton></View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {!!pages.error&&<Text accessibilityLiveRegion="polite" style={s.error}>{t.error}</Text>}
          {panel==='language'&&header.language?.options.map(option=><Pressable key={option.value} accessibilityRole="radio"
            accessibilityState={{selected:header.language.value===option.value,disabled:pages.busy}} disabled={pages.busy}
            style={[s.languageOption,{backgroundColor:option.value===header.language.value?brandSoft(color):'#fff'}]}
            onPress={()=>{setPanel(null);pages.change(header.language.id,option.value);}}>
            <Text style={{color:option.value===header.language.value?color:theme.text}}>{option.label}</Text>
            {option.value===header.language.value&&<Icon name="check" color={color}/>}</Pressable>)}
          {panel==='notifications'&&<>
            {!header.notifications?.rows.length&&<Text style={s.empty}>{t.emptyNotifications}</Text>}
            {header.notifications?.rows.map(row=>{const task=row.type==='task',accent=task?'#b45309':color;return <View key={row.id} style={[s.notice,{backgroundColor:row.read?'#fff':brandSoft(accent,.05)},task&&{borderColor:brandSoft(accent,.25)}]}>
              <View style={[s.iconPlate,{backgroundColor:brandSoft(accent)}]}><NotificationIcon task={task} color={accent}/></View>
              <Pressable accessibilityRole={row.url?'button':undefined} disabled={!row.url} style={{flex:1,gap:6}} onPress={()=>open(row.url)}>
                <Text heading style={s.noticeTitle}>{row.title}</Text><Text style={s.body}>{row.body}</Text><Text style={s.meta}>{row.meta}</Text></Pressable>
              {row.control&&<Switch accessibilityLabel={(task?(pages.document.language==='pt'?(row.read?'Reabrir tarefa':'Concluir tarefa'):(row.read?'Reopen task':'Complete task')):(row.read?t.markUnread:t.markRead))+': '+row.title} value={row.read}
                disabled={pages.busy||row.disabled} trackColor={{true:accent}} onValueChange={value=>pages.change(row.control,value)}/>}
            </View>;})}
          </>}
          {panel==='birthdays'&&<>
            {header.birthdays?.rows.some(row=>row.today&&row.isSelf)&&<View style={[s.notice,{backgroundColor:brandSoft(color)}]}>
              <Icon name="gift" color={color}/><View style={{flex:1,gap:6}}><Text heading style={s.noticeTitle}>{t.happyBirthday}</Text><Text style={s.body}>{t.happyBirthdayBody}</Text></View>
            </View>}
            {!header.birthdays?.rows.length&&<Text style={s.empty}>{t.emptyBirthdays}</Text>}
            {header.birthdays?.rows.map(row=><Pressable key={row.id} accessibilityRole={row.url?'button':undefined} disabled={!row.url}
              onPress={()=>open(row.url)} style={s.notice}><View style={[s.iconPlate,{backgroundColor:brandSoft(color)}]}><Icon name="gift" color={color}/></View>
              <View style={{flex:1,gap:6}}><Text heading style={s.noticeTitle}>{row.title}</Text><Text style={s.body}>{row.body}</Text></View>
            </Pressable>)}
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  </>;
}
const s=StyleSheet.create({appBar:{backgroundColor:'#fff',borderBottomWidth:1,borderColor:theme.border},header:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingTop:12,paddingBottom:10,backgroundColor:'#fff'},
  identity:{flex:1,minWidth:0,gap:2},brand:{fontSize:18,color:theme.text},role:{fontSize:11,color:theme.muted},shortcuts:{flexDirection:'row',gap:8,paddingHorizontal:16,paddingBottom:12},shortcut:{flex:1,flexDirection:'row',gap:6,minHeight:38,borderRadius:12,backgroundColor:theme.surfaceSoft,paddingHorizontal:8},shortcutText:{fontSize:12,color:theme.text},
  logoButton:{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center'},logo:{width:44,height:44},button:{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center'},
  language:{fontSize:16,color:theme.text},menuIcon:{fontSize:26,color:theme.muted},badge:{position:'absolute',top:-2,right:2,borderRadius:99,minWidth:19,minHeight:19,paddingHorizontal:4,backgroundColor:theme.danger,alignItems:'center',justifyContent:'center'},badgeText:{fontSize:11,color:'#fff'},
  overlay:{flex:1,backgroundColor:'#0005',justifyContent:'flex-end'},sheet:{maxHeight:'85%',backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24},sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16,borderBottomWidth:1,borderColor:theme.border},
  title:{fontSize:22,color:theme.text},content:{padding:16,gap:12},languageOption:{minHeight:48,padding:14,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  notice:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:16,borderRadius:18,borderWidth:1,borderColor:theme.border},iconPlate:{padding:10,borderRadius:14},noticeTitle:{fontSize:17,color:theme.text},body:{fontSize:14,color:theme.muted,lineHeight:22},meta:{fontSize:11,color:theme.muted,lineHeight:18},empty:{padding:24,color:theme.muted,textAlign:'center'},error:{padding:12,color:theme.warning},
  shareIcon:{width:19,height:19,transform:[{scale:.8}]},shareLine:{position:'absolute',left:3,height:1.5,width:13,backgroundColor:theme.muted},shareDot:{position:'absolute',width:6,height:6,borderRadius:3,borderWidth:1.5,borderColor:theme.muted,backgroundColor:theme.surfaceSoft},
  chevronBox:{width:19,height:19,alignItems:'center',justifyContent:'center'},chevron:{width:9,height:9,borderRightWidth:2,borderBottomWidth:2,borderColor:theme.muted,transform:[{translateY:-2},{rotate:'45deg'}]},
});
