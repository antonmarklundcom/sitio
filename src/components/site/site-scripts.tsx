/**
 * Tre små inline-script. Inget av dem laddar en extern resurs.
 *
 * JS_FLAG måste köra före paint: reveal-animationen är progressiv förbättring
 * och innehållet göms bara när JS faktiskt finns.
 */

export const JS_FLAG = `document.documentElement.classList.add('js')`;

const ANALYTICS = `(function(){
window.dataLayer=window.dataLayer||[];
var bid=document.currentScript&&document.currentScript.dataset.bid;
function send(ev,loc){
  window.dataLayer.push({event:ev,ev_loc:loc,page_path:location.pathname,site:location.hostname});
  try{
    navigator.sendBeacon('/api/ev',new Blob([JSON.stringify({b:bid,t:ev,l:loc,p:location.pathname})],{type:'application/json'}));
  }catch(e){}
}
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-ev]');
  if(t)send(t.dataset.ev,t.dataset.evLoc||'');
},true);
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
