'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
process.env.TZ='America/Fortaleza';
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
let now=new Date('2026-09-28T23:59:00-03:00').getTime(), timers=[], listeners={}, cfg={mostrarChatLancamentos:false}, writes=0;
const original=[{id:'ontem',data:'2026-09-27',prod:'Gás',cliente:'ONTEM'}, {id:'hojeG',data:'2026-09-28',hora:'23:59',prod:'Gás',cliente:'HOJE_G'}, {id:'hojeA',data:'2026-09-28',prod:'Água',cliente:'HOJE_A'}, {id:'futuro',data:'2026-09-30',prod:'Água',cliente:'FUTURO'}];
const snapshot=JSON.stringify(original),els=new Map();
function el(id){if(!els.has(id))els.set(id,{style:{},classList:{add(){},remove(){}},children:[],appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];}});return els.get(id);}
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const ctx=vm.createContext({console,Date:Clock,document:{getElementById:el,createElement:()=>({}),visibilityState:'visible',addEventListener:(e,fn)=>listeners[e]=fn},loadLan:()=>original,loadCfg:()=>({...cfg}),saveCfgObj:c=>{cfg={...c};writes++;},isEmpRecebido:()=>false,isEmpDevolver:()=>false,isGas:p=>p==='Gás',calc:()=>({operacionalGas:{}}),show(){},setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{timers=timers.filter(x=>x!==t);},setInterval:(fn,ms)=>{listeners.poll=fn;},addEventListener:(e,fn)=>listeners[e]=fn});
ctx.window=ctx;
function run(s){return vm.runInContext(s,ctx);}
run(html.slice(html.indexOf('function todayStr(){'),html.indexOf('async function zerarLancamentos(){')));
run(html.slice(html.indexOf('function closeModal(val){'),html.indexOf('function toast(')));
run(html.slice(html.indexOf("let _filtroListaProd ="),html.indexOf('async function delLan(')));
run(fs.readFileSync('app/src/main/assets/operacional-ui.js','utf8'));
let passed=0,failed=0;
async function test(name,fn){try{await fn();console.log('OK '+(++passed)+' '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function counts(a,g,w){const s=el('listaLan').innerHTML;assert(s.includes(`Todos (${a})`));assert(s.includes(`Gás (${g})`));assert(s.includes(`Água (${w})`));assert.equal(a,g+w);}
(async()=>{
 await test('Dia local exclui ontem/futuro, inclui 23:59 mesmo com UTC no dia seguinte',()=>{ctx.renderLista();counts(2,1,1);assert(!el('listaLan').innerHTML.includes('ONTEM'));assert(!el('listaLan').innerHTML.includes('FUTURO'));assert(el('listaLan').innerHTML.includes('HOJE_G'));});
 await test('Exclusão preserva índice do histórico completo',()=>{ctx.setFiltroLista('gas');assert(el('listaLan').innerHTML.includes('delLan(1)'));counts(2,1,1);ctx.setFiltroLista('todos');});
 await test('Inicialização agenda meia-noite local',()=>{assert(html.includes('src="historico-hoje.js"'));run(fs.readFileSync('app/src/main/assets/historico-hoje.js','utf8'));assert(timers.some(t=>t.ms===60000));counts(2,1,1);});
 await test('Virada à meia-noite zera todos os filtros sem apagar histórico',()=>{now=new Date('2026-09-29T00:00:00-03:00').getTime();const timer=timers.find(t=>t.ms===60000);assert(timer);timer.fn();counts(0,0,0);for(const f of ['gas','agua','todos']){ctx.setFiltroLista(f);counts(0,0,0);}assert.equal(JSON.stringify(original),snapshot);assert.equal(writes,0);});
 await test('Retorno, reabertura e entrada na aba atualizam a data',()=>{for(const event of ['visibilitychange','pageshow','focus','jm:resume']){now=new Date('2026-09-28T12:00:00-03:00').getTime();assert(listeners[event]);listeners[event]();counts(2,1,1);now=new Date('2026-09-29T12:00:00-03:00').getTime();listeners[event]();counts(0,0,0);}now=new Date('2026-09-28T12:00:00-03:00').getTime();ctx.show('lan');counts(2,1,1);});
 await test('Mudança manual de data com app aberto é detectada',()=>{now=new Date('2026-09-29T10:00:00-03:00').getTime();assert(listeners.poll);listeners.poll();counts(0,0,0);});
 await test('Botão compacto pede confirmação; cancelar não grava',async()=>{assert(html.includes('onclick="jmConfirmarMostrarChat()"'));const p=ctx.jmConfirmarMostrarChat();assert.equal(el('modalTitle').textContent,'Mostrar Chat de Lançamentos?');assert.equal(el('modalMsg').textContent,'O chat ocupa mais espaço na aba Lançar. Deseja realmente exibi-lo agora?');assert.deepEqual(el('modalBtns').children.slice(-2).map(x=>x.textContent),['Cancelar','Mostrar chat']);assert.equal(cfg.mostrarChatLancamentos,false);assert.equal(writes,0);ctx.closeModal(false);await p;assert.equal(writes,0);assert.equal(el('chatLancamentos').style.display,'none');});
 await test('Confirmar exibe e persiste sem alterar lançamentos ou fila',async()=>{const before=JSON.stringify(original),queue=JSON.stringify(el('jm92QueueCard'));const p=ctx.jmConfirmarMostrarChat();assert.equal(cfg.mostrarChatLancamentos,false);ctx.closeModal(true);await p;assert.equal(cfg.mostrarChatLancamentos,true);assert.equal(writes,1);assert.equal(el('chatLancamentos').style.display,'');run(fs.readFileSync('app/src/main/assets/operacional-ui.js','utf8'));assert.equal(el('mostrarChatCompacto').hidden,true);assert.equal(JSON.stringify(original),before);assert.equal(JSON.stringify(el('jm92QueueCard')),queue);});
 console.log(`${passed} aprovados; ${failed} falhas`);process.exitCode=failed?1:0;
})();
