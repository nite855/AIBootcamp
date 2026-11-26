const {execFileSync}=require('node:child_process');
for (const variant of ['lemon','gray']) {
  console.log('Browser checks:',variant);
  execFileSync(process.execPath,[require('node:path').join(__dirname,'browser-variant.cjs')],{stdio:'inherit',env:{...process.env,MOMENT_VARIANT:variant}});
}
