/* Display preferences only; runs before the first paint. */
(() => {
  "use strict";
  const themes = Object.freeze(window.CardexDesignThemes.map(Object.freeze));
  const prefix="moment-card:diary-simple-v3:", modeKey=prefix+"color-scheme", themeKey=prefix+"appearance", motionKey=prefix+"card-motion";
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const validMode=v=>["system","light","dark"].includes(v), validTheme=v=>themes.some(t=>t.id===v), validMotion=v=>["on","off"].includes(v);
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  let preference=validMode(read(modeKey))?read(modeKey):"light", theme=validTheme(read(themeKey))?read(themeKey):"lemon", motion=validMotion(read(motionKey))?read(motionKey):"on";
  function sync(){
    document.querySelectorAll('[name="appearance"]').forEach(c=>c.checked=c.value===theme);
    document.querySelectorAll('[name="color-mode"]').forEach(c=>c.checked=c.value===preference);
    document.querySelectorAll('[data-card-motion-toggle]').forEach(c=>{
      c.setAttribute("aria-pressed",String(motion==="on"));
      c.textContent=motion==="on"?"카드 효과 켜짐":"카드 효과 꺼짐";
    });
    const control=document.getElementById("theme-preference");if(control)control.value=preference;
  }
  function apply(){
    const resolved=preference==="system"?(media.matches?"dark":"light"):preference;
    document.documentElement.dataset.appearance=theme;
    document.documentElement.dataset.theme=resolved;
    document.documentElement.dataset.motion=motion;
    document.documentElement.style.colorScheme=resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themes.find(t=>t.id===theme)[resolved][0]);
    sync();window.dispatchEvent(new Event("cardex-theme-change"));
  }
  function persist(k,v){try{localStorage.setItem(k,v);}catch{/* Selection still works for this session. */}}
  function set(v){if(validMode(v)){preference=v;persist(modeKey,v);apply();}}
  function setTheme(v){if(validTheme(v)){theme=v;persist(themeKey,v);apply();}}
  function setMotion(v){if(validMotion(v)){motion=v;persist(motionKey,v);apply();}}
  window.CardexTheme=Object.freeze({themes,sync,set,setTheme,setMotion,getMotion:()=>motion,getTheme:()=>theme,getPreference:()=>preference,getResolvedMode:()=>document.documentElement.dataset.theme});
  media.addEventListener("change",()=>{if(preference==="system")apply();});
  window.addEventListener("storage",e=>{
    if(e.key===modeKey||e.key===null)preference=validMode(read(modeKey))?read(modeKey):"light";
    if(e.key===themeKey||e.key===null)theme=validTheme(read(themeKey))?read(themeKey):"lemon";
    if(e.key===motionKey||e.key===null)motion=validMotion(read(motionKey))?read(motionKey):"on";
    if([modeKey,themeKey,motionKey,null].includes(e.key))apply();
  });
  document.addEventListener("change",e=>{
    if(e.target.name==="appearance")setTheme(e.target.value);
    if(e.target.name==="color-mode"||e.target.id==="theme-preference")set(e.target.value);
  });
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-card-motion-toggle]"))setMotion(motion==="on"?"off":"on");
  });
  apply();
})();
