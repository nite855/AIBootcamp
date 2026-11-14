import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function backupGenerated() {
  for (const relative of ['index.html','styles/generated/tokens.css','scripts/generated/theme-tokens.js']) {
    const source=new URL('../'+relative,import.meta.url);
    let bytes;
    try { bytes=await readFile(source); } catch(error) { if(error.code==='ENOENT') continue; throw error; }
    const rel=path.relative(root,fileURLToPath(source)), parsed=path.parse(rel);
    const directory=path.join(root,'.backups',parsed.dir);
    await mkdir(directory,{recursive:true});
    const prefix=parsed.name+'.v', suffix=parsed.ext;
    const numbers=(await readdir(directory)).filter(n=>n.startsWith(prefix) && n.endsWith(suffix))
      .map(n=>Number(n.slice(prefix.length,suffix ? -suffix.length : undefined))).filter(Number.isInteger);
    const destination=path.join(directory,`${prefix}${String(Math.max(0,...numbers)+1).padStart(3,'0')}${suffix}`);
    await writeFile(destination,bytes,{flag:'wx'});
    const hash=b=>createHash('sha256').update(b).digest('hex');
    if(hash(bytes)!==hash(await readFile(destination))) throw Error('Backup verification failed: '+rel);
  }
}
