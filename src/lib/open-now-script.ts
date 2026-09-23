/**
 * "Abierto ahora" räknas i webbläsaren (R3-35). Sajterna är ISR med en
 * timmes revalidering och Next serverar den gamla sidan först — på en lugn
 * sajt kunde en besökare 23:00 se "Abierto ahora · cierra 18:00" från en sida
 * byggd 17:55. Servern renderar fortfarande pillret (utan JS står det kvar),
 * och det här skriptet räknar om det från `data-hours` vid varje sidvisning.
 *
 * Samma regler som openState()/statusText() i src/lib/hours.ts;
 * tests/unit/open-now.test.ts kör båda mot varandra så att de inte glider isär.
 * Egen .ts-fil (inte i site-scripts.tsx) så att vitest kan importera den.
 */
export const OPEN_NOW_CORE = `var SITIO_ORDER=['mon','tue','wed','thu','fri','sat','sun'];
var SITIO_LABEL={mon:'Lunes',tue:'Martes',wed:'Miércoles',thu:'Jueves',fri:'Viernes',sat:'Sábado',sun:'Domingo'};
function sitioMin(t){var p=t.split(':');return Number(p[0])*60+Number(p[1])}
function sitioNow(d){
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Asuncion',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  var get=function(t){for(var i=0;i<parts.length;i++){if(parts[i].type===t)return parts[i].value}return ''};
  return {dayKey:get('weekday').toLowerCase().slice(0,3),minutes:(Number(get('hour'))%24)*60+Number(get('minute'))};
}
function sitioOpenState(h,dayKey,m){
  if(!h||Object.keys(h).length===0)return null;
  var today=h[dayKey]||null;
  if(today){
    for(var i=0;i<today.length;i++){
      var s=sitioMin(today[i].open),e=today[i].close==='00:00'?1440:sitioMin(today[i].close);
      if(m>=s&&m<e)return {open:true,closesAt:today[i].close};
    }
    for(var j=0;j<today.length;j++){if(sitioMin(today[j].open)>m)return {open:false,opensAt:today[j].open,opensDay:null}}
  }
  var start=SITIO_ORDER.indexOf(dayKey);
  for(var step=1;step<=7;step++){
    var k=SITIO_ORDER[(start+step)%7],iv=h[k];
    if(iv&&iv.length>0)return {open:false,opensAt:iv[0].open,opensDay:SITIO_LABEL[k]||k};
  }
  return {open:false,opensAt:'',opensDay:null};
}
function sitioStatusText(st){
  if(!st)return null;
  if(st.open)return 'Abierto ahora · cierra '+st.closesAt;
  if(st.opensAt)return 'Cerrado · abre '+(st.opensDay?st.opensDay+' ':'')+st.opensAt;
  return 'Consultanos el horario por WhatsApp';
}`;
