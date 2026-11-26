/* Runs in <head> before first paint. Only the display preference is persisted. */
(function () {
  'use strict';
  const key='moment-card:tcg-social-studio:color-scheme';
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const valid=value=>['system','light','dark'].includes(value);
  let preference='system';
  try {const saved=localStorage.getItem(key);if(valid(saved))preference=saved;} catch { /* Storage may be disabled. Keep an in-memory preference. */ }
  function sync(){const control=document.getElementById('theme-preference');if(control)control.value=preference;}
  function apply(){
    const resolved=preference==='system'?(media.matches?'dark':'light'):preference;
    document.documentElement.dataset.theme=resolved;
    document.documentElement.style.colorScheme=resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#101725':'#f6f3ea');
    sync();
  }
  function set(value){
    if(!valid(value))return;
    preference=value;
    try {if(value==='system')localStorage.removeItem(key);else localStorage.setItem(key,value);} catch { /* Theme still works without persistence. */ }
    apply();
  }
  media.addEventListener('change',()=>{if(preference==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=valid(event.newValue)?event.newValue:'system';apply();}});
  document.addEventListener('change',event=>{if(event.target.id==='theme-preference')set(event.target.value);});
  window.CardexTheme=Object.freeze({sync,set,getPreference:()=>preference});
  apply();
})();

