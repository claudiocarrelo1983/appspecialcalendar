import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography';
import React,{useEffect,useRef,useState} from 'react';
import {KeyboardAvoidingView,Linking,Modal,Platform,Pressable,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text,Icon} from './NativeGymTypography';
import NativeCompanyLogo from './NativeCompanyLogo';
import theme,{brandSoft} from '../utils/gymUiTheme';
import {authPageKind} from '../utils/nativeAuthCore';
import {loginPlaceholder,adoptLoginDraft} from '../utils/nativeLoginDraft';
import Constants from 'expo-constants';
import {authLegalLinks} from '../utils/authLegalLinks';
import {authText,deviceAuthLanguage} from '../utils/nativeAuthTranslations';
import NativeDateField from './NativeDateField';
export default function NativeAuthScreen({auth,base,color}){
  const language=auth.language||auth.document?.language||deviceAuthLanguage(),pt=language==='pt',insets=useSafeAreaInsets();
  const raw=auth.document||(auth.kind==='login'?loginPlaceholder(language):null);
  const doc=raw?{...raw,submitLabel:authText(raw.submitLabel,language),links:raw.links.map(link=>({...link,label:authText(link.label,language)})),
    fields:raw.fields.map(field=>({...field,label:authText(field.label,language),placeholder:authText(field.placeholder,language),
      options:field.options?.map(option=>option.value?option:{...option,label:authText(option.label,language)})}))}:null;
  const previousDraft=useRef(false);
  const [values,setValues]=useState({}),[shown,setShown]=useState({}),[picker,setPicker]=useState(null),[search,setSearch]=useState('');
  const [languageOpen,setLanguageOpen]=useState(false);
  useEffect(()=>{const adopt=previousDraft.current&&!doc?.placeholder&&auth.kind==='login';
    setValues(old=>adopt?adoptLoginDraft(doc?.fields||[],old):Object.fromEntries((doc?.fields||[]).map(field=>[field.id,field.value])));
    previousDraft.current=!!doc?.placeholder;setShown({});setPicker(null);setLanguageOpen(false);},[doc?.revision,auth.kind]);
  const titles=pt?{login:'Iniciar sessão',register:'Criar conta',forgot:'Recuperar palavra-passe',reset:'Nova palavra-passe'}:{login:'Sign in',register:'Create account',forgot:'Forgot password',reset:'New password'};
  const title=titles[auth.kind],label=(en,ptText)=>pt?ptText:en;
  const update=(field,value)=>setValues(old=>({...old,[field.id]:value}));
  const selection=doc?.fields.find(field=>field.id===picker);
  const submit=()=>{auth.submit(values);setValues(old=>{const next={...old};for(const field of doc.fields)if(field.type==='password')next[field.id]='';return next;});};
  const fieldInput=field=>{
    const value=values[field.id]??field.value,disabled=(!doc.placeholder&&auth.busy)||field.readonly;
    if(field.type==='date')return <NativeDateField value={value} onChange={value=>update(field,value)} label={field.label} language={language} color={color} disabled={disabled} min={field.min} max={field.max}/>;
    if(field.type==='checkbox'||field.type==='radio')return <Pressable accessibilityRole={field.type} accessibilityLabel={field.label} accessibilityState={{checked:!!value,disabled}} disabled={disabled} onPress={()=>update(field,!value)} style={s.checkRow}><View style={[s.check,value&&{backgroundColor:color,borderColor:color}]}>{!!value&&<Icon name="check" color="#fff" size={17}/>}</View><Text style={[s.label,{flex:1}]}>{field.label}</Text></Pressable>;
    if(field.type==='select')return <Pressable accessibilityRole="button" accessibilityLabel={field.label} disabled={disabled} onPress={()=>{setSearch('');setPicker(field.id);}} style={s.input}><Text style={{flex:1,color:theme.text}}>{field.options.find(option=>option.value===value)?.label||field.placeholder||label('Select','Selecionar')}</Text><View style={s.chevron}/></Pressable>;
    const password=field.type==='password',username=field.autocomplete==='username'||/username|user name|utilizador/i.test(field.label),email=!username&&(field.type==='email'||/email/i.test(field.id+' '+field.autocomplete+' '+field.label)),phone=field.type==='tel'||/phone|telefone|contacto|contact number/i.test(field.label);
    return <View style={s.input}><TextInput accessibilityLabel={field.label} accessibilityState={{disabled}} editable={!disabled} value={String(value||'')} onChangeText={value=>update(field,value)}
      placeholder={field.placeholder} placeholderTextColor={theme.muted} secureTextEntry={password&&!shown[field.id]} maxLength={field.maxLength}
      autoCapitalize={password||email||/username|user name|utilizador/i.test(field.label)?'none':'sentences'} autoCorrect={false}
      autoComplete={password?(auth.kind==='login'?'current-password':'new-password'):email?'email':username?'username':'off'}
      textContentType={password?(auth.kind==='login'?'password':'newPassword'):email?'emailAddress':username?'username':'none'}
      keyboardType={email?'email-address':phone?'phone-pad':field.type==='number'?'number-pad':'default'} multiline={field.type==='textarea'} style={s.textInput}/>
      {password&&<Pressable accessibilityRole="button" accessibilityLabel={shown[field.id]?label('Hide password','Ocultar palavra-passe'):label('Show password','Mostrar palavra-passe')} onPress={()=>setShown(old=>({...old,[field.id]:!old[field.id]}))} style={s.passwordToggle}><Text style={{color,fontSize:12}}>{shown[field.id]?label('Hide','Ocultar'):label('Show','Mostrar')}</Text></Pressable>}
    </View>;
  };
  if(auth.checkingSession)return <View testID="native-auth-session-check" style={[s.root,{alignItems:'center',justifyContent:'center',padding:24,gap:20}]}>
    <NativeCompanyLogo url={doc?.logo} label={doc?.company||Constants.expoConfig?.name} height={96} maxWidth={220}/>
    <ActivityIndicator color={color} accessibilityLabel={label('Loading your account','A carregar a sua conta')}/>
    <Text style={{color:theme.muted,textAlign:'center'}}>{label('Loading your account…','A carregar a sua conta…')}</Text>
  </View>;
  return <KeyboardAvoidingView testID="native-auth-screen" behavior={Platform.OS==='ios'?'padding':undefined} style={s.root}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.brand}><NativeCompanyLogo url={doc?.logo} label={doc?.company||title} height={96} maxWidth={220}/><Text heading style={s.company}>{doc?.company||Constants.expoConfig?.name}</Text></View>
      <View style={s.card}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <Text heading style={[s.title,{flex:1}]}>{title}</Text>
          <Pressable testID="native-auth-language" accessibilityRole="button" accessibilityLabel={label('Language','Idioma')+': '+language.toUpperCase()}
            accessibilityState={{expanded:languageOpen,disabled:auth.busy||!auth.document||!auth.setLanguage}} disabled={auth.busy||!auth.document||!auth.setLanguage}
            onPress={()=>setLanguageOpen(true)} style={{minWidth:76,minHeight:44,paddingHorizontal:12,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,backgroundColor:brandSoft(color,.08)}}>
            <Text style={{color,fontWeight:'600'}}>{language.toUpperCase()}</Text><View style={[s.chevron,{borderColor:color,marginTop:-4}]}/>
          </Pressable>
        </View>
        {auth.kind==='forgot'&&<Text style={s.hint}>{label('Enter your email to request a password reset link.','Introduza o seu email para pedir uma ligação de recuperação.')}</Text>}
        {(doc?.messages||[]).map((message,index)=><Text key={index} accessibilityRole="alert" style={[s.notice,{backgroundColor:brandSoft(color,.08)}]}>{message}</Text>)}
        {(doc?.fields||[]).map(field=><View key={field.id} style={s.field}>{!['checkbox','radio'].includes(field.type)&&<Text style={s.label}>{field.label}{field.required?' *':''}</Text>}{fieldInput(field)}{!!field.error&&<Text accessibilityRole="alert" style={s.error}>{field.error}</Text>}</View>)}
        {!!auth.error&&<Text accessibilityRole="alert" style={s.error}>{label('Could not connect. Check your connection and try again.','Não foi possível estabelecer ligação. Verifique a ligação e tente novamente.')}</Text>}
        {(!auth.document||auth.busy)&&<ActivityIndicator color={color} accessibilityLabel={label('Loading','A carregar')}/>}
        {doc?.placeholder&&<Pressable accessibilityRole="button" disabled accessibilityState={{disabled:true}} style={[s.submit,{backgroundColor:color,opacity:.55}]}><Text style={s.submitLabel}>{title}</Text></Pressable>}
        {doc?.canSubmit&&<Pressable accessibilityRole="button" disabled={auth.busy} accessibilityState={{disabled:auth.busy}} onPress={submit} style={[s.submit,{backgroundColor:color,opacity:auth.busy ? 0.55 : 1}]}><Text style={s.submitLabel}>{doc.submitLabel||title}</Text></Pressable>}
        {!!doc&&!doc.placeholder&&!doc.canSubmit&&!doc.messages.length&&<Text style={s.error}>{label('Could not open this form. Please try again.','Não foi possível abrir o formulário. Tente novamente.')}</Text>}
        {(!!auth.error||doc&&!doc.placeholder&&!doc.canSubmit&&!doc.messages.length)&&<Pressable accessibilityRole="button" onPress={auth.retry} style={s.link}><Text style={{color}}>{label('Try again','Tentar novamente')}</Text></Pressable>}
        <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-evenly',columnGap:12}}>
          {(doc?.links||[]).filter(link=>authPageKind(link.url,base)).map(link=><Pressable key={link.url} accessibilityRole="link" onPress={()=>auth.open(link.url)} style={[s.link,{flexShrink:1}]}><Text style={{color,textAlign:'center'}}>{link.label}</Text></Pressable>)}
        </View>
        {auth.kind!=='login'&&!(doc?.links||[]).some(link=>authPageKind(link.url,base)==='login')&&<Pressable accessibilityRole="button" onPress={auth.login} style={s.link}><Text style={{color}}>{titles.login}</Text></Pressable>}
      </View>
      <View testID="native-auth-legal-links" style={{width:'100%',maxWidth:480,alignSelf:'center',borderTopWidth:1,borderColor:theme.border,paddingTop:8,flexDirection:'row',flexWrap:'wrap',justifyContent:'center',columnGap:12}}>
        {authLegalLinks(base,pt?'pt':'en').map(link=><Pressable key={link.id} accessibilityRole="link" accessibilityLabel={link.label} onPress={()=>Linking.openURL(link.url).catch(()=>{})} style={[s.link,{flexShrink:1}]}><Text style={{color,fontSize:12,textAlign:'center'}}>{link.label}</Text></Pressable>)}
      </View>
    </ScrollView>
    <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={()=>setLanguageOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel={label('Close','Fechar')} onPress={()=>setLanguageOpen(false)} style={s.overlay}>
        <View style={[s.sheet,{paddingBottom:Math.max(16,insets.bottom)}]}>
          <View style={s.pickerHeading}><Text heading style={s.label}>{label('Language','Idioma')}</Text><Pressable accessibilityRole="button" accessibilityLabel={label('Close','Fechar')} onPress={()=>setLanguageOpen(false)} style={s.passwordToggle}><Text style={{fontSize:26}}>×</Text></Pressable></View>
          {['pt','en'].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={value==='pt'?'Português':'English'} accessibilityState={{checked:language===value}}
            onPress={()=>{setLanguageOpen(false);auth.setLanguage(value);}} style={[s.link,{flexDirection:'row',gap:12,backgroundColor:language===value?brandSoft(color,.08):'#fff',borderRadius:12}]}>
            <Text style={{color,fontWeight:'600'}}>{value==='pt'?'Português':'English'}</Text>{language===value&&<Icon name="check" color={color} size={18}/>}
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
    <Modal visible={!!selection} transparent animationType="slide" onRequestClose={()=>setPicker(null)}><View style={s.overlay}><View style={[s.sheet,{paddingBottom:Math.max(16,insets.bottom)}]}><View style={s.pickerHeading}><Text heading style={s.label}>{selection?.label}</Text><Pressable accessibilityRole="button" accessibilityLabel={label('Close','Fechar')} onPress={()=>setPicker(null)} style={s.passwordToggle}><Text style={{fontSize:26}}>×</Text></Pressable></View>
      <TextInput accessibilityLabel={label('Search options','Pesquisar opções')} value={search} onChangeText={setSearch} placeholder={label('Search','Pesquisar')} style={[s.input,s.textInput]}/>
      <ScrollView keyboardShouldPersistTaps="handled">{selection?.options.filter(option=>option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(option=><Pressable key={option.value} accessibilityRole="radio" accessibilityState={{checked:values[selection.id]===option.value}} onPress={()=>{update(selection,option.value);setPicker(null);}} style={s.link}><Text style={{color:values[selection.id]===option.value?color:theme.text}}>{option.label}</Text></Pressable>)}</ScrollView>
    </View></View></Modal>
  </KeyboardAvoidingView>;
}
const s=StyleSheet.create({root:{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:90,backgroundColor:theme.surfaceSoft},content:{flexGrow:1,justifyContent:'center',padding:20,gap:24},brand:{alignItems:'center',gap:12},company:{fontSize:22,color:theme.text,textAlign:'center'},card:{width:'100%',maxWidth:480,alignSelf:'center',backgroundColor:'#fff',padding:22,borderRadius:24,borderWidth:1,borderColor:theme.border,gap:18},title:{fontSize:27,color:theme.text},hint:{fontSize:14,lineHeight:21,color:theme.muted},field:{gap:7},label:{fontSize:14,fontWeight:'600',color:theme.text},input:{minHeight:52,flexDirection:'row',alignItems:'center',borderRadius:14,borderWidth:1,borderColor:theme.border,paddingHorizontal:14,backgroundColor:'#fff'},textInput:{flex:1,minHeight:50,fontSize:16,color:theme.text,paddingVertical:12},passwordToggle:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},submit:{minHeight:52,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:16},submitLabel:{color:'#fff',fontWeight:'600',fontSize:16},link:{minHeight:44,alignItems:'center',justifyContent:'center',paddingVertical:10},error:{color:theme.danger,fontSize:13,lineHeight:20},notice:{padding:14,borderRadius:12,color:theme.text,fontSize:14,lineHeight:21},checkRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:12},check:{width:23,height:23,borderRadius:5,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center'},chevron:{width:9,height:9,borderBottomWidth:2,borderRightWidth:2,borderColor:theme.muted,transform:[{rotate:'45deg'}]},overlay:{flex:1,backgroundColor:'#0005',justifyContent:'flex-end'},sheet:{maxHeight:'80%',backgroundColor:'#fff',padding:20,borderTopLeftRadius:24,borderTopRightRadius:24,gap:12},pickerHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}});
