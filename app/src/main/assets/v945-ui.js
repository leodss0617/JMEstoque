(function(){
'use strict';if(window.__jm945)return;window.__jm945=true;
const el=id=>document.getElementById(id), bridge=()=>window.AndroidBridge;
let searchTimer;window.jmPendLimit=40;window.jm945BuscaPendentes=()=>{clearTimeout(searchTimer);window.jmPendLimit=40;searchTimer=setTimeout(()=>requestAnimationFrame(()=>renderPendentes()),140);};
const metrics={};window.jm945Metrics=metrics;
function measure(name,fn){const start=performance.now();const finish=()=>{metrics[name]={ms:+(performance.now()-start).toFixed(2),at:Date.now(),itens:document.querySelectorAll('#pend .card, #jm945Queue .card').length};};try{const result=fn();if(result&&typeof result.then==='function')return result.finally(finish);finish();return result;}catch(e){finish();throw e;}}
for(const name of ['show','renderDash','renderPendentes','gerarImgRelatorio']){
 const old=window[name];if(typeof old==='function')window[name]=function(...args){return measure(name==='show'?'aba:'+args[0]:name,()=>{const result=old.apply(this,args);if(name==='show'&&args[0]==='config')fillTotals();return result;});};
}
const stateKey='jm_delivery_sessions';
function read(){return JSON.parse(localStorage.getItem(stateKey)||'{"orders":[],"seen":{}}');}
function write(s){localStorage.setItem(stateKey,JSON.stringify(s));try{syncNuvemAuto();}catch(e){}}
let refreshFrame;function scheduleRefresh(){if(refreshFrame)return;refreshFrame=requestAnimationFrame(()=>{refreshFrame=null;refresh();});}
function launchDelivered(s){const pending=s.orders.filter(o=>o.status==='delivered'&&!o.registeredAt);if(!pending.length)return;let entries=loadLan(),original=entries;for(const o of pending)entries=JMEntregas.launch(o,entries);if(entries!==original){saveLanArr(entries);if(!storageOk)throw new Error('Histórico não persistido; libere espaço e tente novamente.');renderDash();}for(const o of pending)if(entries.some(e=>e.id==='delivery_'+o.id))o.registeredAt=Date.now();write(s);}
let lastAlert=-1,limit=30,busy=false;
function render(s){
 const box=el('jm945Queue');if(!box)return;box.replaceChildren();
 const orders=s.orders.filter(o=>!['delivered','cancelled'].includes(o.status));
 const count=orders.filter(o=>['ready','out_for_delivery'].includes(o.status)).length;
 el('jm945Alert').textContent=count?'🚚 '+count+' entrega(s) aguardando confirmação':'';
 if(count!==lastAlert){bridge()?.deliveryAlert?.(count);lastAlert=count;}
 for(const o of orders.slice(-limit).reverse()){
  const card=document.createElement('div');card.className='card';
  const description=document.createElement('p');description.textContent=`${o.quantity||'?'} ${o.product||'Produto não informado'} · ${o.customerName||'Cliente não informado'} · ${o.address||'Endereço não informado'} · ${o.paymentMethod||'Pagamento não informado'} · ${o.status}`;card.appendChild(description);
  const edit=document.createElement('details'), summary=document.createElement('summary');summary.textContent='Completar / corrigir pedido';edit.appendChild(summary);
  const fields={};for(const [key,label] of [['customerName','Cliente'],['address','Endereço'],['paymentMethod','Pagamento (pix, dinheiro, debito, credito)'],['quantity','Quantidade'],['product','Produto (Gás ou Água)']]){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.value=o[key]||'';l.appendChild(input);edit.appendChild(l);fields[key]=input;}
  const save=document.createElement('button');save.className='btn';save.textContent='Salvar informações';save.onclick=()=>{const current=read(),order=current.orders.find(x=>x.id===o.id);if(!order||['delivered','cancelled'].includes(order.status))return;
   const q=Number(fields.quantity.value),product=JMEntregas.normalize(fields.product.value),payment=JMEntregas.normalize(fields.paymentMethod.value);
   if(!Number.isSafeInteger(q)||q<=0||!['gas','agua'].includes(product)||!['pix','dinheiro','debito','credito'].includes(payment)){toast('Confira produto, quantidade e pagamento.','err');return;}
   Object.assign(order,{quantity:q,product:product==='gas'?'Gás':'Água',paymentMethod:payment,customerName:fields.customerName.value.trim(),address:fields.address.value.trim()});order.status=JMEntregas.missing(order).length?'waiting_info':'ready';write(current);render(current);
  };edit.appendChild(save);card.appendChild(edit);
  const miss=JMEntregas.missing(o);if(miss.length){const p=document.createElement('p');const labels={product:'produto',quantity:'quantidade',customerName:'cliente',address:'endereço',paymentMethod:'pagamento'};p.textContent='Falta: '+miss.map(k=>labels[k]).join(', ');card.appendChild(p);}
  const raw=document.createElement('p');raw.textContent=o.rawMessages.map(m=>m.text).join(' / ');card.appendChild(raw);
  for(const [label,status] of [['Saiu para entrega','out_for_delivery'],['Confirmar entrega','delivered'],['Cancelar','cancelled']]){
   const b=document.createElement('button');b.className='btn';b.textContent=label;b.disabled=status!=='cancelled'&&miss.length>0;
   b.onclick=async()=>{if(!await jmConfirm(label+' de '+(o.customerName||'cliente')+'?',label))return;
    const current=read(),order=current.orders.find(x=>x.id===o.id);if(!order||['delivered','cancelled'].includes(order.status))return;
    order.status=status;if(status==='delivered')order.deliveryConfirmedAt=Date.now();write(current);launchDelivered(current);render(current);
   };card.appendChild(b);
  }box.appendChild(card);
 }
 if(orders.length>limit){const b=document.createElement('button');b.textContent='Mostrar mais';b.onclick=()=>{limit+=30;render(read());};box.appendChild(b);}
 metrics.itensFila={total:orders.length,renderizados:Math.min(limit,orders.length)};
}
function refresh(){if(busy)return;busy=true;try{measure('processarNotificacao',()=>{
 let snapshot=bridge()?.monitorSnapshot?JSON.parse(bridge().monitorSnapshot()):null;
 const s=read();if(snapshot){
  for(const e of snapshot.events)JMEntregas.accept(s,e,{business:snapshot.business});
  if(snapshot.events.length){write(s);bridge().monitorAck(JSON.stringify(snapshot.events.map(e=>e.id)));}
  el('jm945Status').textContent=snapshot.access?'🟢 Observação de notificações ativa':'🔴 Acesso às notificações desligado';
  if(!snapshot.enabled)el('jm945Status').textContent+=' · pausada em Config';
  el('jm945Enabled').checked=snapshot.enabled;el('jm945Business').checked=snapshot.business;
  if(document.activeElement!==el('jm945Title'))el('jm945Title').value=snapshot.title;
  const date=n=>n?new Date(n).toLocaleString():'Nunca';
  el('jm945Diagnostic').textContent=`Acesso concedido: ${snapshot.access}\nListener conectado: ${snapshot.connected}\nÚltima conexão: ${date(snapshot.lastConnection)}\nÚltima desconexão: ${date(snapshot.lastDisconnection)}\nÚltima notificação WhatsApp: ${date(snapshot.lastNotification)}\nRemetente/conversa: ${snapshot.lastConversation||'—'}\nEventos (${snapshot.day}): ${snapshot.captured}\nDuplicados: ${snapshot.duplicates}\nCaptura nativa: ${snapshot.processingMs} ms\nÚltimo erro: ${snapshot.lastError||s.lastError||'Nenhum'}`;
 }
 launchDelivered(s);render(s);
});}catch(e){el('jm945Diagnostic').textContent='Erro local: '+e.message;}finally{busy=false;}}
const config=el('configWhatsApp');const card=document.createElement('div');card.className='card';card.id='jm945Monitor';
card.innerHTML='<h3>Observação local</h3><p id="jm945Status"></p><label><input type="checkbox" id="jm945Enabled"> Ativar observação do WhatsApp normal</label><label><input type="checkbox" id="jm945Business"> Incluir WhatsApp Business</label><label>Contato/número exibido na notificação<input id="jm945Title"></label><button class="btn" id="jm945Save">Salvar observação</button><button class="btn" id="jm945Access">Abrir acesso às notificações</button><details><summary>Diagnóstico da observação</summary><pre id="jm945Diagnostic" style="white-space:pre-wrap"></pre><button class="btn" id="jm945Refresh">Atualizar diagnóstico</button><button class="btn" id="jm945Test">Testar parser com exemplos sintéticos</button><pre id="jm945TestOut" style="white-space:pre-wrap"></pre><pre id="jm945Perf" style="white-space:pre-wrap"></pre></details>';
config.appendChild(card);
const style=document.createElement('style');style.textContent='#jm945Alert:not(:empty){position:sticky;bottom:0;padding:12px;background:#92400e;color:white;font-weight:bold;z-index:20} #jm945Queue .card{box-shadow:none}';document.head.appendChild(style);
el('jm945Access').onclick=()=>bridge()?.openWhatsAppMonitorSettings();
el('jm945Save').onclick=()=>{bridge()?.monitorConfigure(el('jm945Enabled').checked,el('jm945Business').checked,el('jm945Title').value);refresh();};
el('jm945Refresh').onclick=()=>{refresh();el('jm945Perf').textContent=JSON.stringify(metrics,null,2);};
el('jm945Test').onclick=()=>{const s={orders:[],seen:{}};['1 gás','na casa','Luciana','pix','1 gas portao pix','gas do povo casa Maria dinheiro'].forEach((text,i)=>JMEntregas.accept(s,{id:'test'+i,packageName:'com.whatsapp',conversationId:'synthetic',sender:'Teste',timestamp:Date.now()+i*1000,text}));el('jm945TestOut').textContent=JSON.stringify(s.orders,null,2);};
const queue=document.createElement('div');queue.id='jm945Queue';el('lan').appendChild(queue);
const alert=document.createElement('div');alert.id='jm945Alert';alert.setAttribute('role','status');document.body.appendChild(alert);
const totals=document.createElement('div');totals.className='card';totals.innerHTML='<h3>📦 Total físico do estoque</h3><label>Total físico de Gás (13kg)<input id="jm945Gas" type="number" min="0" step="1"></label><label>Total físico de Água (20L)<input id="jm945Water" type="number" min="0" step="1"></label><button class="btn" id="jm945Totals">Salvar totais físicos</button>';
el('configEstoque').prepend(totals);
function fillTotals(){const current=calc();el('jm945Gas').value=current.totG;el('jm945Water').value=current.totA;}
fillTotals();el('jm945Totals').onclick=async()=>{
 const values=[el('jm945Gas').value,el('jm945Water').value];if(values.some(x=>x.trim()===''||!Number.isSafeInteger(Number(x))||Number(x)<0)){toast('Informe inteiros maiores ou iguais a zero.','err');return;}
 const [gas,water]=values.map(Number);if(!await jmConfirm(`Alterar total físico para Gás ${gas} e Água ${water}? Lançamentos e pendências serão preservados.`,'Confirmar ajuste'))return;
 const c=loadCfg(),current=calc();const changes=[['Gás','totGas',gas,current.totG],['Água','totAgua',water,current.totA]].filter(([,k,v,previous])=>previous!==v);
 c.physicalTotalAdjustments=c.physicalTotalAdjustments||[];for(const [product,key,value,previous] of changes){c.physicalTotalAdjustments.push({at:new Date().toISOString(),product,previous,value,origin:'Config v9.4.5'});c[key]=Number(c[key])+value-previous;}
 saveCfgObj(c);fillTotals();fillCfgUI();renderDash();toast('Totais físicos salvos.','ok');
};
window.addEventListener('jm:notifications',scheduleRefresh);window.addEventListener('jm:resume',()=>{fillTotals();refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){fillTotals();refresh();}});
refresh();
})();
