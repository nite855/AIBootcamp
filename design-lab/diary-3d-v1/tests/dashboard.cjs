const {execFileSync}=require('node:child_process');
for (const variant of ['lemon','gray']) {
  console.log('Dashboard checks:',variant);
  execFileSync(process.execPath,[require('node:path').join(__dirname,'dashboard-variant.cjs')],{stdio:'inherit',env:{...process.env,MOMENT_VARIANT:variant}});
}
