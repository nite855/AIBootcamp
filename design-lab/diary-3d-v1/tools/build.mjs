import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, base), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const variants = JSON.parse(await read('design.json'));
const assetNames = ['pos_1','pos_2','pos_3','neg_1','neg_2','neg_3','neutral','heart','star'];
const assets = Object.fromEntries(await Promise.all(assetNames.map(async name => [name,
  'data:image/png;base64,' + (await readFile(new URL('assets/' + name + '.png', base))).toString('base64')
])));
const fonts = (await read('styles/base.css')).split('\n').filter(line => line.startsWith('@font-face')).join('\n');
const styles = fonts + '\n' + await read('styles/diary.css') + '\n' + await read('styles/themes.css') + '\n' + await read('styles/objects.css');
const domain = (await Promise.all(['core','diary-core','statistics','cards'].map(n => read('scripts/' + n + '.js')))).join('\n');
const views = await read('scripts/statistics-view.js') + '\n' + await read('scripts/catalog-view.js');
const app = (await read('scripts/app.js')).replace('/*__STATISTICS_VIEW__*/', () => views)
  .replace('/*__OBJECT_ASSETS__*/', () => JSON.stringify(assets));
const license = await read('docs/licenses/ibm-plex-sans-kr.txt');
for (const variant of variants) {
  let shell = await read('templates/shell.html');
  const theme = (await read('scripts/theme.js')).replace('/*__VARIANT__*/', () => JSON.stringify(variant));
  for (const [key, value] of Object.entries({STYLES:styles,THEME:safe(theme),DOMAIN:safe(domain),APP:safe(app)})) {
    const marker = '/*__' + key + '__*/';
    if (!shell.includes(marker)) throw new Error('Missing marker ' + key);
    shell = shell.replace(marker, () => value);
  }
  shell = shell.replace('Pastel Moment', variant.name).replace('</body>', () => '<script type="text/plain" id="embedded-font-license">' + safe(license) + '</script>\n</body>');
  await writeFile(new URL(variant.id + '.html', base), shell);
  console.log('Built ' + variant.id + '.html (' + Buffer.byteLength(shell) + ' bytes)');
}
