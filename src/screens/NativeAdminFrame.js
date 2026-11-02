import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from './NativeGymTypography';
import NativeAdminScanner from './NativeAdminScanner';
import NativeAdminHeader from './NativeAdminHeader';
import NativeWorkoutTimer from './NativeWorkoutTimer';
import NativeFitnessCalendar from './NativeFitnessCalendar';
import nativeGymTranslations from '../utils/nativeGymTranslations';
import useAdminTimerAccount from '../utils/useAdminTimerAccount';
import { companyLogoImage } from '../utils/nativeCompanyBranding';
import { adminPageLabels } from '../utils/nativeAdminPages';
import { menuCategoryIcon as menuIcon } from '../utils/nativeAdminNavigation';
import companyAppConfig from '../utils/companyAppConfig';
import theme, { brandSoft } from '../utils/gymUiTheme';

function Action({label,onPress,color,disabled,secondary=true}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress}
    style={[s.action,{backgroundColor:secondary?brandSoft(color,.08):color,opacity:disabled ? .45 : 1}]}>
    <Text style={{color:secondary?color:'#fff',fontWeight:'600'}}>{label}</Text></Pressable>;
}
function Field({field,value,onChange,color}) {
  const [options,setOptions]=useState(false);
  const selected=field.options?.find(item=>item.value===value);
  return <View style={s.field}><Text style={s.strong}>{field.label}{field.required?' *':''}</Text>
    {field.type==='checkbox'?<Switch accessibilityLabel={field.label} value={value===true} disabled={field.readOnly} onValueChange={onChange} trackColor={{true:color}}/>:
      field.type==='select'?<Pressable accessibilityRole="button" accessibilityLabel={field.label} disabled={field.readOnly} onPress={()=>setOptions(true)} style={s.input}>
        <Text>{selected?.label||String(value||'—')} ▾</Text></Pressable>:
      <TextInput accessibilityLabel={field.label} value={String(value??'')} editable={!field.readOnly} onChangeText={onChange}
        multiline={field.type==='textarea'} keyboardType={field.type==='email'?'email-address':field.type==='number'?'decimal-pad':field.type==='tel'?'phone-pad':'default'}
        autoCapitalize={field.type==='email'?'none':'sentences'} maxLength={10000} style={[s.input,field.type==='textarea'&&{minHeight:100,textAlignVertical:'top'}]}/>}
    <Modal visible={options} transparent animationType="slide" onRequestClose={()=>setOptions(false)}>
      <View style={s.overlay}><View style={s.sheet}><Pressable accessibilityRole="button" accessibilityLabel={field.label} onPress={()=>setOptions(false)} style={s.sheetHeader}>
        <Text heading style={s.title}>{field.label}</Text><Text>×</Text></Pressable>
        <FlatList data={field.options||[]} keyExtractor={(item,i)=>item.value+':'+i} keyboardShouldPersistTaps="handled"
          renderItem={({item})=><Pressable accessibilityRole="radio" accessibilityState={{selected:item.value===value}}
            onPress={()=>{onChange(item.value);setOptions(false);}} style={s.menuItem}><Text style={{color:item.value===value?color:theme.text}}>{item.label||'—'}</Text></Pressable>}/>
      </View></View>
    </Modal>
  </View>;
}
export function NativeForm({page,pages,color,t}) {
  const [values,setValues]=useState({});
  useEffect(()=>setValues(Object.fromEntries(page.form.fields.map(field=>[field.key||field.id,field.value]))),[page.url]);
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text heading style={s.heading}>{page.title}</Text>
      {page.form.errors.map((error,i)=><Text key={i} accessibilityLiveRegion="polite" style={s.error}>{error}</Text>)}
      <View style={s.card}>{page.form.fields.map(field=><Field key={field.key||field.id} field={field} value={values[field.key||field.id]??field.value} color={color}
        onChange={value=>setValues(previous=>({...previous,[field.key||field.id]:value}))}/>)}</View>
      <Action label={page.form.label||t.save} color={color} secondary={false} disabled={pages.busy}
        onPress={()=>pages.invoke(page.form.id,Object.fromEntries(page.form.fields.map(field=>[field.id,values[field.key||field.id]??field.value])))}/>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function NativePage({pages,admin,color,t}) {
  const page=pages.page, [filters,setFilters]=useState(false), [values,setValues]=useState({}), [query,setQuery]=useState('');
  const list=useRef(null),restored=useRef(false),restoreOffset=useRef(0);
  const insets=useSafeAreaInsets();
  const searchField=(page.filters||[]).find(field=>field.name==='q'||/\[(?:q|full_name)\]$/.test(field.name));
  useEffect(()=>{setQuery(searchField?.value||'');setFilters(false);setValues(Object.fromEntries((page.filters||[]).map(f=>[f.name,f.value])));
    restored.current=false;restoreOffset.current=pages.scrollOffset(page.url);
    list.current?.scrollToOffset({offset:restoreOffset.current,animated:false});},[page.url]);
  if(page.kind==='form')return <NativeForm key={page.url} page={page} pages={pages} color={color} t={t}/>;
  const apply=()=>{
    const target=new URL(page.filterAction||page.url);
    for(const field of page.filters||[])target.searchParams.set(field.name,String(values[field.name]??field.value??''));
    if(searchField)target.searchParams.set(searchField.name,query.trim());
    target.searchParams.delete('page');pages.navigate(target.href);setFilters(false);
  };
  const rows=searchField?(page.rows||[]):(page.rows||[]).filter(row=>[row.title,row.description,...(row.badges||[])].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <FlatList ref={list} testID="native-admin-page" data={rows} keyExtractor={item=>item.id}
    onContentSizeChange={()=>{if(!restored.current){list.current?.scrollToOffset({offset:restoreOffset.current,animated:false});restored.current=true;}}}
    onScroll={event=>{if(restored.current)pages.rememberScroll(page.url,event.nativeEvent.contentOffset.y);}} scrollEventThrottle={100}
    contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={pages.busy} onRefresh={pages.refresh} tintColor={color}/>}
    ListHeaderComponent={<>
      <View style={s.pageHeading}><View style={s.flex}><Text style={s.eyebrow}>{page.kind==='dashboard'?t.overview:t.adminLabel}</Text>
        <Text heading style={s.heading}>{page.title||t.dashboard}</Text></View>
        {page.kind!=='dashboard'&&page.kind!=='web'&&<View style={[s.count,{backgroundColor:brandSoft(color)}]}><Text style={{color,fontWeight:'600'}}>{page.rows?.length||0}</Text></View>}</View>
      {page.notices?.map((notice,i)=><Text key={i} accessibilityLiveRegion="polite" style={s.error}>{notice}</Text>)}
      {!!pages.error&&<View style={s.card}><Text accessibilityLiveRegion="polite" style={s.error}>{t.error}</Text>
        <Action label={t.refresh} color={color} onPress={pages.refresh}/></View>}
      {!!page.summary?.length&&<View style={s.summary}>{page.summary.map((item,i)=><View key={i} style={[s.stat,{backgroundColor:brandSoft(color,.06)}]}>
        <Text heading style={[s.metric,{color}]}>{item.value}</Text><Text style={s.muted}>{item.label}</Text></View>)}</View>}
      {!['dashboard','web'].includes(page.kind)&&<View style={s.searchBar}>
        <TextInput accessibilityLabel={t.search} placeholder={t.search} value={query} onChangeText={setQuery} returnKeyType="search"
          onSubmitEditing={searchField?apply:undefined} style={[s.input,s.flex]}/>
        {!!page.filters?.length&&<Action label={t.filter} color={color} onPress={()=>setFilters(true)}/>}
      </View>}
      <Modal visible={filters} animationType="slide" onRequestClose={()=>setFilters(false)}>
        <View style={[s.flex,{paddingTop:Math.max(16,insets.top),paddingBottom:insets.bottom,backgroundColor:theme.page}]}><View style={s.sheetHeader}><Text heading style={s.title}>{t.filter}</Text>
          <Action label={t.close} color={color} onPress={()=>setFilters(false)}/></View>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {(page.filters||[]).filter(field=>field!==searchField).map(field=><Field key={field.name} field={field} color={color} value={values[field.name]??field.value}
              onChange={value=>setValues(previous=>({...previous,[field.name]:value}))}/>)}
            <Action label={t.apply} color={color} secondary={false} disabled={pages.busy} onPress={apply}/>
          </ScrollView></View>
      </Modal>
      {!!page.actions?.length&&<View style={s.card}>{page.actions.map(action=><View key={action.id} style={s.field}>
        {!!action.description&&<Text style={s.strong}>{action.description}</Text>}<Action label={action.label} color={color} disabled={pages.busy}
          onPress={()=>Alert.alert(action.label,t.confirm,[{text:t.cancel,style:'cancel'},{text:action.label,onPress:()=>pages.invoke(action.id)}])}/></View>)}</View>}
      {!!page.links?.length&&<View style={s.card}>{page.links.map((item,i)=><Action key={item.url+':'+i} label={item.label} color={color} onPress={()=>pages.navigate(item.url)}/>)}</View>}
      {page.kind==='dashboard'&&admin.context&&<View style={s.card}>
        <Text heading style={s.title}>{t.schedule}</Text>
        {admin.context.classes.slice(0,4).map(item=><Pressable key={item.schedule_id} accessibilityRole="button" onPress={()=>admin.loadRoster(Number(item.schedule_id),item.date)} style={s.scheduleRow}>
          <View style={s.flex}><Text style={[s.strong,{color}]}>{item.start_time} – {item.end_time}</Text><Text heading style={s.title}>{item.class_name}</Text>
            <Text style={s.muted}>{[item.coach,item.room].filter(Boolean).join(' · ')}</Text></View><Icon name="bookings" color={color}/></Pressable>)}
        <Action label={t.schedule} color={color} onPress={admin.showClasses}/>
      </View>}
    </>}
    renderItem={({item})=><View style={s.card}><Text heading style={s.title}>{item.title}</Text><Text style={s.muted}>{item.description}</Text>
      <View style={s.badges}>{item.badges.map((badge,i)=><Text key={i} style={[s.badge,{color,backgroundColor:brandSoft(color,.08)}]}>{badge}</Text>)}</View>
      {item.links.map((link,i)=><Action key={link.url+':'+i} label={link.label} color={color} onPress={()=>pages.navigate(link.url)}/>)}
    </View>}
    ListEmptyComponent={['dashboard','web'].includes(page.kind)?null:<Text style={s.empty}>{pages.busy?t.loading:t.empty}</Text>}
    ListFooterComponent={<>
      <View style={s.pagination}>{page.pagination?.map((item,i)=><Action key={i} label={item.label} color={color} disabled={pages.busy} onPress={()=>pages.navigate(item.url)}/>)}</View>
    </>}/>
  ;
}
const tabIcon=url=>url.includes('clients-list')?'profile':url.includes('gym-classes')?'bookings':url.includes('memberships')?'pass':'home';
function MenuRow({label,icon='more',color,onPress,expanded,disabled=false,caption,accessibilityLabel}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel||label}
    accessibilityState={{disabled,...(typeof expanded==='boolean'?{expanded}:{})}} disabled={disabled} onPress={onPress} style={s.menuRow}>
    {!!icon&&<Icon name={icon} color={color} size={24}/>}<View style={s.flex}><Text style={[s.menuLabel,icon==='logout'&&{color}]}>{label}</Text>
      {!!caption&&<Text style={s.muted}>{caption}</Text>}</View>
    {typeof expanded==='boolean'&&<View accessible={false} style={s.menuArrowBox}><View style={[s.menuArrow,{borderColor:color,transform:[{rotate:expanded?'225deg':'45deg'}]}]}/></View>}
  </Pressable>;
}
export function MenuBranch({item,navigate,color,currentUrl,depth=0}) {
  const children=item.children||[];
  const containsCurrent=node=>node.url===currentUrl||(node.children||[]).some(containsCurrent);
  const [expanded,setExpanded]=useState(()=>children.some(containsCurrent));
  return <View style={[s.menuBranch,depth>0&&s.menuChild]}>
    {children.length>0?<>
      <MenuRow label={item.label} icon={depth===0?menuIcon(item):null} color={color} expanded={expanded} onPress={()=>setExpanded(value=>!value)}/>
      {expanded&&<View style={s.menuChildren}>
        {!!item.url&&<MenuRow label={item.label} icon={null} color={color} onPress={()=>navigate(item.url)}/>}
        {children.map((child,i)=><MenuBranch key={child.id+':'+i} item={child} navigate={navigate} color={color} currentUrl={currentUrl} depth={depth+1}/>)}
      </View>}
    </>:item.url?<MenuRow label={item.label} icon={depth===0?menuIcon(item):null} color={color} onPress={()=>navigate(item.url)}/>:<Text heading style={s.menuSection}>{item.label}</Text>}
  </View>;
}
export default function NativeAdminFrame({pages,admin,children,onBack,brandColor}) {
  const {siteUrl,color:defaultColor,pagecode}=companyAppConfig(), insets=useSafeAreaInsets();
  const color=brandColor||defaultColor;
  const t=adminPageLabels(pages.document?.language),[menu,setMenu]=useState(null),[scan,setScan]=useState(false);
  const [copied,setCopied]=useState(false);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const timerAccountKey=useAdminTimerAccount(pages,siteUrl),timer=pages.localScreen==='timer';
  useEffect(()=>setCalendarOpen(false),[timerAccountKey]);
  const logout=pages.document?.accountActions?.find(action=>action.kind==='logout');
  useEffect(()=>{setMenu(null);setScan(false);},[pages.document?.page?.url]);
  const active=!!pages.document&&!!pages.page;
  const preparing=!active&&['loading','failed'].includes(pages.startup);
  const native=active&&!pages.web&&(timer||pages.page.kind!=='web')&&(timer||admin.screen!=='classes');
  const navigate=url=>{
    setMenu(null);
    const home=/^\/dashboard-gym(?:\/index)?\/?$/.test(new URL(url).pathname);
    if(home){
      // The schedule bridge belongs to the real dashboard document. Load it
      // when returning from another document; reuse it for native tab switches.
      if(!admin.onDashboard||!admin.context){pages.openWeb(url);return;}
      admin.showClasses();pages.navigate(url);return;
    }
    admin.showDashboard();pages.navigate(url);
  };
  const pressAction=action=>{setMenu(null);Alert.alert(action.label,t.confirm,[{text:t.cancel,style:'cancel'},{text:action.label,onPress:()=>pages.invoke(action.id)}]);};
  return <View style={[s.flex,{backgroundColor:'#f5f7fa'}]}>
    {preparing&&<View testID="native-admin-startup" style={s.startup}>
      <Image source={companyLogoImage()} resizeMode="contain" style={s.startupLogo}/><Text heading style={s.heading}>{t.adminLabel}</Text>
      <Text style={s.muted}>{pages.startup==='loading'?t.loadingApp:t.setupError}</Text>
      {pages.startup==='failed'&&!!pages.diagnostic&&<Text selectable style={s.muted}>{t.reference}: {pages.diagnostic}</Text>}
      {pages.startup==='loading'?<ActivityIndicator color={color}/>:<>
        <Action label={t.retry} color={color} onPress={pages.retry}/>
        <Action label={t.signIn} color={color} onPress={()=>pages.openWeb(new URL('/login',siteUrl).href)}/>
      </>}
    </View>}
    {active&&<NativeAdminHeader pages={pages} t={t} color={color} onMenu={()=>setMenu('menu')} onBack={()=>{if(timer)pages.back();else onBack();}}
      backVisible={timer||admin.screen==='classes'||(!['dashboard','clients','catalog','memberships'].includes(pages.page.kind)&&!/^\/(?:company|preferences)(?:\/index)?\/?$/.test(new URL(pages.page.url).pathname))}
      onHome={()=>{const home=pages.document.footer.find(item=>new URL(item.url).pathname.startsWith('/dashboard-gym'));if(home)navigate(home.url);}}/>}
    <View style={native||preparing?s.hidden:s.flex} pointerEvents={native||preparing?'none':'auto'} accessibilityElementsHidden={native||preparing}
      aria-hidden={native||preparing}
      importantForAccessibility={native||preparing?'no-hide-descendants':'auto'}>{children}</View>
    {native&&(timer?<ScrollView contentContainerStyle={s.timerContent} keyboardShouldPersistTaps="handled">
      <View style={s.timerColumn}>{timerAccountKey?<NativeWorkoutTimer key={timerAccountKey} accountKey={timerAccountKey} t={nativeGymTranslations(pages.document.language)} color={color}/>:<ActivityIndicator color={color}/>}</View>
    </ScrollView>:<NativePage pages={pages} admin={admin} color={color} t={t}/>)}
    {/* AppContent already reserves Android's system navigation inset. */}
    {active&&<View testID="native-admin-footer" style={[s.footer,{paddingBottom:Platform.OS==='android'?10:Math.max(10,insets.bottom)}]}>
      <View pointerEvents="none" style={s.footerBackground}/>
      {pages.document.footer.map((item,i)=>{const selected=!timer&&new URL(item.url).pathname===new URL(pages.page.url).pathname;return <React.Fragment key={item.url}>
        {i===2&&(pages.document.create?.length>0||pages.document.scanner)&&<Pressable accessibilityRole="button" accessibilityLabel={t.create} onPress={()=>setMenu('create')} style={[s.fab,{backgroundColor:color}]}>
          <View accessible={false} pointerEvents="none" style={s.plusGlyph}><View style={s.plusHorizontal}/><View style={s.plusVertical}/></View>
        </Pressable>}
        <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}}
          onPress={()=>navigate(item.url)} style={[s.tab,selected&&{backgroundColor:brandSoft(color,.09)}]}><Icon name={tabIcon(item.url)} color={selected?color:theme.muted}/>
          <Text numberOfLines={1} style={[s.tabLabel,{color:selected?color:theme.muted}]}>{item.label}</Text></Pressable>
      </React.Fragment>;})}
      {pages.document.footer.length<3&&<Pressable accessibilityRole="button" accessibilityLabel={t.more} onPress={()=>setMenu('menu')} style={s.tab}><Icon name="settings" color={color}/><Text style={s.tabLabel}>{t.more}</Text></Pressable>}
    </View>}
    <Modal visible={!!menu&&active} transparent animationType="slide" onRequestClose={()=>setMenu(null)}>
      <View style={[s.overlay,menu==='menu'&&s.menuOverlay]}><View style={[s.sheet,menu==='menu'&&s.menuPanel,{paddingBottom:Math.max(16,insets.bottom)}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={()=>setMenu(null)} style={s.sheetHeader}><Text heading style={s.title}>{menu==='create'?t.create:t.menu}</Text><Text style={{fontSize:26}}>×</Text></Pressable>
        <ScrollView testID="native-admin-menu-scroll" style={menu==='menu'?s.menuScroll:undefined} contentContainerStyle={menu==='menu'?s.menuContent:s.content}
          keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {menu==='menu'&&<MenuRow label={t.company+': '+(pages.document.header?.company||pagecode)} icon="company" color={color}
            caption={copied?t.copied:pagecode} accessibilityLabel={t.copy}
            onPress={()=>Clipboard.setStringAsync(pagecode).then(()=>setCopied(true)).catch(()=>Alert.alert(t.copy,t.error))}/>}
          {pages.document?.scanner&&(menu==='menu'?<MenuRow label={t.scan} icon="pass" color={color} onPress={()=>{setMenu(null);setScan(true);}}/>:
            <Action label={t.scan} color={color} onPress={()=>{setMenu(null);setScan(true);}}/>)}
          {menu==='menu'&&pages.document?.menuTree?.length>0?
            pages.document.menuTree.map((item,i)=><MenuBranch key={item.id+':'+i} item={item} navigate={navigate} color={color} currentUrl={pages.page.url}/>):
            (menu==='create'?pages.document?.create:pages.document?.menu)?.map((item,i)=>menu==='menu'?<MenuRow key={item.url+':'+i} label={item.label} icon={menuIcon(item)} color={color} onPress={()=>navigate(item.url)}/>:
              <Action key={item.url+':'+i} label={item.label} color={color} onPress={()=>navigate(item.url)}/>)}
          {menu!=='create'&&pages.document?.accountActions?.filter(action=>action.kind!=='logout').map(action=><MenuRow key={action.id} label={action.label} color={color} onPress={()=>pressAction(action)}/>)}
          {menu==='menu'&&<MenuRow label={pages.document.language==='pt'?'O meu calendário':'My calendar'} icon="bookings" color={color} onPress={()=>{setMenu(null);setCalendarOpen(true);}}/>}
          <MenuRow label={t.refresh} icon="refresh" color={color} onPress={()=>{setMenu(null);pages.refresh();}}/>
        </ScrollView>
        {menu==='menu'&&<View style={s.menuBottom}>
          {logout&&<View testID="native-admin-menu-logout"><MenuRow label={t.logout} icon="logout" color={theme.danger} disabled={pages.busy} onPress={()=>pressAction({...logout,label:t.logout})}/></View>}
          <View style={s.menuClose}><Action label={t.close} color={color} onPress={()=>setMenu(null)}/></View>
        </View>}
      </View></View>
    </Modal>
    {active&&timerAccountKey&&<NativeFitnessCalendar key={timerAccountKey} accountKey={timerAccountKey} language={pages.document.language} color={color} visible={calendarOpen} onClose={()=>setCalendarOpen(false)}/>}
    {active&&<NativeAdminScanner visible={scan} config={pages.document.scanner} base={siteUrl} t={t} color={color} onClose={()=>setScan(false)} onOpen={url=>{admin.showDashboard();pages.openWeb(url);}}/>}
    {active&&pages.busy&&<View pointerEvents="none" style={s.progress}><ActivityIndicator color={color}/></View>}
  </View>;
}
const s=StyleSheet.create({flex:{flex:1},hidden:{position:'absolute',left:-10000,width:'100%',height:'100%',opacity:0},
  startup:{flex:1,alignItems:'center',justifyContent:'center',padding:32,gap:18,backgroundColor:'#f5f7fa'},startupLogo:{width:72,height:72,borderRadius:36},
  pageHeading:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10},eyebrow:{fontSize:11,color:theme.muted,marginBottom:4},count:{minWidth:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},searchBar:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:16},
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8,paddingVertical:8,borderBottomWidth:1,borderColor:theme.border,backgroundColor:'#fff'},
  logo:{width:36,height:36,borderRadius:8},iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  title:{fontSize:18,color:theme.text},heading:{fontSize:25,color:theme.text,marginBottom:8},content:{padding:16,gap:14,paddingBottom:28},
  card:{backgroundColor:'#fff',borderRadius:20,padding:16,borderWidth:1,borderColor:theme.border,gap:12,marginBottom:12},
  action:{minHeight:44,borderRadius:14,padding:12,alignItems:'center',justifyContent:'center'},input:{minHeight:48,borderWidth:1,borderColor:theme.border,borderRadius:12,padding:12,color:theme.text,fontSize:16,justifyContent:'center'},
  field:{gap:8},strong:{fontWeight:'600',color:theme.text},muted:{color:theme.muted,fontSize:13,lineHeight:21},summary:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:14},
  stat:{minWidth:'45%',flexGrow:1,padding:16,borderRadius:18,gap:6},metric:{fontSize:28},badges:{flexDirection:'row',flexWrap:'wrap',gap:8},badge:{paddingHorizontal:10,paddingVertical:5,borderRadius:12,fontSize:11},
  scheduleRow:{flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:theme.border,paddingVertical:12},
  footer:{flexDirection:'row',alignItems:'center',paddingTop:38,marginTop:-28,paddingHorizontal:4,gap:2},
  footerBackground:{position:'absolute',top:28,left:0,right:0,bottom:0,backgroundColor:'#fff',borderTopWidth:1,borderColor:theme.border},
  tab:{flex:1,alignItems:'center',justifyContent:'center',minHeight:72,paddingVertical:10,gap:4,borderRadius:16},tabLabel:{fontSize:10,color:theme.muted},fab:{height:48,width:48,borderRadius:24,alignItems:'center',justifyContent:'center',marginHorizontal:3,transform:[{translateY:-28}]},
  plusGlyph:{width:20,height:20},plusHorizontal:{position:'absolute',left:1,top:8.5,width:18,height:3,borderRadius:1.5,backgroundColor:'#fff'},plusVertical:{position:'absolute',left:8.5,top:1,width:3,height:18,borderRadius:1.5,backgroundColor:'#fff'},
  overlay:{flex:1,backgroundColor:'#0005',justifyContent:'flex-end'},sheet:{maxHeight:'85%',backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:24},
  timerContent:{padding:16,gap:16,alignItems:'center'},timerColumn:{width:'100%',maxWidth:760},menuOverlay:{justifyContent:'center',alignItems:'center',padding:16},menuPanel:{width:'100%',height:'85%',maxWidth:560,borderRadius:22,overflow:'hidden'},menuScroll:{flex:1,minHeight:0},menuContent:{paddingHorizontal:20,paddingBottom:12},menuBottom:{paddingHorizontal:20,flexShrink:0},menuClose:{paddingTop:12},
  menuBranch:{},menuChild:{paddingLeft:40},menuChildren:{},menuSection:{fontSize:13,color:theme.muted,paddingTop:18,paddingBottom:8},
  menuRow:{minHeight:64,flexDirection:'row',alignItems:'center',gap:14,paddingVertical:14,borderBottomWidth:1,borderColor:theme.border},menuLabel:{fontSize:15,fontWeight:'600',color:theme.text},menuArrowBox:{width:24,height:24,alignItems:'center',justifyContent:'center'},menuArrow:{width:8,height:8,borderRightWidth:2,borderBottomWidth:2},
  sheetHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20,borderBottomWidth:1,borderColor:theme.border,minHeight:60},menuItem:{padding:18,minHeight:48,borderBottomWidth:1,borderColor:theme.border},
  error:{color:theme.warning,padding:8},empty:{padding:24,textAlign:'center',color:theme.muted},pagination:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},progress:{position:'absolute',top:70,right:20},
});
