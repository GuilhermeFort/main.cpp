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

const copies=[
  ['overrides/gemini.ts','lib/gemini.ts','Motor Gemini avançado aplicado.'],
  ['overrides/learning.ts','lib/learning.ts','Pipeline teacher/student aplicado.'],
  ['overrides/student.ts','lib/student.ts','Executor shadow da IA própria aplicado.'],
  ['overrides/psychology.ts','lib/psychology.ts','Psicologia persistente aplicada.'],
  ['overrides/learning-route.ts','app/api/ai-learning/route.ts','API interna de aprendizado ativada.'],
  ['overrides/investigation-state-route.ts','app/api/investigation-state/route.ts','API de evidências/timeline/hipóteses ativada.'],
  ['overrides/world-route.ts','app/api/world-state/route.ts','API de mapa, digital, câmeras, mural e jurídico ativada.'],
  ['overrides/messages-route.ts','app/api/messages/route.ts','Memória isolada por personagem e aprendizado automático ativados.']
];
for(const [src,dst,msg] of copies){if(fs.existsSync(src)){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);console.log(msg)}}

const layouts=Object.keys(files).filter(f=>/layout\.(tsx|jsx|js|ts)$/.test(f));
let injected=false;
for(const file of layouts){
  let src=fs.readFileSync(file,'utf8');
  const scripts='<script src="/investigation-tools.js" defer></script><script src="/investigation-task-patch.js" defer></script><script src="/investigation-world.js" defer></script>';
  if(src.includes('/investigation-tools.js')){injected=true;
    if(!src.includes('/investigation-task-patch.js'))src=src.replace('<script src="/investigation-tools.js" defer></script>','<script src="/investigation-tools.js" defer></script><script src="/investigation-task-patch.js" defer></script>');
    if(!src.includes('/investigation-world.js'))src=src.replace('</body>','<script src="/investigation-world.js" defer></script></body>');
    fs.writeFileSync(file,src,'utf8');
  } else if(src.includes('</body>')){
    src=src.replace('</body>',scripts+'</body>');
    fs.writeFileSync(file,src,'utf8');
    injected=true;
  }
}
if(!injected) console.warn('Layout não encontrado para ativar as ferramentas de investigação.');
if(fs.existsSync('overrides')) fs.rmSync('overrides',{recursive:true,force:true});
