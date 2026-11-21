const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
// Prefer the browser matching this Playwright installation. Explicit overrides win.
const executablePath=process.env.CARDEX_CHROMIUM || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
module.exports={executablePath};
