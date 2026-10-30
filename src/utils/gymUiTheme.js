import theme from '../assets/gym-ui-theme.json';
export default theme;
export function brandSoft(hex,alpha=0.1){
  const valid=/^#[a-f0-9]{6}$/i.test(hex||'')?hex:theme.primaryFallback;
  return 'rgba('+[1,3,5].map(i=>parseInt(valid.slice(i,i+2),16)).join(',')+','+alpha+')';
}
