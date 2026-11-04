import history from './workoutHistory';
import {canAutoSaveWorkout,workoutWritePermission,requestWorkoutWritePermission,saveWorkoutToHealth} from './workoutNative';

export function createWorkoutHealthAuto({history,available,permission,request,save}){
  const pending=new Map();
  return {
    async prepare(){
      if(!available)return 'unavailable';
      const status=await permission();
      return status==='undetermined'?request():status;
    },
    flush(account){
      if(!available)return history.list(account);
      if(pending.has(account))return pending.get(account);
      const task=(async()=>{
        const rows=await history.list(account),eligible=rows.filter(row=>row.healthAuto===true&&!row.healthSaved);
        if(!eligible.length)return rows;
        // The permission can be revoked after Start. Never request it during a retry.
        const status=await permission();
        for(const row of eligible){
          if(status!=='authorized'){
            const healthStatus=status==='unavailable'?'unavailable':'permission';
            if(row.healthStatus!==healthStatus)await history.mark(account,row.id,{healthStatus});
            continue;
          }
          try{
            const result=await save(row);
            if(result?.saved!==true)throw Error('health_save_failed');
            await history.mark(account,row.id,{healthSaved:true,healthStatus:'saved'});
          }catch(error){
            const healthStatus=error?.code==='permission'?'permission':'retry';
            if(row.healthStatus!==healthStatus)await history.mark(account,row.id,{healthStatus});
          }
        }
        return history.list(account);
      })();
      pending.set(account,task);task.finally(()=>{if(pending.get(account)===task)pending.delete(account);}).catch(()=>{});
      return task;
    },
  };
}
export default createWorkoutHealthAuto({history,available:canAutoSaveWorkout,permission:workoutWritePermission,request:requestWorkoutWritePermission,save:saveWorkoutToHealth});
