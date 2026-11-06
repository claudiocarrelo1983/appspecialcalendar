const pairs=[
  ['Username','Nome de utilizador'],['Password','Palavra-passe'],['New password','Nova palavra-passe'],
  ['First name','Primeiro nome'],['Last name','Apelido'],['Email','Email'],['Email address','Endereço de email'],
  ['Date of birth','Data de nascimento'],['Phone number','Número de telefone'],['Club location','Local do clube'],
  ['Choose location','Escolher local'],['Select','Selecionar'],['Sign in','Iniciar sessão'],['Login','Iniciar sessão'],
  ['Create account','Criar conta'],['Register','Registar'],['Forgot password','Recuperar palavra-passe'],
  ['Forgot password?','Esqueceu-se da palavra-passe?'],['Back to sign in','Voltar ao início de sessão'],
  ['Send reset link','Enviar ligação de recuperação'],['Save password','Guardar palavra-passe'],
  ['Remember me','Lembrar-me'],['I accept the terms and privacy policy','Aceito os termos e a política de privacidade'],
];
export function authText(value,language){
  const text=String(value||'');
  const pair=pairs.find(pair=>pair.some(item=>item.toLocaleLowerCase()===text.trim().toLocaleLowerCase()));
  return pair?pair[language==='pt'?1:0]:text;
}
export function deviceAuthLanguage(preferredLocales=[]){
  try{
    const first=preferredLocales.find(value=>typeof value==='string'&&value.trim())||Intl.DateTimeFormat().resolvedOptions().locale;
    return /^pt(?:[-_]|$)/i.test(first)?'pt':'en';
  }catch{return 'en';}
}
