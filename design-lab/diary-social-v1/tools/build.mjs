import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(resolve(base,p),'utf8');
const [shell,fonts,css,themes,theme,core,app]=await Promise.all([read('templates/shell.html'),read('styles/fonts.css'),read('styles/styles.css'),read('styles/themes.css').then(async t=>t+'\n'+await read('styles/social.css')+'\n'+await read('styles/diary.css')),read('scripts/theme.js'),read('scripts/core.js'),read('scripts/app.js')]);
const safeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const social=await read('scripts/social.js');
const diary=await read('scripts/diary.js');
const integratedApp=app.replace('/*__SOCIAL__*/',()=>social).replace('/*__DIARY__*/',()=>diary);
const diaryCore=await read('scripts/diary-core.js');
const html=shell.replace('/*__CARDEX_THEME__*/',()=>safeScript(theme)).replace('/*__CARDEX_CSS__*/',()=>fonts+'\n'+css+'\n'+themes).replace('/*__CARDEX_CORE__*/',()=>safeScript(core+'\n'+diaryCore)).replace('/*__CARDEX_APP__*/',()=>safeScript(integratedApp));
await writeFile(resolve(base,'index.html'),html);
console.log('Built standalone design-lab/diary-social-v1/index.html ('+Buffer.byteLength(html)+' bytes)');


