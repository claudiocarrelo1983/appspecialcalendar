import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
const queues=new Map();
export function createWorkoutHistory(store,newId=()=>Crypto.randomUUID()){
  const key=account=>{if(!/^[a-f0-9]{64}$/.test(account||''))throw Error('Invalid account');return 'fitness-history-'+account;};
  const serial=(account,action)=>{const k=key(account),task=(queues.get(k)||Promise.resolve()).catch(()=>{}).then(()=>action(k));queues.set(k,task);task.finally(()=>{if(queues.get(k)===task)queues.delete(k);}).catch(()=>{});return task;};
  const read=async k=>JSON.parse(await store.getItemAsync(k)||'[]');
  return {
    list:account=>serial(account,read),
    add:(account,row)=>serial(account,async k=>{const rows=await read(k);const next={id:row.id||newId(),mode:row.mode,seconds:Math.floor(row.seconds),at:row.at,synced:false,healthSaved:false,healthAuto:row.healthAuto===true,healthStatus:row.healthAuto===true?'pending':null};if(!['stopwatch','countdown','interval'].includes(next.mode)||next.seconds<1||next.seconds>86400||!Number.isFinite(next.at))throw Error('Invalid workout');if(!rows.some(r=>r.id===next.id)){rows.unshift(next);await store.setItemAsync(k,JSON.stringify(rows));}return rows;}),
    mark:(account,id,fields)=>serial(account,async k=>{const rows=await read(k);for(const row of rows)if(row.id===id)for(const field of ['synced','healthSaved'])if(typeof fields[field]==='boolean')row[field]=fields[field];for(const row of rows)if(row.id===id&&['pending','permission','retry','saved','unavailable'].includes(fields.healthStatus))row.healthStatus=fields.healthStatus;await store.setItemAsync(k,JSON.stringify(rows));return rows;}),
    merge:(account,incoming)=>serial(account,async k=>{
      const rows=await read(k),known=new Set(rows.map(row=>row.id));
      for(const row of incoming)if(!known.has(row.workout_id)&&/^[a-f0-9-]{36}$/i.test(row.workout_id||'')&&['stopwatch','countdown','interval'].includes(row.mode)&&Number(row.duration_seconds)>=1&&Number(row.duration_seconds)<=86400&&Number.isFinite(Number(row.finished_at))){rows.push({id:row.workout_id,mode:row.mode,seconds:Number(row.duration_seconds),at:Number(row.finished_at)*1000,synced:true,healthSaved:false});known.add(row.workout_id);}
      rows.sort((a,b)=>b.at-a.at);await store.setItemAsync(k,JSON.stringify(rows));return rows;
    }),
  };
}
export default createWorkoutHistory(SecureStore);
