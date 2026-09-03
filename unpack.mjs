import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const chunks = Array.from({ length: 7 }, (_, i) => fs.readFileSync(`bundle.${i}`, 'utf8').trim()).join('');
const files = JSON.parse(zlib.gunzipSync(Buffer.from(chunks, 'base64')).toString('utf8'));
for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}
console.log(`Restaurados ${Object.keys(files).length} arquivos do jogo completo.`);

// Injeta as ferramentas novas sem reescrever o frontend original.
const layouts=Object.keys(files).filter(f=>/layout\.(tsx|jsx|js|ts)$/.test(f));
let injected=false;
for(const file of layouts){
  let src=fs.readFileSync(file,'utf8');
  if(src.includes('/investigation-tools.js')){injected=true;continue;}
  if(src.includes('</body>')){
    src=src.replace('</body>','<script src="/investigation-tools.js" defer></script></body>');
    fs.writeFileSync(file,src,'utf8');
    console.log('Caderno avançado e painel de evidências ativados em',file);
    injected=true;
  }
}
if(!injected) console.warn('Layout não encontrado para ativar as ferramentas de investigação.');
