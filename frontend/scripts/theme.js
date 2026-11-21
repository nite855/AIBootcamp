/* Display preferences only; runs before the first paint. */
(() => {
  "use strict";
  const themes = Object.freeze(window.CardexDesignThemes.map(Object.freeze));
  const prefix="moment-card:diary-simple-v3:", modeKey=prefix+"color-scheme", themeKey=prefix+"appearance";
  // Soft UI v1.1 (2026-11-20): one picker, each theme carries its own light/dark scheme.
  // Saved IDs from the previous 11-theme set move to the closest new theme.
  const LEGACY = Object.freeze({paper:"warm",retro:"warm",sunset:"warm",editorial:"clean",aurora:"glass",lemon:"candy",forest:"sage",starlight:"night",doodle:"grid"});
  const DEFAULT = "clean";
  const validTheme=v=>themes.some(t=>t.id===v);
  const migrate=v=>validTheme(v)?v:(validTheme(LEGACY[v])?LEGACY[v]:DEFAULT);
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  function persist(k,v){try{localStorage.setItem(k,v);}catch{/* Selection still works for this session. */}}
  // Card effects are always on (product decision 2026-11-19); the old card-motion key is ignored.
  const motion="on";
  const stored=read(themeKey);
  let theme=migrate(stored);
  if (stored && stored!==theme) persist(themeKey,theme);
  const scheme=()=>themes.find(t=>t.id===theme).scheme;
  function sync(){
    document.querySelectorAll('[name="appearance"]').forEach(c=>c.checked=c.value===theme);
  }
  function apply(){
    const resolved=scheme(), root=document.documentElement;
    root.dataset.appearance=theme;
    root.dataset.theme=resolved;
    root.dataset.motion=motion;
    root.style.colorScheme=resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themes.find(t=>t.id===theme).colors[0]);
    sync();window.dispatchEvent(new Event("cardex-theme-change"));
  }
  function setTheme(v){if(validTheme(v)){theme=v;persist(themeKey,v);apply();}}
  // Kept for callers of the old API: the scheme now follows the theme, and card effects stay on.
  function set(){}
  function setMotion(){}
  window.CardexTheme=Object.freeze({themes,legacy:LEGACY,defaultTheme:DEFAULT,migrate,sync,set,setTheme,setMotion,getMotion:()=>motion,getTheme:()=>theme,getPreference:scheme,getResolvedMode:()=>document.documentElement.dataset.theme});
  // The old light/dark preference is no longer read.
  try{localStorage.removeItem(modeKey);}catch{/* Nothing to clean up. */}
  window.addEventListener("storage",e=>{
    if(e.key===themeKey||e.key===null){theme=migrate(read(themeKey));apply();}
  });
  document.addEventListener("change",e=>{
    if(e.target.name==="appearance")setTheme(e.target.value);
  });
  apply();
})();
