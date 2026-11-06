export const CLIENT_BOOKINGS_MESSAGE='sc.clientBookings';
const actions=['book','cancel-booking','join-waitlist','leave-waitlist','booking-alert','sign-waiver','start-stripe-payment','refresh-stripe-payment'];
export function validClientBookings(value){
  return value?.revision==='native-client-bookings-v1'&&/^\d{4}-\d{2}-\d{2}$/.test(value.date||'')
    &&Number.isFinite(Date.parse(value.serverTime))&&typeof value.companyCode==='string'&&typeof value.clientGuid==='string'
    &&['rows','classFilters','family','alerts','waivers','history'].every(key=>Array.isArray(value[key]))
    &&value.rows.every(row=>Number.isSafeInteger(row.schedule_id)&&row.schedule_id>0&&typeof row.key==='string'&&Array.isArray(row.actions));
}
export function clientBookingsScript(base,id,action='schedule',params={}){
  if(action!=='schedule'&&!actions.includes(action))throw Error('Unsupported booking action');
  const clean={};
  for(const key of ['date','class_code','schedule_id','id','company_code','client_guid','enabled','waiver_code','payment_code']){
    if(params[key]!==undefined)clean[key]=String(params[key]).slice(0,255);
  }
  if(clean.date&&!/^\d{4}-\d{2}-\d{2}$/.test(clean.date))throw Error('Invalid date');
  for(const key of ['schedule_id','id'])if(clean[key]&&!/^[1-9]\d{0,9}$/.test(clean[key]))throw Error('Invalid ID');
  return '('+SOURCE+')('+JSON.stringify({origin:new URL(base).origin,id,action,params:clean})+');true;';
}
const SOURCE=String.raw`async function(c){
  if(location.origin!==c.origin||!window.ReactNativeWebView)return;
  const send=value=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'sc.clientBookings',id:c.id,...value}));
  let timer;
  try{
    let path='/dashboard-gym-client/'+(c.action==='schedule'?'native-schedule':c.action);
    const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}};
    if(c.action==='schedule')path+='?'+new URLSearchParams(c.params);
    else{
      const csrf=document.querySelector('meta[name="csrf-token"]')?.content;if(!csrf)throw Error('csrf_unavailable');
      if(c.action==='booking-alert'&&c.params.enabled==='1'){
        if(!window.SpecialCalendarPush)throw Error('push_permission');
        try{await window.SpecialCalendarPush.ensureRegistered();}catch{throw Error('push_permission');}
      }
      const query={};for(const key of ['class_code','date','schedule_id','id','waiver_code','payment_code'])if(c.params[key]!==undefined)query[key]=c.params[key];
      path+='?'+new URLSearchParams(query);
      options.method='POST';options.headers['X-CSRF-Token']=csrf;options.headers['Content-Type']='application/x-www-form-urlencoded';options.body=new URLSearchParams(c.params).toString();
    }
    // Retry only reads: a disconnected POST may already have been committed.
    async function readResponse(){
      const attempts=c.action==='schedule'?2:1;
      for(let attempt=0;attempt<attempts;attempt++){
        const controller=new AbortController();timer=setTimeout(()=>controller.abort(),12000);
        try{
          const response=await fetch(path,{...options,signal:controller.signal});
          const body=await response.text();
          return {response,body};
        }catch(error){if(attempt===attempts-1)throw error;}
        finally{clearTimeout(timer);}
      }
    }
    const {response,body}=await readResponse(),final=new URL(response.url||path,location.href);
    if(final.origin!==c.origin||/\/(?:site\/)?login\/?$/.test(final.pathname)){send({status:401,result:{success:false}});return;}
    let result;
    try{result=JSON.parse(body);}catch{
      if(c.action==='sign-waiver'&&response.ok&&/^\/dashboard-gym-client(?:\/index)?\/?$/.test(final.pathname)){
        const root=new DOMParser().parseFromString(body,'text/html'),success=root.querySelector('#gymClientFlash .alert-success');
        result={success:!!success,message:(success||root.querySelector('#gymClientFlash .alert-danger'))?.textContent?.trim().slice(0,500)||''};
      }else{send({status:response.status,reason:'invalid_response',result:{success:false}});return;}
    }
    send({status:response.status,result});
  }catch(error){send({status:0,reason:['push_permission','csrf_unavailable'].includes(error.message)?error.message:'connection',result:{success:false}});}
  finally{clearTimeout(timer);}
}`;
