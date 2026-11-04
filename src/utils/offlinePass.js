import * as SecureStore from 'expo-secure-store';
import {qrRuns} from './nativeGymCore';

export function createOfflinePass(store=SecureStore) {
  const key=account=>{if(!/^[a-f0-9]{64}$/.test(account||''))throw Error('invalid_account');return 'fitness-offline-pass-'+account;};
  const pending=new Map();
  const serial=(account,operation)=>{
    const name=key(account),task=(pending.get(name)||Promise.resolve()).catch(()=>{}).then(()=>operation(name));
    pending.set(name,task);task.finally(()=>{if(pending.get(name)===task)pending.delete(name);}).catch(()=>{});return task;
  };
  return {
    async save(data,origin){
      if(!data?.pass||!qrRuns(data.pass.matrix).length)return serial(data.accountKey,name=>store.deleteItemAsync(name));
      // Only the displayed membership identity and QR are cached, never session credentials.
      const value={accountKey:data.accountKey,origin,client:{name:data.client.name,number:data.client.number},company:{name:data.company.name},language:data.language,
        pass:{matrix:data.pass.matrix,title:data.pass.title,status:data.pass.status,validUntil:data.pass.validUntil},savedAt:Date.now()};
      await serial(data.accountKey,name=>store.setItemAsync(name,JSON.stringify(value)));
    },
    async read(account,origin){
      const value=JSON.parse(await store.getItemAsync(key(account))||'null');
      return value?.accountKey===account&&value.origin===origin&&qrRuns(value.pass?.matrix).length?value:null;
    },
    remove:account=>serial(account,name=>store.deleteItemAsync(name)),
  };
}
export default createOfflinePass();
