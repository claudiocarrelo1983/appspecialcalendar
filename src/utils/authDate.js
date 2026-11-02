export function isoDate(year,month,day){
  return String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
export function parseDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
  const [year,month,day]=value.split('-').map(Number);
  if(year<1||month<1||month>12||day<1)return null;
  const date=new Date(2000,month-1,day,12);date.setFullYear(year);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?{year,month:month-1,day}:null;
}
export function calendarDays(year,month){
  const first=new Date(2000,month,1,12);first.setFullYear(year);
  // Recompute leap-day length after setting the actual year.
  const next=new Date(first);next.setMonth(month+1,0);
  const offset=(first.getDay()+6)%7;
  return Array.from({length:42},(_,index)=>{const day=index-offset+1;return day>0&&day<=next.getDate()?day:null;});
}
export function dateAllowed(value,min,max){return !!parseDate(value)&&(!parseDate(min)||value>=min)&&(!parseDate(max)||value<=max);}
