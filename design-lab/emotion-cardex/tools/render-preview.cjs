// Render route markup without model/network access for design extraction and smoke checks.
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const base=path.resolve(__dirname,'..');
function render(route,options={}){
  const element={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  const document={title:'',getElementById:()=>element,querySelectorAll:()=>[],querySelector:()=>null};
  const location={search:'?preview='+route,hash:'#start'};const window={document,location,addEventListener(){},scrollY:0,scrollTo(){}};
  const context={window,document,location,history:{replaceState(){}},console,URLSearchParams,requestAnimationFrame:fn=>fn(),TextDecoder};context.globalThis=window;
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(base,'scripts/core.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(base,'scripts/app.js'),'utf8'),context);
  window.CardexApp.preview(route,options);return {html:element.innerHTML,state:window.CardexApp.getState()};
}
if(require.main===module){const route=process.argv[2]||'overview';process.stdout.write(render(route,{parentId:process.argv[3]||null}).html);}else module.exports={render};
