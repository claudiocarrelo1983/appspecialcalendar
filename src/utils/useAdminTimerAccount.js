import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { cancelTimerAlert } from './nativeTimerAlerts';

// The timer uses the same storage and alert implementation as the client.
// Namespace admin state by company and the current server-rendered identity.
export default function useAdminTimerAccount(pages, base) {
  const [key,setKey]=useState(null),account=useRef(null),version=useRef(pages.sessionVersion);
  const anonymous=useRef(null);
  const clear=()=>{
    const previous=account.current;account.current=null;setKey(null);
    if(previous){cancelTimerAlert(previous.key).catch(()=>{});SecureStore.deleteItemAsync('native-gym-timer-'+previous.key).catch(()=>{});}
  };
  useEffect(()=>{
    if(version.current!==pages.sessionVersion){version.current=pages.sessionVersion;anonymous.current=null;clear();}
  },[pages.sessionVersion]);
  const name=pages.document?.header?.user?.name;
  const ownerKey=pages.document?.header?.accountKey;
  const authenticated=!!pages.document;
  useEffect(()=>{
    if(!authenticated)return;
    if(!name&&!anonymous.current)anonymous.current=Crypto.randomUUID();
    const identity=JSON.stringify([new URL(base).origin,'admin',ownerKey||name||anonymous.current]);
    if(account.current?.identity===identity)return;
    clear();let disposed=false;
    ( /^[a-f0-9]{64}$/.test(ownerKey||'') ? Promise.resolve(ownerKey) : Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,identity)).then(next=>{
      if(disposed)return;account.current={identity,key:next};setKey(next);
    }).catch(()=>{});
    return ()=>{disposed=true;};
  },[authenticated,name,ownerKey,base,pages.sessionVersion]);
  return key;
}
