'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
for(const [,attrs,code] of scripts) new vm.Script(code,{filename:attrs||'main'});
const op=require('../app/src/main/assets/operacional.js');
let count=0;
function test(name,fn){fn();console.log('OK '+(++count)+' '+name);}
for(const [gc,gs,emp,livres,uso,empUso,falta] of [
 [10,17,0,17,0,0,0],[0,17,0,17,0,0,0],[-8,17,0,9,8,0,0],
 [-17,17,0,0,17,0,0],[-20,17,5,0,17,3,0],[-25,17,5,0,17,5,3]
]) test(`cobertura ${gc}/${gs}/${emp}`,()=>{
 const s=op.calcular(gc,gs,emp);
 assert.deepEqual([s.separadosLivres,s.usandoSeparados,s.emprestadosEmUso,s.faltaCobertura],[livres,uso,empUso,falta]);
});
function node(){return {value:'',style:{},checked:false,children:[],textContent:'',innerHTML:'',
 querySelectorAll:()=>[],querySelector:()=>null,replaceChildren(){this.children=[];},
 appendChild(x){this.children.push(x);},insertAdjacentHTML(){},remove(){},setAttribute(){},removeAttribute(){},scrollIntoView(){}};}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
const store=new Map([['jm_v84_ready','1']]);
const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size;}};
const drawings=[];
let canvas;
const ctx=new Proxy({measureText:t=>({width:t.length*7}),fillText:(...args)=>drawings.push(args)}, {get:(o,k)=>o[k]||(()=>{})});
const document={getElementById:get,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},
 createElement:tag=>tag==='canvas'?(canvas={getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test'}):node()};
const sandbox={console,document,localStorage,JMOperacional:op,setTimeout(){},requestAnimationFrame(){},
 toast(){},jmAlert(){},jmSuccess:async()=>{},renderLista(){},renderPendentes(){},renderDash(){},show(){},saveCfg(){},updateEstoqueHints(){},syncNuvemAuto(){}};
sandbox.window=sandbox;
const c=vm.createContext(sandbox);
function run(code){return vm.runInContext(code,c);}
function script(id){return scripts.find(([a])=>a.includes('"'+id+'"'))[2];}
run(html.slice(html.indexOf("const LOGO_JM="),html.indexOf('let _modalResolve=')));
run(html.slice(html.indexOf('function norm(s)'),html.indexOf('function calc(){')));
run(html.slice(html.indexOf('function renderDash(){'),html.indexOf('function syncProd(){')));
run(html.slice(html.indexOf('let _ultimoRelatorioImgData'),html.indexOf('function compartilharRelatorioImg(){')));
// Motor de pendências real, motor de estoque real e correção de água real.
run(script('jm-v81-summary-fix'));
run(script('jm-v84-core'));
run(script('jm-v85-water-fix'));
run(fs.readFileSync('app/src/main/assets/operacional-ui.js','utf8'));
function lan(id,tipo,qtd,extra={}){return {id:'l_'+id+'_test',tipo,qtd,prod:'Gás',data:'2026-09-28',...extra};}
function setup(gc=-8,empG=0){
 const ls=[lan(1,'Separar',17,{cliente:'Maria'})];
 store.set('jm_cfg',JSON.stringify({gc,ac:30,totGas:203,totAgua:50,empG,mostrarChatLancamentos:true}));
 store.set('jm_lan',JSON.stringify(ls));store.set('jm_v84_base_ids',JSON.stringify(['id:l_1_test']));
}
function add(x){sandbox.saveLanArr([x,...sandbox.loadLan()]);}
test('v945 totais físicos zero persistem sem fallback e sem apagar histórico',()=>{
 setup();const before=store.get('jm_lan');const cfg=sandbox.loadCfg();cfg.totGas=0;cfg.totAgua=0;sandbox.saveCfgObj(cfg);
 assert.equal(sandbox.loadCfg().totGas,0);assert.equal(sandbox.loadCfg().totAgua,0);
 assert.equal(sandbox.calc().totG,0);assert.equal(sandbox.calc().totA,0);assert.equal(store.get('jm_lan'),before);
});
test('v945 totais físicos persistem em nova leitura e backup/restauração',()=>{
 setup();const cfg=sandbox.loadCfg();cfg.totGas=205;cfg.totAgua=51;sandbox.saveCfgObj(cfg);
 const backup=JSON.stringify(Object.fromEntries(store));store.clear();for(const [k,v]of Object.entries(JSON.parse(backup)))store.set(k,v);
 assert.equal(sandbox.calc().totG,205);assert.equal(sandbox.calc().totA,51);
});
test('Caso A: entrada reduz déficit uma vez; histórico-base intacto',()=>{
 setup();add(lan(2,'Chegou carga',5));const s=sandbox.calc();
 assert.equal(s.gc,-3);assert.equal(s.operacionalGas.separadosLivres,14);assert.equal(s.totG,203);
 assert.equal(s.gc+s.gs+s.gv,s.totG);
});
test('Caso B: entradas não duplicam unidades e não quitam empréstimo',()=>{
 setup(-20,5);assert.equal(sandbox.calc().operacionalGas.emprestadosEmUso,3);
 add(lan(2,'Chegou carga',5));let s=sandbox.calc();
 assert.equal(s.gc,-15);assert.equal(s.operacionalGas.separadosLivres,2);assert.equal(s.empG,5);
 add(lan(3,'Chegou carga',20));s=sandbox.calc();assert.equal(s.gc,5);assert.equal(s.empG,5);
});
test('Empréstimo recebido/devolvido: ordem inversa, dívida e total próprio',()=>{
 setup(-20);add(lan(2,'Empréstimo recebido',5));add(lan(3,'Devolver empréstimo',2));
 const s=sandbox.calc();assert.equal(s.empG,3);assert.equal(s.gc,-20);assert.equal(s.totG,203);
 assert.equal(s.operacionalGas.emprestadosEmUso,3);
});
test('Devolução acima do saldo e exclusão de recebimento são rejeitadas atomicamente',()=>{
 const antes=store.get('jm_lan');assert.throws(()=>add(lan(4,'Devolver empréstimo',4)));
 assert.equal(store.get('jm_lan'),antes);
 assert.throws(()=>sandbox.saveLanArr(sandbox.loadLan().filter(x=>x.tipo!=='Empréstimo recebido')));
 assert.equal(store.get('jm_lan'),antes);
});
test('Chat persiste após releitura; esconder não remove parser/campos/WhatsApp',()=>{
 sandbox.jmMostrarChat(false);assert.equal(JSON.parse(store.get('jm_cfg')).mostrarChatLancamentos,false);
 assert.equal(get('chatLancamentos').style.display,'none');assert.equal(get('mostrarChatCompacto').hidden,false);
 run(fs.readFileSync('app/src/main/assets/operacional-ui.js','utf8'));
 assert.equal(get('optMostrarChat').checked,false);assert.equal(get('jm92QueueCard').style.display,undefined);
 sandbox.jmMostrarChat(true);assert.equal(get('chatLancamentos').style.display,'');
});
test('Água: 23 pendentes menos 2 já vazios = 21 separados cheios',()=>{
 setup();const l=sandbox.loadLan();l.push(lan(7,'Separar',21,{prod:'Água',cliente:'Maria'}),lan(8,'Separar',1,{prod:'Água',cliente:'Luciana',sepContaVazio:true}),lan(9,'Separar',1,{prod:'Água',cliente:'Denis',sepContaVazio:true}));sandbox.saveLanArr(l);
 const s=sandbox.calc();assert.equal(s.as,21);assert.equal(s.aguaSepBruto,23);assert.equal(s.aguaSepJaVazio,2);
});
test('Resumo e relatório real desenham o mesmo saldo e aviso',()=>{
 setup();sandbox.renderDash();assert.match(get('dash').innerHTML,/kpi-tile-val">9<\/div>/);
 drawings.length=0;sandbox.gerarImgRelatorio();
 assert(drawings.some(x=>x[0]==='SEPARADOS DISPONÍVEIS'));
 assert(drawings.some(x=>x[0]==='9'));assert(drawings.some(x=>x[0]==='Usando separados: 8'));
 assert(drawings.some(x=>String(x[0]).includes('Estoque cheio negativo')));
 assert(drawings.every(x=>x[2]<canvas.height));
});
test('Relatório mostra empréstimos e falta de cobertura',()=>{
 setup(-25,5);drawings.length=0;sandbox.gerarImgRelatorio();
 assert(drawings.some(x=>x[0]==='Emprestados em uso: 5'));
 assert(drawings.some(x=>String(x[0]).includes('Faltam 3 botijões')));
 assert(drawings.every(x=>x[2]<canvas.height));
});
test('Devolução para empresa não cria pendência de vazio de cliente',()=>{
 setup();add(lan(2,'Empréstimo recebido',5,{empresa:'Fornecedor'}));add(lan(3,'Devolver empréstimo',2,{empresa:'Fornecedor'}));
 assert(!sandbox.calcPendentes().some(x=>x.nome==='Fornecedor'));
});
test('Backup inclui preferência, saldo, histórico e checkpoint sem perda',()=>{
 sandbox.JM_CLOUD_PASS_KEY='password';sandbox.JM_CLOUD_ENABLED_KEY='enabled';sandbox.JM_CLOUD_STAMP_KEY='stamp';sandbox.JM_DEVICE_KEY='device';
 run(html.slice(html.indexOf('function collectBackup(){'),html.indexOf('function backupJson(){')));
 sandbox.jmMostrarChat(false);const backup=sandbox.collectBackup();
 assert.equal(backup.cfg.mostrarChatLancamentos,false);assert.equal(backup.lan.length,3);
 assert.equal(backup.extras.jm_v84_base_ids,store.get('jm_v84_base_ids'));
 const before=JSON.stringify(sandbox.calc());
 store.set('jm_cfg',JSON.stringify(backup.cfg));store.set('jm_lan',JSON.stringify(backup.lan));
 assert.equal(JSON.stringify(sandbox.calc()),before);
});
test('Defaults seguros e saldo negativo não é zerado',()=>{
 setup(-8);const cfg=JSON.parse(store.get('jm_cfg'));delete cfg.mostrarChatLancamentos;delete cfg.empG;store.set('jm_cfg',JSON.stringify(cfg));
 assert.equal(sandbox.loadCfg().mostrarChatLancamentos,true);assert.equal(sandbox.calc().empG,0);assert.equal(sandbox.calc().gc,-8);
});
test('v945 entrega local afeta estoque uma vez somente após confirmação',()=>{
 setup();const api=require('../app/src/main/assets/entregas.js'),state={orders:[],seen:{}};
 const event=(id,text)=>({id,text,timestamp:Date.now(),conversationId:'teste',sender:'Entregador',packageName:'com.whatsapp'});
 const before=sandbox.calc().gc;api.accept(state,event('pedido','1 gás casa Maria pix'));
 sandbox.saveLanArr(api.launch(state.orders[0],sandbox.loadLan()));assert.equal(sandbox.calc().gc,before);
 api.accept(state,event('confirmacao','entregue'));sandbox.saveLanArr(api.launch(state.orders[0],sandbox.loadLan()));assert.equal(sandbox.calc().gc,before-1);
 sandbox.saveLanArr(api.launch(state.orders[0],sandbox.loadLan()));assert.equal(sandbox.calc().gc,before-1);
});
(async()=>{
 setup(-20);add(lan(2,'Empréstimo recebido',5));sandbox.fillInicioFromCalc();
 get('iGC').value='-18';await sandbox.saveCfg();
 test('Salvar Início consolida saldo emprestado sem reaplicar histórico',()=>{
  assert.equal(sandbox.calc().empG,5);assert.equal(sandbox.calc().gc,-18);
  assert.equal(sandbox.loadLan().length,2);
 });
 // Executa o parser e o controlador WhatsApp reais, com rede exclusivamente simulada.
 run(script('jm-v86-chat'));sandbox.jmConfirm=async()=>true;sandbox.setInterval=()=>{};
 let draft={id:'pedido-teste',status:'awaiting_delivery',quantity:1,product:'Gás',customer_name:'João',payment:'Pix',raw_messages:[{body:'1 gás'},{body:'na casa de João'},{body:'pix'}]};
 const requests=[];
 sandbox.fetch=async(url,opts)=>{
  const body=opts.body?JSON.parse(opts.body):null;if(body)requests.push(body);
  if(body?.action==='mark_registered')draft.status='registered';
  return {ok:true,text:async()=>JSON.stringify({drafts:draft.status==='registered'?[]:[draft]})};
 };
 run(script('jm-v92-whatsapp-cloud'));
 const before=store.get('jm_lan');await sandbox.jm92Launch('pedido-teste');
 test('WhatsApp awaiting_delivery não altera estoque nem registra pedido',()=>{
  assert.equal(store.get('jm_lan'),before);assert(!requests.some(x=>x.action==='mark_registered'));
 });
 draft.status='delivered';sandbox.jmMostrarChat(false);const gc=sandbox.calc().gc;
 await sandbox.jm92Launch('pedido-teste');
 test('WhatsApp delivered lança com chat oculto, depois marca registered',()=>{
  assert.equal(sandbox.calc().gc,gc-1);assert.equal(draft.status,'registered');
  assert.equal(requests.filter(x=>x.action==='mark_registered').length,1);
  assert.equal(get('chatLancamentos').style.display,'none');
 });
 draft.status='delivered'; // servidor pode repetir se a confirmação HTTP se perdeu
 await sandbox.jm92Launch('pedido-teste');
 test('Pedido já registrado não é relançado pela fila',()=>assert.equal(sandbox.calc().gc,gc-1));
 get('fFraseZap').value='devolver 1 gás emprestado para empresa';
 const emp=sandbox.calc().empG;await sandbox.interpretarFraseZap(true);
 test('Chat distingue devolução à empresa de devolução pelo cliente',()=>assert.equal(sandbox.calc().empG,emp-1));
 console.log(`${count} testes aprovados; scripts inline compilam em JavaScript.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
