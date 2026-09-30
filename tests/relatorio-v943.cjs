'use strict';
const source=require('fs').readFileSync(__dirname+'/relatorio-v942.cjs','utf8');
const scenarios=String.raw`
const rects=[];
ctx.roundRect=(...args)=>rects.push(args);
function render943(){drawings.length=0;rects.length=0;sandbox.gerarImgRelatorio();return drawings.map(x=>x[0]).join('\n');}
sandbox.calcPendentes=pendentesReais;
test('v943: bloco operacional condicional em todos os cenários',()=>{
 for(const [gc,emp,expected] of [[20,0,false],[-8,0,true],[-20,5,true],[20,5,true],[-25,0,true]]){
  setup(gc,emp);const txt=render943();assert.equal(txt.includes('CONTROLE OPERACIONAL'),expected);
 }
});
test('v943: nova chave ausente é false, sem modificar demais preferências',()=>{
 setup(20);const before=store.get('jm_cfg');assert.equal(sandbox.loadCfg().reportShowSalesPayments,false);
 assert(!render943().includes('VENDAS E PAGAMENTOS'));assert.equal(store.get('jm_cfg'),before);
});
test('v943: salvar conteúdo e cores são independentes',()=>{
 setup();get('optSalesPayments').checked=true;get('iCorGas').value='#abcdef';
 sandbox.salvarPreferenciasRelatorio();assert.equal(sandbox.loadCfg().reportShowSalesPayments,true);assert.equal(sandbox.loadCfg().corGas,'#C62828');
 get('optSalesPayments').checked=false;sandbox.salvarPreferenciasRelatorio('cores');
 assert.equal(sandbox.loadCfg().reportShowSalesPayments,true);assert.equal(sandbox.loadCfg().corGas,'#abcdef');
});
test('v943: contexto novo carrega vendas e pagamentos e todas as opções persistidas',()=>{
 for(const enabled of [true,false]){
  get('optSalesPayments').checked=enabled;sandbox.salvarPreferenciasRelatorio();
  const fresh=vm.createContext({localStorage,document,window:{},updateEstoqueHints(){}});
  vm.runInContext(html.slice(html.indexOf('const LOGO_JM='),html.indexOf('let _modalResolve=')),fresh);
  vm.runInContext(html.slice(html.indexOf('function fillCfgUI(){'),html.indexOf('function setRelTema(')),fresh);
  vm.runInContext('fillCfgUI()',fresh);
  assert.equal(get('optSalesPayments').checked,enabled);
  assert.equal(vm.runInContext('loadCfg().reportShowSalesPayments',fresh),enabled);
  assert.equal(render943().includes('VENDAS E PAGAMENTOS'),enabled);
 }
});
test('v943: prévia, download e compartilhamento têm a mesma composição',()=>{
 for(const enabled of [false,true]){
  const cfg=sandbox.loadCfg();cfg.reportShowSalesPayments=enabled;sandbox.saveCfgObj(cfg);
  render943();const expected=JSON.stringify(drawings),height=canvas.height;
  for(const action of ['baixarRelatorioImg','compartilharRelatorioImg']){
   sandbox[action]();assert.equal(JSON.stringify(drawings),expected);assert.equal(canvas.height,height);
  }
 }
});
test('v943: margens 8, intervalos 8, altura exata e nomes longos sem corte',()=>{
 setup(-25,5);const cfg=sandbox.loadCfg();Object.assign(cfg,{reportShowSalesPayments:true,relSep:true,relVazio:true,relLan:true});sandbox.saveCfgObj(cfg);
 sandbox.calcPendentes=()=>[{nome:'Cliente '+('NomeMuitoLongo'.repeat(20)),sepGas:4,faltaVazioAgua:2}];
 store.set('jm_lan',JSON.stringify([lan(80,'Entrega',2,{data:sandbox.todayStr(),cliente:'Entrega confirmada',pag:'PIX'})]));
 render943();const outer=rects.filter(r=>r[0]===8&&r[2]===824);
 assert(outer.length>=7);assert.equal(outer[0][1],8);
 for(let i=1;i<outer.length;i++)assert.equal(outer[i][1]-(outer[i-1][1]+outer[i-1][3]),8);
 assert.equal(canvas.height-(outer.at(-1)[1]+outer.at(-1)[3]),40);
 assert(drawings.every(d=>d[2]<canvas.height));
 const long=drawings.filter(d=>String(d[0]).includes('NomeMuito'));
 assert(long.length>2);assert(long.every(d=>ctx.measureText(d[0]).width<=736));
 const allHeight=canvas.height;cfg.reportShowSalesPayments=false;sandbox.saveCfgObj(cfg);render943();assert.equal(allHeight-canvas.height,158);
});
test('v943: Config contém seis grupos e cada controle aparece uma vez',()=>{
 const config=html.slice(html.indexOf('<section id="config"'),html.indexOf('<section id="extras"'));
 for(const id of ['configRelatorio','configLancamentos','configEstoque','configWhatsApp','configDados','configSobre'])assert(config.includes('id="'+id+'"'));
 for(const id of ['optSep','optVazio','optLan','optSalesPayments','iCorGas','optMostrarChat','minGas','minAgua'])assert.equal(html.split('id="'+id+'"').length-1,1);
 assert(!config.includes('id="emprestimosResumo"'));assert(!config.includes('id="iTotGas"'));
 assert(html.includes("const cfg=document.getElementById('configWhatsApp');"));
});
test('v943: mínimos zero persistem e salvar não altera outras preferências',()=>{
 run(html.slice(html.indexOf('function salvarMinimosEstoque(){'),html.indexOf('function saveExtras(){')));
 store.set('jm_metaGas','73');get('minGas').value='0';get('minAgua').value='3';sandbox.salvarMinimosEstoque();
 sandbox.fillCfgUI();assert.equal(get('minGas').value,'0');assert.equal(get('minAgua').value,'3');assert.equal(store.get('jm_metaGas'),'73');
});
console.log('v9.4.3: '+count+' testes aprovados');
`;
new Function('require',source+'\n'+scenarios)(require);
