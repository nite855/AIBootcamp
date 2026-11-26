/* Display preferences only; runs before the first paint. */
(() => {
  "use strict";
  const variant = /*__VARIANT__*/;
  const themes = Object.freeze([Object.freeze(variant)]);
  const prefix="moment-card:diary-3d-v1:"+variant.id+":", modeKey=prefix+"color-scheme", themeKey=prefix+"appearance";
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const validMode=v=>["system","light","dark"].includes(v), validTheme=v=>themes.some(t=>t.id===v);
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  let preference=validMode(read(modeKey))?read(modeKey):"light", theme=validTheme(read(themeKey))?read(themeKey):variant.id;
  // The registry supplies both root colors and isolated settings previews.
  const style=document.createElement("style");
  style.textContent=themes.flatMap(t=>["light","dark"].map(mode=>{
    const [paper,surface,ink,muted,accent,onAccent,stage,line]=t[mode];
    return `:root[data-appearance="${t.id}"][data-theme="${mode}"],.theme-preview[data-appearance="${t.id}"][data-theme="${mode}"]{--paper:${paper};--surface:${surface};--ink:${ink};--muted:${muted};--blue:${accent};--on-accent:${onAccent};--stage:${stage};--line:${line};--tint:${surface};--error:${mode==="dark"?"#ffb4c4":"#a12b43"};--positive:${mode==="dark"?"#7bd6c1":"#227466"};--negative:${mode==="dark"?"#ffac8e":"#b34424"};--pos_1:${mode==="dark"?"#7bd6c1":"#227466"};--pos_2:${mode==="dark"?"#bbd89c":"#527842"};--pos_3:${mode==="dark"?"#8cd4ed":"#417d9b"};--neg_1:${mode==="dark"?"#cfb3ff":"#8068b3"};--neg_2:${mode==="dark"?"#a4ccff":"#417da7"};--neg_3:${mode==="dark"?"#ffb4c4":"#c34b52"};--neutral:${mode==="dark"?"#b7c7db":"#596b80"};}`;
  })).join("\n");
  document.head.append(style);
  function sync(){
    document.querySelectorAll('[name="appearance"]').forEach(c=>c.checked=c.value===theme);
    document.querySelectorAll('[name="color-mode"]').forEach(c=>c.checked=c.value===preference);
    const control=document.getElementById("theme-preference");if(control)control.value=preference;
  }
  function apply(){
    const resolved=preference==="system"?(media.matches?"dark":"light"):preference;
    document.documentElement.dataset.appearance=theme;
    document.documentElement.dataset.theme=resolved;
    document.documentElement.style.colorScheme=resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themes.find(t=>t.id===theme)[resolved][0]);
    sync();window.dispatchEvent(new Event("cardex-theme-change"));
  }
  function persist(k,v){try{localStorage.setItem(k,v);}catch{/* Selection still works for this session. */}}
  function set(v){if(validMode(v)){preference=v;persist(modeKey,v);apply();}}
  function setTheme(v){if(validTheme(v)){theme=v;persist(themeKey,v);apply();}}
  window.CardexTheme=Object.freeze({themes,sync,set,setTheme,getTheme:()=>theme,getPreference:()=>preference,getResolvedMode:()=>document.documentElement.dataset.theme});
  media.addEventListener("change",()=>{if(preference==="system")apply();});
  window.addEventListener("storage",e=>{
    if(e.key===modeKey||e.key===null)preference=validMode(read(modeKey))?read(modeKey):"light";
    if(e.key===themeKey||e.key===null)theme=validTheme(read(themeKey))?read(themeKey):variant.id;
    if([modeKey,themeKey,null].includes(e.key))apply();
  });
  document.addEventListener("change",e=>{
    if(e.target.name==="appearance")setTheme(e.target.value);
    if(e.target.name==="color-mode"||e.target.id==="theme-preference")set(e.target.value);
  });
  apply();
})();
