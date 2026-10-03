'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const nodes=new Map(),store=new Map(),listeners=new Map();
function node(){return {children:[],value:'',textContent:'',checked:false,appendChild(n){this.children.push(n);return n;},prepend(n){this.children.unshift(n);},replaceChildren(){this.children=[];},setAttribute(){}};}
const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
let cfg={totGas:203,totAgua:50},entries=[],acks=0,writes=0,frames=[];
const api=require('../app/src/main/assets/entregas.js');
const snapshot={events:[],enabled:true,business:false,title:'Teste',access:true};
const s={JMEntregas:api,console,Date,JSON,performance,storageOk:true,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 document:{getElementById:el,createElement:node,head:node(),body:node(),querySelectorAll:()=>[],addEventListener:(k,v)=>listeners.set('doc:'+k,v)},
 addEventListener:(k,v)=>{assert(!listeners.has(k),'listener duplicado');listeners.set(k,v);},
 requestAnimationFrame:f=>{frames.push(f);return frames.length;},setTimeout,clearTimeout,
 calc:()=>({totG:cfg.totGas,totA:cfg.totAgua}),loadCfg:()=>({...cfg}),saveCfgObj:c=>{cfg=c;},loadLan:()=>entries,saveLanArr:e=>{entries=e;writes++;},
 jmConfirm:async()=>true,toast(){},fillCfgUI(){},renderDash(){},renderPendentes(){},show(){},gerarImgRelatorio(){},syncNuvemAuto(){},
 AndroidBridge:{monitorSnapshot:()=>JSON.stringify(snapshot),monitorAck:()=>acks++,deliveryAlert(){}}};
s.window=s;vm.createContext(s);const code=fs.readFileSync('app/src/main/assets/v945-ui.js','utf8');vm.runInContext(code,s);vm.runInContext(code,s);
assert.equal(el('configWhatsApp').children.length,1);assert.equal(el('configEstoque').children.length,1);
assert.equal(listeners.size,3);console.log('OK inicialização repetida sem cards/listeners duplicados');
snapshot.events=[{id:'one',text:'gas casa Maria pix',timestamp:100000,packageName:'com.whatsapp',conversationId:'x',sender:'x'}];
listeners.get('jm:notifications')();listeners.get('jm:notifications')();assert.equal(frames.length,1);frames.shift()();
assert.equal(entries.length,0);assert.equal(el('jm945Queue').children.length,1);assert.equal(acks,1);console.log('OK eventos coalescidos, pedido persistido antes de ack sem venda');
el('jm945Refresh').onclick();assert.equal(el('jm945Queue').children.length,1);console.log('OK rerender sem duplicar pedido');
snapshot.events=[{id:'two',text:'entregue',timestamp:101000,packageName:'com.whatsapp',conversationId:'x',sender:'x'}];
el('jm945Refresh').onclick();el('jm945Refresh').onclick();assert.equal(entries.length,1);assert.equal(writes,1);console.log('OK confirmação repetida persiste uma única venda');
(async()=>{const original=entries;el('jm945Gas').value='0';el('jm945Water').value='21';await el('jm945Totals').onclick();assert.equal(cfg.totGas,0);assert.equal(cfg.totAgua,21);assert.equal(cfg.physicalTotalAdjustments.length,2);assert.equal(entries,original);console.log('OK ajuste confirmado registra auditoria e preserva histórico');})().catch(e=>{console.error(e);process.exitCode=1;});
