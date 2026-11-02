export function calendarFailure(error,language='en',platform='android'){
  const pt=String(language).toLowerCase().startsWith('pt');
  const text=[error?.code,error?.message,error?.cause?.code,error?.cause?.message].filter(Boolean).join(' ').toLowerCase();
  if(/cancelled|canceled|user_cancel/.test(text))return {kind:'cancelled',message:'',settings:false};
  if(/calendar_permission|missing.permissions|permission.*(?:denied|required|not.granted)|(?:denied|required|missing).*permission|not authorized|not authorised/.test(text)){
    return {kind:'permission',settings:true,message:pt
      ? (platform==='ios'?'Sem permissão para aceder ao Calendário. Abra as Definições do iPhone, selecione esta app e permita o acesso ao Calendário.':'Sem permissão para aceder ao Calendário. Abra Definições → Aplicações → esta app → Permissões → Calendário e permita o acesso. Se a opção não aparecer, atualize a app.')
      : (platform==='ios'?'Calendar access is not allowed. Open iPhone Settings, select this app and allow Calendar access.':'Calendar access is not allowed. Open Settings → Apps → this app → Permissions → Calendar and allow access. If Calendar is not listed, update the app.')};
  }
  if(/calendar_unavailable|no (?:writable )?calendar|calendar.*(?:read.only|not found)/.test(text))return {kind:'no_calendar',settings:false,message:pt?'Não foi encontrado um calendário onde seja possível guardar eventos. Configure um calendário no telemóvel e tente novamente.':'No writable calendar was found. Set up a calendar on your phone, then try again.'};
  if(/native_unavailable|unavailability|err_unavailable|cannot find native module|not available on/.test(text))return {kind:'unsupported',settings:false,message:pt?'A integração com o Calendário não está disponível nesta versão da app. Atualize a app e tente novamente.':'Calendar integration is not available in this app version. Update the app, then try again.'};
  if(/invalid calendar|invalid event|invalid class/.test(text))return {kind:'invalid_event',settings:false,message:pt?'Não foi possível ler os dados desta aula. Volte à lista de aulas e tente novamente.':'Could not read this class’s details. Return to the class list and try again.'};
  return {kind:'unknown',settings:false,message:pt?'Não foi possível adicionar esta aula ao Calendário. Tente novamente. Se o problema continuar, contacte o clube.':'Could not add this class to Calendar. Try again. If the problem continues, contact your club.'};
}
