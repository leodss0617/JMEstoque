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

test('Balanço físico próprio',()=>{setup();const o=sandbox.calc().operacionalGas;assert.equal(o.physicalFull,0);assert.equal(o.yardEmpty,194);assert.equal(o.physicalOwnTotal,203);drawings.length=0;sandbox.gerarImgRelatorio();assert(drawings.some(x=>String(x[0]).includes('0 cheios + 9 separados livres + 194 vazios')));});
const pendentesReais=sandbox.calcPendentes;
test('Preferências independentes, entregas reais e calendário local',()=>{
 setup();const dia=sandbox.todayStr();store.set('jm_lan',JSON.stringify([
 lan(11,'Entrega',2,{data:dia,prod:'Água',cliente:'Maria',pag:'PIX',hora:'09:00'}),
 lan(12,'Entrega',1,{data:dia,prod:'Gás do Povo',cliente:'Carlos',pag:'Dinheiro',hora:'10:00'}),
 lan(13,'Entrega',1,{data:dia,cliente:'',endereco:'Rua Proibida',pag:'-',hora:'11:00'}),
 lan(14,'Separar',3,{data:dia,cliente:'Reserva'}),lan(15,'Entrega',1,{data:'2000-01-01',cliente:'Antigo'})]));
 sandbox.calcPendentes=()=>[{nome:'Reserva',sepGas:3},{nome:'Devedor',faltaVazioAgua:2}];
 for(const sep of [false,true])for(const vazio of [false,true])for(const lista of [false,true]){
  const cfg=sandbox.loadCfg();Object.assign(cfg,{relSep:sep,relVazio:vazio,relLan:lista});sandbox.saveCfgObj(cfg);
  drawings.length=0;sandbox.gerarImgRelatorio();const txt=drawings.map(x=>x[0]).join('\n');
  assert.equal(txt.includes('FALTAM ENTREGAR'),sep);assert.equal(txt.includes('FALTA DE DEVOLVER'),vazio);assert.equal(txt.includes('ENTREGAS DE HOJE'),lista);
  if(lista){assert(txt.includes('Maria — 2 Água 20L — PIX'));assert(txt.includes('Carlos — 1 Gás do Povo — Dinheiro'));assert(txt.includes('Cliente não informado — 1 Gás GLP 13kg — Não informado'));}
  assert(!txt.includes('Rua Proibida'));assert(!txt.includes('Antigo'));assert(drawings.every(x=>x[2]<canvas.height));
 }
});
test('Salvar opções/cores não altera estoque; recarregar mantém valores',()=>{
 setup();const antes=sandbox.calc().gc;
 for(const id of ['optSep','optVazio','optLan'])get(id).checked=false;
 for(const id of ['iCorGas','iCorAgua','iCorHeader','iCorFundo'])get(id).value='#123456';
 sandbox.salvarPreferenciasRelatorio();
 sandbox.salvarPreferenciasRelatorio('cores');
 run(html.slice(html.indexOf('function fillCfgUI(){'),html.indexOf('function setRelTema(')));
 sandbox.fillCfgUI();assert.equal(get('optLan').checked,false);assert.equal(get('iCorGas').value,'#123456');assert.equal(sandbox.calc().gc,antes);
 run('memCfg=null');assert.equal(sandbox.loadCfg().relSep,false);assert.equal(sandbox.loadCfg().corFundo,'#123456');
});
test('Compartilhar e baixar preservam a prévia com opções atuais',()=>{
 run(html.slice(html.indexOf('function compartilharRelatorioImg(){'),html.indexOf('function gerarRelPendentes(){')));
 sandbox.AndroidBridge={saveReport:()=> 'content://report/test',shareReport(uri){assert.equal(uri,'content://report/test');}};
 document.createElement=(tag)=>tag==='canvas'?(canvas={getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test'}):{click(){},style:{}};
 for(const enabled of [false,true]){
  const cfg=sandbox.loadCfg();cfg.relSep=enabled;sandbox.saveCfgObj(cfg);drawings.length=0;sandbox.gerarImgRelatorio();
  assert.equal(drawings.some(x=>String(x[0]).includes('FALTAM ENTREGAR')),enabled);
  const expected=JSON.stringify(drawings);
  for(const method of ['compartilharRelatorioImg','baixarRelatorioImg']){
   sandbox[method]();assert.equal(JSON.stringify(drawings),expected);
  }
 }
});
test('Déficit além dos separados não aumenta pátio pelo empréstimo',()=>{
 sandbox.calcPendentes=pendentesReais;setup(-25,5);const s=sandbox.calc();assert.equal(s.gv,203);assert.equal(s.operacionalGas.physicalOwnTotal,203);assert.equal(s.operacionalGas.borrowedInUse,5);assert.equal(s.operacionalGas.uncoveredDeficit,3);
});
test('Entregas ordenadas, sem ID repetido, separado confirmado incluído',()=>{
 const data=sandbox.todayStr();const a=lan(31,'Entrega',1,{data,hora:'12:00',cliente:'B'});
 store.set('jm_lan',JSON.stringify([a,lan(32,'Entregar separado',2,{data,hora:'09:00',cliente:'A'}),a,lan(33,'Separar',2,{data,hora:'08:00'})]));
 const entregas=sandbox.entregasRelatorioHoje();assert.equal(entregas.length,2);assert.equal(entregas[0].cliente,'A');assert.equal(entregas[1].cliente,'B');
});
