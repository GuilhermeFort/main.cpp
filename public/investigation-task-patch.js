(()=>{
  const STORE='detetives-investigation-tools-v2';
  const session=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}').session||null}catch{return null}};
  const composer=()=>[...document.querySelectorAll('textarea,input[type="text"],[contenteditable="true"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>120&&r.height>20&&r.bottom>0&&r.top<innerHeight}).sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0]||null;
  const put=text=>{const el=composer();if(!el)return false;el.focus();if(el.isContentEditable){el.textContent=text;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}))}else{const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;setter?setter.call(el,text):el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}return true};
  const refresh=()=>document.querySelector('#inv-tools-panel [data-sync]')?.click();
  function relabel(){document.querySelectorAll('[data-complete-task]').forEach(b=>{b.textContent='🧪 Enviar à Central';b.title='A Central executará a tarefa e registrará o resultado oficial.'})}
  new MutationObserver(relabel).observe(document.documentElement,{subtree:true,childList:true});relabel();
  document.addEventListener('click',async ev=>{
    const complete=ev.target.closest?.('[data-complete-task]');
    if(complete){ev.preventDefault();ev.stopImmediatePropagation();const id=complete.dataset.completeTask;if(!put(`[TAREFA DE INVESTIGAÇÃO #${id}]\nCentral, execute a tarefa registrada e retorne somente o resultado que possa ser obtido de forma coerente com as evidências e a verdade fixa do caso.`)){alert('Abra uma conversa e tente novamente.')}return;}
    const cancel=ev.target.closest?.('[data-cancel-task]');
    if(cancel){ev.preventDefault();ev.stopImmediatePropagation();const s=session();if(!s)return;try{const r=await fetch('/api/investigation-state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:s.code,playerId:s.playerId,action:'cancel_task',id:Number(cancel.dataset.cancelTask)})});if(!r.ok)throw new Error();refresh()}catch{alert('Não foi possível cancelar a tarefa.')}}
  },true);
})();
