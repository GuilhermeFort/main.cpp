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
