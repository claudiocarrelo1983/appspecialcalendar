import * as SecureStore from 'expo-secure-store';
import {requireOptionalNativeModule} from 'expo-modules-core';

const queues=new Map();
export function createFitnessCalendar(api,store,accountKey) {
  if(!/^[a-f0-9]{64}$/.test(accountKey||''))throw Error('sign_in_required');
  const key='fitness-calendar-'+accountKey;
  const read=async()=>JSON.parse(await store.getItemAsync(key)||'[]');
  const serial=fn=>{
    const work=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);
    queues.set(key,work);work.finally(()=>{if(queues.get(key)===work)queues.delete(key);}).catch(()=>{});return work;
  };
  const permission=async()=>{if(!(await api.requestCalendarPermissionsAsync()).granted)throw Error('calendar_permission');};
  return {
    list:()=>serial(async()=>{
      await permission();const rows=await read(),current=[];
      for(const row of rows){try{const event=await api.getEventAsync(row.id);if(event)current.push({...row,title:event.title,startDate:new Date(event.startDate).toISOString(),endDate:new Date(event.endDate).toISOString()});}catch(error){if(!/not found|does not exist|could not find/i.test(error.message||''))throw error;}}
      await store.setItemAsync(key,JSON.stringify(current));return current.sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate));
    }),
    add:event=>serial(async()=>{
      await permission();const rows=await read();
      const existing=rows.find(row=>row.url===event.url&&row.startDate===new Date(event.startDate).toISOString());
      if(existing){try{if(await api.getEventAsync(existing.id))return existing;}catch{} }
      const calendars=await api.getCalendarsAsync(api.EntityTypes.EVENT);
      const calendar=calendars.find(row=>row.allowsModifications&&row.isPrimary)||calendars.find(row=>row.allowsModifications);
      if(!calendar)throw Error('calendar_unavailable');
      const id=await api.createEventAsync(calendar.id,event);
      const row={id,title:event.title,startDate:new Date(event.startDate).toISOString(),endDate:new Date(event.endDate).toISOString(),url:event.url};
      try{await store.setItemAsync(key,JSON.stringify([row,...rows.filter(old=>old.id!==existing?.id)]));}
      catch(error){await api.deleteEventAsync(id);throw error;}
      return row;
    }),
    remove:id=>serial(async()=>{
      const rows=await read();if(!rows.some(row=>row.id===id))throw Error('foreign_event');
      await permission();await api.deleteEventAsync(id);
      await store.setItemAsync(key,JSON.stringify(rows.filter(row=>row.id!==id)));
    }),
  };
}
export function fitnessCalendar(accountKey){
  if(!requireOptionalNativeModule('ExpoCalendar'))throw Error('native_unavailable');
  return createFitnessCalendar(require('expo-calendar/legacy'),SecureStore,accountKey);
}
