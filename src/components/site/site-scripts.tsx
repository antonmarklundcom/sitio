/**
 * Fyra små inline-script. Inget av dem laddar en extern resurs.
 *
 * Beaconen skickar `l` (vilken CTA som klickades, `data-ev-loc`) både till
 * dataLayer och till /api/ev, som sparar det i `analytics_events.cta_loc`
 * (R3-18, migrering 0003). För ett vy-event är `l` sektionens id.
 *
 * JS_FLAG måste köra före paint: reveal-animationen är progressiv förbättring
 * och innehållet göms bara när JS faktiskt finns.
 */

import { OPEN_NOW_CORE } from "@/lib/open-now-script";

export const JS_FLAG = `document.documentElement.classList.add('js')`;

const ANALYTICS = `(function(){
window.dataLayer=window.dataLayer||[];
var bid=document.currentScript&&document.currentScript.dataset.bid;
function send(ev,loc){
  window.dataLayer.push({event:ev,ev_loc:loc,page_path:location.pathname,site:location.hostname});
  try{
    navigator.sendBeacon('/api/ev',new Blob([JSON.stringify({b:bid,t:ev,l:loc,p:location.pathname,r:document.referrer})],{type:'application/json'}));
  }catch(e){}
}
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-ev]');
  if(t)send(t.dataset.ev,t.dataset.evLoc||'');
},true);
/* Vy-event (menu_view, gallery_view, products_view): en meny läses, den klickas inte, så ett
   klickevent hade mätt noll. Skickas EN gång per sidvisning och först när
   sektionen faktiskt syns — en sektion längst ner som ingen scrollar till ska
   inte räknas som läst. Utan IntersectionObserver skickas inget alls; en
   uppskattning är värre än ett hål, eftersom siffran används i säljsamtal. */
var views=document.querySelectorAll('[data-ev-view]');
if(views.length&&'IntersectionObserver' in window){
  var vo=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting)return;
      vo.unobserve(entry.target);
      send(entry.target.dataset.evView,entry.target.id||'');
    });
  },{threshold:.25});
  views.forEach(function(el){vo.observe(el)});
}
send('page_view','');
})();`;

const MOTION = `(function(){
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('is-in')});
  return;
}
var els=document.querySelectorAll('.reveal');
if(!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('is-in')});return}
var io=new IntersectionObserver(function(entries){
  entries.forEach(function(entry,i){
    if(!entry.isIntersecting)return;
    var delay=Math.min(i,5)*70;
    setTimeout(function(){entry.target.classList.add('is-in')},delay);
    io.unobserve(entry.target);
  });
},{rootMargin:'0px 0px -12% 0px',threshold:.12});
els.forEach(function(el){io.observe(el)});
})();`;

/**
 * "Abierto ahora" räknas om i webbläsaren (R3-35) — se OPEN_NOW_CORE.
 */
const OPEN_NOW = `(function(){
${OPEN_NOW_CORE}
var n=sitioNow(new Date());
document.querySelectorAll('[data-hours]').forEach(function(el){
  try{
    var st=sitioOpenState(JSON.parse(el.getAttribute('data-hours')),n.dayKey,n.minutes);
    var t=sitioStatusText(st);
    var txt=el.querySelector('.status-text'),dot=el.querySelector('.dot');
    if(!t||!txt)return;
    txt.textContent=t;
    if(dot)dot.className=st&&st.open?'dot dot--open':'dot';
  }catch(e){}
});
})();`;

/** Räknar om "Abierto ahora" i webbläsaren. Körs även i förhandsvisning. */
export function OpenNowScript() {
  return <script dangerouslySetInnerHTML={{ __html: OPEN_NOW }} />;
}

/** Rörelse. Körs alltid — även i förhandsvisning, annars ser du inte sajten. */
export function MotionScript() {
  return <script dangerouslySetInnerHTML={{ __html: MOTION }} />;
}

/**
 * Analytics-beacon. Körs aldrig i förhandsvisning: dina egna granskningar
 * ska inte hamna i kundens statistik — och statistiken är säljargumentet vid
 * förnyelsen, så den måste vara sann.
 */
export function AnalyticsScript({ businessId }: { businessId: number }) {
  return <script data-bid={businessId} dangerouslySetInnerHTML={{ __html: ANALYTICS }} />;
}
