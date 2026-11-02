import {Alert,Linking,Platform} from 'react-native';
import {calendarFailure} from './calendarErrors';
export function openCalendarSettings(language='en'){
  const pt=String(language).startsWith('pt');
  return Linking.openSettings().catch(()=>Alert.alert(pt?'Permissão do Calendário':'Calendar permission',pt?'Não foi possível abrir as Definições. Abra-as manualmente e consulte as permissões desta app.':'Could not open Settings. Open them manually and check this app’s permissions.'));
}
export function showCalendarFailure(error,language='en'){
  const pt=String(language).startsWith('pt'),failure=calendarFailure(error,language,Platform.OS);
  if(!failure.message)return;
  Alert.alert(pt?'Adicionar ao calendário':'Add to calendar',failure.message,failure.settings?[
    {text:pt?'Cancelar':'Cancel',style:'cancel'},
    {text:pt?'Abrir definições':'Open settings',onPress:()=>openCalendarSettings(language)},
  ]:[{text:'OK'}]);
}
