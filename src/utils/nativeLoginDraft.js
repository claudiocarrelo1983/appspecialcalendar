// Presentation only: credentials stay in component memory until the real company
// form, its CSRF token and server field bindings have arrived.
export function loginPlaceholder(language='en') {
  return {placeholder:true,language,revision:'local-login',fields:[
    {id:'draft-user',type:'text',label:language==='pt'?'Nome de utilizador':'Username',autocomplete:'username',value:'',required:true},
    {id:'draft-password',type:'password',label:language==='pt'?'Palavra-passe':'Password',value:'',required:true},
  ],messages:[],links:[],canSubmit:false};
}
export function adoptLoginDraft(fields, previous) {
  const values=Object.fromEntries(fields.map(field=>[field.id,field.value]));
  // Only the first editable username and password receive the local draft.
  const user=fields.find(field=>!field.readonly&&['text','email'].includes(field.type)&&(field.autocomplete==='username'||/^(?:username|utilizador|nome de utilizador)$/i.test(field.label)));
  const password=fields.find(field=>!field.readonly&&field.type==='password');
  if(user&&previous['draft-user'])values[user.id]=previous['draft-user'];
  if(password&&previous['draft-password'])values[password.id]=previous['draft-password'];
  return values;
}
