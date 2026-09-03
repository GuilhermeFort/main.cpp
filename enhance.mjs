import fs from 'node:fs';
import path from 'node:path';

const candidates=[];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(p); else if(/layout\.(tsx|jsx|js|ts)$/.test(entry.name)) candidates.push(p);
  }
}
walk('app'); walk('src/app');
let patched=false;
for(const file of candidates){
  let src=fs.readFileSync(file,'utf8');
  if(src.includes('/investigation-tools.js')){patched=true;continue}
  if(src.includes('</body>')){
    src=src.replace('</body>','<script src="/investigation-tools.js" defer></script></body>');
    fs.writeFileSync(file,src,'utf8');
    console.log('Ferramentas de investigação injetadas em',file);
    patched=true;
  }
}
if(!patched) console.warn('Aviso: layout não localizado para injeção das ferramentas.');
