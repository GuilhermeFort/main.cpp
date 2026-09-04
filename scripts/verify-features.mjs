import fs from 'node:fs';

const checks=[
  ['lib/gemini.ts',['gemini-3.6-flash','generateContent','thinkingLevel','generateMystery','answerMystery','clueKeys','revealedByClueKeys']],
  ['lib/case.ts',['defaultWorld','quarto-1209','celular-rafael','camera-corredor-12','clueKeys','revealedByClueKeys']],
  ['lib/psychology.ts',['character_states','character_player_relations','loadPlayerRelation','relationForPrompt','admittedFacts']],
  ['lib/learning.ts',['ai_training_examples','ai_memory_items']],
  ['lib/student.ts',['runStudentShadow','ai_evaluations']],
  ['app/api/messages/route.ts',['answerMystery','runStudentShadow','loadPlayerRelation','evolvePlayerRelation','ascending: false']],
  ['app/api/investigation-state/route.ts',['evidence_items','timeline_events','hypotheses','investigation_tasks','player_private_notes','cancel_task']],
  ['app/api/world-state/route.ts',['case_locations','digital_devices','digital_artifacts','surveillance_cameras','camera_events','investigation_board_nodes','legal_requests','case_assessments','trial_sessions','search_location','extract_device','review_camera','prosecutor_review','validEvidence','caseClosure','revealedByClueKeys']],
  ['public/investigation-tools.js',['Evidências','Timeline','Hipóteses','Perícias','Custódia','EVIDÊNCIA APRESENTADA AO DEPOENTE']],
  ['public/investigation-world.js',['Mapa/Busca','Digital','Câmeras','Mural','Autorizações','Promotor/Tribunal','extract_device','review_camera','search_location','prosecutor_review','trial']],
  ['public/investigation-task-patch.js',['Enviar à Central']]
];
let failed=false;
for(const [file,needles] of checks){
  if(!fs.existsSync(file)){console.error(`FALTA: ${file}`);failed=true;continue}
  const src=fs.readFileSync(file,'utf8');
  for(const needle of needles){if(!src.includes(needle)){console.error(`FALTA RECURSO em ${file}: ${needle}`);failed=true}}
}
if(failed){process.exit(1)}
console.log(`Verificação de recursos OK: ${checks.length} arquivos críticos validados.`);
