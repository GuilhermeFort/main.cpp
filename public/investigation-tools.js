(()=>{
  const STORE='detetives-investigation-tools-v1';
  const state=JSON.parse(localStorage.getItem(STORE)||'{"notes":[],"evidence":[],"theory":"","open":false}');
  const save=()=>localStorage.setItem(STORE,JSON.stringify(state));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const style=document.createElement('style');
  style.textContent=`
  #inv-tools-btn{position:fixed;right:18px;bottom:18px;z-index:99999;border:1px solid #6e5f47;background:#15130f;color:#f4e8cc;border-radius:999px;padding:12px 16px;font:700 13px system-ui;box-shadow:0 10px 30px #0008;cursor:pointer}
  #inv-tools-panel{position:fixed;right:18px;bottom:72px;z-index:99998;width:min(410px,calc(100vw - 24px));max-height:78vh;overflow:auto;background:#11100d;color:#eee3cc;border:1px solid #5d513d;border-radius:16px;box-shadow:0 24px 70px #000b;display:none;font-family:system-ui,sans-serif}
  #inv-tools-panel.open{display:block} .inv-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #332d23;position:sticky;top:0;background:#11100df5;backdrop-filter:blur(8px)}
  .inv-head b{font-size:14px;letter-spacing:.08em}.inv-head button,.inv-tab,.inv-small{background:#201c16;color:#e9dcc1;border:1px solid #4c4232;border-radius:9px;padding:8px 10px;cursor:pointer}.inv-body{padding:14px}.inv-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.inv-tab.active{background:#6a5635;color:#fff}
  .inv-section{display:none}.inv-section.active{display:block}.inv-input,.inv-textarea{width:100%;box-sizing:border-box;background:#0b0a08;color:#f3ead6;border:1px solid #40372a;border-radius:10px;padding:10px 11px;outline:none}.inv-textarea{min-height:112px;resize:vertical}.inv-row{display:flex;gap:8px;margin-top:8px}.inv-row>*{flex:1}.inv-card{border:1px solid #3b3328;background:#17140f;border-radius:11px;padding:10px;margin:8px 0}.inv-card small{opacity:.65}.inv-card-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.inv-danger{color:#ffb6a7}.inv-muted{opacity:.65;font-size:12px}.inv-evidence-pick{max-height:200px;overflow:auto}.inv-chip{display:inline-block;border:1px solid #544834;border-radius:999px;padding:5px 8px;margin:3px;font-size:11px;cursor:pointer;background:#19150f}.inv-quick{display:grid;grid-template-columns:1fr 1fr;gap:7px}.inv-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;background:#17140f;color:#fff0d0;border:1px solid #5d513d;border-radius:10px;padding:10px 14px;box-shadow:0 8px 24px #0009;font:600 12px system-ui}
  @media(max-width:600px){#inv-tools-panel{right:12px;bottom:68px;max-height:75vh}#inv-tools-btn{right:12px;bottom:12px}.inv-quick{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const panel=document.createElement('div'); panel.id='inv-tools-panel';
  const btn=document.createElement('button'); btn.id='inv-tools-btn'; btn.textContent='🗒️ Caderno';
  document.body.append(panel,btn);

  const toast=t=>{const x=document.createElement('div');x.className='inv-toast';x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),1800)};
  const findComposer=()=>{
    const candidates=[...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>120&&r.height>20&&r.bottom>0&&r.top<innerHeight;});
    return candidates.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0]||null;
  };
  const insertChat=text=>{const el=findComposer();if(!el){toast('Abra uma conversa primeiro.');return false}el.focus();if(el.isContentEditable){el.textContent=text;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}else{const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;setter?setter.call(el,text):el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}toast('Texto colocado no interrogatório.');return true};

  const scanEvidence=()=>{
    const texts=[...document.querySelectorAll('article,section,li,button,div')].map(x=>(x.innerText||'').trim()).filter(t=>t.length>=18&&t.length<=500);
    const keys=['pista','evidência','evidencia','laudo','relatório','relatorio','registro','perícia','pericia','foto','câmera','camera','extrato','digital','dna','toxicológico','toxicológico','mensagem'];
    const found=[];
    for(const t of texts){if(keys.some(k=>t.toLowerCase().includes(k))&&!found.some(x=>x===t))found.push(t)}
    return found.slice(0,30);
  };

  const addNote=(text,tag='nota')=>{if(!text.trim())return;state.notes.unshift({id:crypto.randomUUID(),text:text.trim(),tag,done:false,at:Date.now()});save();render();};
  const addEvidence=text=>{text=text.trim();if(!text||state.evidence.includes(text))return;state.evidence.unshift(text);save();render();toast('Evidência adicionada.');};
  const presentEvidence=text=>insertChat(`[EVIDÊNCIA APRESENTADA AO DEPOENTE]\n${text}\n\nExplique especificamente como esta evidência se relaciona com o que você acabou de afirmar. Se ela contradiz sua versão, responda à contradição.`);
  const quick=q=>insertChat(q);

  function render(){
    panel.classList.toggle('open',!!state.open);
    panel.innerHTML=`<div class="inv-head"><b>ARQUIVO DO DETETIVE</b><button data-close>Fechar</button></div><div class="inv-body">
      <div class="inv-tabs"><button class="inv-tab active" data-tab="notes">Notas</button><button class="inv-tab" data-tab="evidence">Evidências</button><button class="inv-tab" data-tab="theory">Teoria</button><button class="inv-tab" data-tab="quick">Ações</button></div>
      <section class="inv-section active" data-sec="notes"><textarea class="inv-textarea" id="inv-new-note" placeholder="Escreva uma hipótese, contradição, horário, álibi..."></textarea><div class="inv-row"><button class="inv-small" data-add-note>Salvar nota</button><button class="inv-small" data-add-clue>Marcar como pista</button></div><div>${state.notes.map(n=>`<div class="inv-card"><small>${esc(n.tag)} • ${new Date(n.at).toLocaleString()}</small><div style="margin-top:5px;white-space:pre-wrap">${esc(n.text)}</div><div class="inv-card-actions"><button class="inv-small" data-use-note="${n.id}">Usar no chat</button><button class="inv-small inv-danger" data-del-note="${n.id}">Excluir</button></div></div>`).join('')||'<p class="inv-muted">Nenhuma nota ainda.</p>'}</div></section>
      <section class="inv-section" data-sec="evidence"><p class="inv-muted">Colete uma evidência abaixo ou use uma já salva. Ao apresentar uma prova, o suspeito será confrontado com ela — mas só deve ceder se for uma evidência real do caso.</p><div class="inv-row"><button class="inv-small" data-scan>Encontrar evidências na tela</button></div><div id="inv-scan" class="inv-evidence-pick"></div>${state.evidence.map((e,i)=>`<div class="inv-card"><div style="white-space:pre-wrap">${esc(e)}</div><div class="inv-card-actions"><button class="inv-small" data-present="${i}">⚖️ Apresentar prova</button><button class="inv-small" data-note-e="${i}">Adicionar às notas</button><button class="inv-small inv-danger" data-del-e="${i}">Remover</button></div></div>`).join('')||'<p class="inv-muted">Nenhuma evidência salva.</p>'}<textarea class="inv-textarea" id="inv-manual-e" placeholder="Cole aqui o texto de uma pista/evidência..."></textarea><button class="inv-small" style="margin-top:8px" data-save-e>Salvar evidência</button></section>
      <section class="inv-section" data-sec="theory"><p class="inv-muted">Monte sua teoria. Ela fica salva neste dispositivo.</p><textarea class="inv-textarea" id="inv-theory" placeholder="Suspeito, motivo, método, oportunidade, contradições...">${esc(state.theory)}</textarea><div class="inv-row"><button class="inv-small" data-save-theory>Salvar teoria</button><button class="inv-small" data-use-theory>Confrontar com teoria</button></div></section>
      <section class="inv-section" data-sec="quick"><div class="inv-quick"><button class="inv-small" data-q="Refaça sua linha do tempo completa, com horários aproximados e diga como sabe cada horário.">🕒 Linha do tempo</button><button class="inv-small" data-q="Qual é exatamente o seu álibi? Quem ou o que pode confirmar sua versão de forma independente?">🛡️ Testar álibi</button><button class="inv-small" data-q="Você mudou ou omitiu alguma parte do seu depoimento anterior? Quero que corrija agora qualquer detalhe que tenha dito errado.">⚠️ Contradições</button><button class="inv-small" data-q="Separe o que você viu pessoalmente do que apenas ouviu de outras pessoas ou está supondo.">👁️ Fato x rumor</button><button class="inv-small" data-q="Quem tinha motivo para mentir sobre isso e por quê? Não acuse por opinião: diga apenas fatos que você presenciou.">🧩 Relações</button><button class="inv-small" data-q="Quero uma resposta curta e direta: o que você está escondendo de mim que não necessariamente tem relação com o crime?">🔒 Segredo secundário</button></div></section>
    </div>`;
    bind();
  }
  function bind(){
    panel.querySelector('[data-close]')?.addEventListener('click',()=>{state.open=false;save();render()});
    panel.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{panel.querySelectorAll('.inv-tab').forEach(x=>x.classList.remove('active'));panel.querySelectorAll('.inv-section').forEach(x=>x.classList.remove('active'));b.classList.add('active');panel.querySelector(`[data-sec="${b.dataset.tab}"]`)?.classList.add('active')}));
    panel.querySelector('[data-add-note]')?.addEventListener('click',()=>addNote(panel.querySelector('#inv-new-note').value,'nota'));
    panel.querySelector('[data-add-clue]')?.addEventListener('click',()=>{const v=panel.querySelector('#inv-new-note').value;addNote(v,'pista');addEvidence(v)});
    panel.querySelectorAll('[data-del-note]').forEach(b=>b.onclick=()=>{state.notes=state.notes.filter(n=>n.id!==b.dataset.delNote);save();render()});
    panel.querySelectorAll('[data-use-note]').forEach(b=>b.onclick=()=>{const n=state.notes.find(n=>n.id===b.dataset.useNote);if(n)insertChat(n.text)});
    panel.querySelector('[data-scan]')?.addEventListener('click',()=>{const box=panel.querySelector('#inv-scan');box.innerHTML=scanEvidence().map((t,i)=>`<button class="inv-chip" data-found="${i}">${esc(t.slice(0,120))}${t.length>120?'…':''}</button>`).join('')||'<p class="inv-muted">Não encontrei cartões de evidência visíveis nesta tela.</p>';const vals=scanEvidence();box.querySelectorAll('[data-found]').forEach(b=>b.onclick=()=>addEvidence(vals[Number(b.dataset.found)]))});
    panel.querySelector('[data-save-e]')?.addEventListener('click',()=>addEvidence(panel.querySelector('#inv-manual-e').value));
    panel.querySelectorAll('[data-present]').forEach(b=>b.onclick=()=>presentEvidence(state.evidence[Number(b.dataset.present)]));
    panel.querySelectorAll('[data-note-e]').forEach(b=>b.onclick=()=>addNote(state.evidence[Number(b.dataset.noteE)],'evidência'));
    panel.querySelectorAll('[data-del-e]').forEach(b=>b.onclick=()=>{state.evidence.splice(Number(b.dataset.delE),1);save();render()});
    panel.querySelector('[data-save-theory]')?.addEventListener('click',()=>{state.theory=panel.querySelector('#inv-theory').value;save();toast('Teoria salva.');});
    panel.querySelector('[data-use-theory]')?.addEventListener('click',()=>{state.theory=panel.querySelector('#inv-theory').value;save();insertChat(`Minha teoria atual é a seguinte:\n${state.theory}\n\nQuero que você responda apenas às partes que envolvem fatos que você realmente conhece. Não aceite minha teoria como verdadeira só porque eu a apresentei.`)});
    panel.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>quick(b.dataset.q));
  }
  btn.onclick=()=>{state.open=!state.open;save();render()};
  render();
})();
