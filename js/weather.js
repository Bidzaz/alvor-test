/* Alvor · Weather from Open-Meteo.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
/* ---------- Weather ---------- */
async function fetchWeather(force){
  const s = state.settings;
  const fresh = state.weather && state.weather.current && (Date.now() - state.weather.at < 30*60*1000) && state.weather.lat === s.lat && state.weather.lon === s.lon;
  if(fresh && !force){ render(); return; }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}` +
    `&current=temperature_2m,weather_code,is_day,cloud_cover` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,weather_code,sunrise,sunset` +
    `&past_days=7&forecast_days=8&timezone=auto`;
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    state.weather = {at:Date.now(), lat:s.lat, lon:s.lon, daily:j.daily, current:j.current};
    saveLocal();
  }catch(e){ toast(tr("Couldn't load the forecast")); }
  render();
}
const ctx = () => ({settings:state.settings, daily:state.weather && state.weather.daily, today:today(), month:new Date().getMonth()+1, mode:"full"});
function wx(){ return state.weather ? GA.splitWeather(state.weather.daily, today()) : null; }
const waterStatus = (p, W) => GA.waterStatus(p, W, ctx());
const effMin = (p, d) => GA.effMin(p, d, state.settings);
const coldLimit = p => GA.coldLimit(p, state.settings);
const buildAlerts = () => GA.compute(state.plants, ctx());

/* Weather codes (WMO) to a sky type */
function sky(code){
  if(code == null) return "cloudy";
  if(code <= 1) return "clear";
  if(code === 2) return "partly";
  if(code === 3) return "cloudy";
  if(code === 45 || code === 48) return "fog";
  if((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if(code >= 95) return "storm";
  return "rain";
}
const WSUN = '<g><circle cx="12" cy="12" r="4.6" fill="#F4C048"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" stroke="#F4C048" stroke-width="1.8" stroke-linecap="round"/></g>';
const WMOON = '<path d="M16.5 14.8A6.5 6.5 0 0 1 9.2 5.5a6.5 6.5 0 1 0 7.3 9.3z" fill="#E6D48F"/>';
const WCLOUD = (x = 0, y = 0) => `<path transform="translate(${x} ${y})" d="M7.2 19h9.6a3.9 3.9 0 0 0 .5-7.8 5.4 5.4 0 0 0-10.4 1.2A3.3 3.3 0 0 0 7.2 19z" fill="#DCE4E8" stroke="#9FB0BA" stroke-width="1.3" stroke-linejoin="round"/>`;
function wIcon(code, day = true){
  const t = sky(code);
  const body =
    t === "clear" ? (day ? WSUN : WMOON) :
    t === "partly" ? `<g transform="translate(-3 -3) scale(.8)">${day ? WSUN : WMOON}</g>${WCLOUD(1.5, 1)}` :
    t === "cloudy" ? WCLOUD(0, -1) :
    t === "fog" ? `${WCLOUD(0, -3)}<path d="M4 19.5h16M6 22h12" stroke="#9FB0BA" stroke-width="1.5" stroke-linecap="round"/>` :
    t === "snow" ? `${WCLOUD(0, -4)}<g fill="#7FB0D8"><circle cx="8" cy="19.5" r="1.1"/><circle cx="12" cy="21.5" r="1.1"/><circle cx="16" cy="19.5" r="1.1"/></g>` :
    t === "storm" ? `${WCLOUD(0, -4)}<path d="M12.5 15.5 10 19.5h3l-1.8 3.5" stroke="#E0A93A" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` :
    `${WCLOUD(0, -4)}<path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" stroke="#6FA6D6" stroke-width="1.6" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 24 24" class="wi" aria-hidden="true">${body}</svg>`;
}
