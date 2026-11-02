import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export default function useBirthdayCount(gym) {
  const [count,setCount]=useState(0);
  const account=gym.data?.accountKey;
  useEffect(()=>{
    setCount(0);if(!account)return;
    let disposed=false,revision=0;
    const refresh=async()=>{
      const current=++revision;
      try{
        const result=await gym.request('birthdays');
        if(!disposed&&current===revision&&Array.isArray(result?.rows))setCount(result.rows.filter(row=>row.today===true).length);
      }catch{/* A temporary failure must not erase a confirmed birthday badge. */}
    };
    refresh();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
    const interval=setInterval(()=>{if(AppState.currentState==='active')refresh();},300000);
    return()=>{disposed=true;revision++;subscription.remove();clearInterval(interval);};
  },[account,gym.request]);
  return [count,rows=>setCount(rows.filter(row=>row.today===true).length)];
}
