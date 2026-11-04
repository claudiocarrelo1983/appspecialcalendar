// The same enhancement is published as workspace's gym-summary-cards.js.
// It only marks existing summary cards; links, values and handlers stay intact.
export function summaryCardTone(label, index = 0) {
  const tones = [
    {color:'#3156a0',tint:'#f4f8ff',soft:'#e8f0ff',border:'#dce6f8'},
    {color:'#198754',tint:'#f2fbf5',soft:'#e4f5e9',border:'#d5ecde'},
    {color:'#b77909',tint:'#fffbf2',soft:'#fff2d9',border:'#f2e4c8'},
    {color:'#64748b',tint:'#f7f9fc',soft:'#edf1f6',border:'#e1e7ef'},
    {color:'#c24141',tint:'#fff5f5',soft:'#fde8e8',border:'#f4d6d6'},
  ];
  const text=String(label||'').toLowerCase();
  if(/overdue|atras|vencid/.test(text))return tones[4];
  if(/cancel|inactive|inativ|missed|faltou/.test(text))return tones[3];
  if(/wait|pending|await|aguard|espera|pendente/.test(text))return tones[2];
  if(/active|ativ|registered|inscrit|completed|conclu|approved|aprov/.test(text))return tones[1];
  if(/total|participants|participantes/.test(text))return tones[0];
  return tones[index%tones.length];
}
export const eventSummaryStyles = `
.gym-event-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:1fr;gap:12px;margin:0 0 16px;}
.gym-event-summary>.gym-summary-card{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;gap:3px!important;width:100%!important;min-width:0!important;max-width:100%!important;height:100%!important;min-height:96px!important;padding:14px!important;margin:0!important;background:#fff!important;border:1px solid var(--gym-app-border,#e4eaf2)!important;border-radius:12px!important;box-shadow:none!important;box-sizing:border-box;}
.gym-event-summary>.gym-summary-has-icon{padding-right:54px!important;}
.gym-event-summary .gym-summary-label{font-size:12px!important;line-height:18px!important;font-weight:500!important;color:var(--gym-app-muted,#718099);white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:manual!important;}
.gym-event-summary .gym-summary-value{font-size:22px!important;line-height:27px!important;font-weight:700!important;color:var(--gym-app-text,#101b30);margin:0!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;}
.gym-event-summary .gym-summary-value-text{font-size:16px!important;line-height:22px!important;}
.gym-event-summary .gym-summary-icon{position:absolute!important;right:12px!important;top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;justify-content:center!important;width:32px!important;height:32px!important;border-radius:50%!important;background:var(--gym-app-brand-soft,rgba(25,135,84,.08))!important;color:var(--gym-app-brand,#198754)!important;font-size:20px!important;margin:0!important;}
.gym-event-summary .gym-summary-icon i{color:inherit!important;font-size:20px!important;}
.gym-app-layout :is(.events-index,.event-clients-index) .gym-menu-page-header{margin-bottom:12px!important;gap:12px!important;}
.gym-app-layout :is(.events-index,.event-clients-index) .gym-menu-page-header p{margin:0!important;}
.gym-app-layout :is(.events-index,.event-clients-index) .gym-menu-page-header .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 16px!important;border-radius:12px!important;font-size:14px!important;font-weight:600!important;line-height:22px!important;box-sizing:border-box;}
@media(max-width:767.98px){.gym-event-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:1fr!important;gap:10px!important;margin-top:12px!important;margin-bottom:16px!important;}.gym-app-layout :is(.events-index,.event-clients-index){padding:0!important;}html.__scNativeAdminFrame .gym-app-layout{padding-bottom:max(16px,env(safe-area-inset-bottom))!important;}}
@media(max-width:359px){.gym-event-summary>.gym-summary-has-icon{padding-left:12px!important;padding-right:46px!important;}.gym-event-summary .gym-summary-icon{right:10px!important;width:28px!important;height:28px!important;}.gym-event-summary .gym-summary-label{font-size:11px!important;line-height:16px!important;}}
`;
export const summaryCardLayoutScript = String.raw`(function(){
  // Keep injected source literal: Hermes does not retain JS function source.
  var toneFor=function(label,index){
    var tones=[{color:'#3156a0',tint:'#f4f8ff',soft:'#e8f0ff',border:'#dce6f8'},{color:'#198754',tint:'#f2fbf5',soft:'#e4f5e9',border:'#d5ecde'},{color:'#b77909',tint:'#fffbf2',soft:'#fff2d9',border:'#f2e4c8'},{color:'#64748b',tint:'#f7f9fc',soft:'#edf1f6',border:'#e1e7ef'},{color:'#c24141',tint:'#fff5f5',soft:'#fde8e8',border:'#f4d6d6'}];
    var text=String(label||'').toLowerCase();
    if(/overdue|atras|vencid/.test(text))return tones[4];
    if(/cancel|inactive|inativ|missed|faltou/.test(text))return tones[3];
    if(/wait|pending|await|aguard|espera|pendente/.test(text))return tones[2];
    if(/active|ativ|registered|inscrit|completed|conclu|approved|aprov/.test(text))return tones[1];
    if(/total|participants|participantes/.test(text))return tones[0];
    return tones[Math.max(0,index||0)%tones.length];
  };
  var cards='.challenge-stat-card,.competition-stat-card,.events-stat-card,.event-clients-stat,.event-metric-card,.attendance-stat-card,.attendance-stat,.client-attendance-stat,.client-membership-stat,.client-performance-stat,.client-info-stat,.client-report-stat,.team-stat-card,.task-stat-card,.task-kpi,.tasks-kpi,.stock-stat-card,.reports-stat-card,.report-kpi,.vacation-metric-card,.dashboard-summary-card,.dashboard-gym-kpi,.members-debts-kpi,.campaign-view-kpi,.mini-stats-wid';
  function enhance(){
    document.querySelectorAll('.gym-app-layout,html.__scNativeAdminFrame .page-content').forEach(function(root){
      root.querySelectorAll(cards).forEach(function(card){
        if(card.closest('form,.modal,dialog,[data-gym-keep-layout]'))return;
        var cell=card, parent=card.parentElement;
        if(parent&&parent.classList.contains('row')){}else if(parent&&Array.from(parent.classList).some(function(c){return /^col(?:-|$)/.test(c);})){
          cell=parent;parent=parent.parentElement;
        }
        if(!parent)return;
        var siblings=Array.from(parent.children).filter(function(el){return el.matches(cards)||el.querySelector(cards);});
        // Do not turn a mixed content section into a statistics grid.
        if(siblings.length<2||siblings.length!==parent.children.length)return;
        parent.classList.add('gym-summary-grid');cell.classList.add('gym-summary-cell');card.classList.add('gym-summary-card');
        var tone=toneFor(card.textContent,siblings.indexOf(cell));
        card.style.setProperty('--gym-summary-color',tone.color);
        card.style.setProperty('--gym-summary-tint',tone.tint);
        card.style.setProperty('--gym-summary-soft',tone.soft);
        card.style.setProperty('--gym-summary-border',tone.border);
        var icon=card.querySelector('[class*="-stat-icon"],[class*="-kpi-icon"],.mini-stat-icon,.avatar-sm,i.bx,i.fas,i.fa,i[class*="mdi"]');
        if(icon){
          var plate=icon;
          while(plate.parentElement&&plate.parentElement!==card&&!plate.parentElement.textContent.trim()&&plate.parentElement.children.length===1)plate=plate.parentElement;
          plate.classList.add('gym-summary-icon');
        }
      });
    });
  }
  if(!document.getElementById('gym-summary-card-styles')){
    var style=document.createElement('style');style.id='gym-summary-card-styles';
    style.textContent='@media(max-width:767.98px){.gym-summary-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:16px!important;margin-bottom:16px!important;margin-left:0!important;margin-right:0!important}.gym-summary-grid>.gym-summary-cell{width:auto!important;max-width:none!important;min-width:0!important;padding:0!important;margin:0!important;grid-column:auto!important}.gym-summary-grid .gym-summary-card{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:66px!important;margin:0!important;padding:14px 50px 14px 12px!important;border:1px solid var(--gym-summary-border,var(--gym-app-border,#e4eaf2))!important;border-radius:12px!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;gap:2px!important;text-align:left!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:manual!important;box-sizing:border-box;background:linear-gradient(135deg,#fff,var(--gym-summary-tint,#f4f8ff))!important}.gym-summary-card>div,.gym-summary-card a,.gym-summary-card .flex-grow-1{min-width:0!important;max-width:100%!important}.gym-summary-card .card-body{padding:0!important}.gym-summary-card :is(.text-muted,.small,p,h6,[data-summary-label],[class*="-stat-label"],[class*="-kpi-label"]){font-size:11px!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:manual!important;margin-bottom:2px!important}.gym-summary-card :is(.h5,.h4,.h3,h3,h4,strong,[data-summary-value]){font-size:21px!important;line-height:1.15!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;margin:0!important}.gym-summary-card .gym-summary-icon{position:absolute!important;right:10px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;justify-content:center!important;width:32px!important;height:32px!important;min-width:32px!important;flex:0 0 32px!important;font-size:20px!important;line-height:1!important;border-radius:50%!important;margin:0!important;background-color:var(--gym-summary-soft,#e8f0ff)!important;color:var(--gym-summary-color,#3156a0)!important}.gym-summary-icon i{font-size:20px!important;color:var(--gym-summary-color,#3156a0)!important}.gym-summary-card .text-truncate{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.gym-summary-card .d-flex{gap:0!important;min-width:0!important}}';
    style.textContent+=${JSON.stringify(eventSummaryStyles)};
    (document.head||document.documentElement).appendChild(style);
  }
  if(!window.GymSummaryCards){window.GymSummaryCards={enhance:enhance};document.addEventListener('gym:content-updated',enhance);document.addEventListener('DOMContentLoaded',enhance);if(window.jQuery)window.jQuery(document).on('pjax:end.gymSummaryCards',enhance);}
  window.GymSummaryCards.enhance();
})();`;





