const assert=require('node:assert/strict'),fs=require('fs');
const api=require('../app/src/main/assets/entregas.js');let count=0;
const test=(name,fn)=>{fn();console.log('OK '+(++count)+' '+name);};
const state=()=>({orders:[],seen:{}});
const event=(id,text,t=100000,conversationId='Maria',packageName='com.whatsapp')=>({id,text,timestamp:t,conversationId,packageName,sender:'Autorizado'});
test('1 gás',()=>{const o=api.parse({},'1 gás');assert.equal(o.product,'Gás');assert.equal(o.quantity,1);assert.equal(o.status,'waiting_info');});
test('1 gas portao pix',()=>{const o=api.parse({},'1 gas portao pix');assert.equal(o.address,'portao');assert.equal(o.paymentMethod,'pix');assert.ok(api.missing(o).includes('customerName'));});
test('fragmentos persistidos e fora de ordem',()=>{let s=state();for(const [i,text]of ['1 gás','na kasa','Luciana','pix'].entries()){api.accept(s,event('e'+i,text,100000+i*1000));s=JSON.parse(JSON.stringify(s));}assert.equal(s.orders.length,1);assert.equal(s.orders[0].status,'ready');assert.equal(s.orders[0].customerName,'Luciana');});
test('deduplicação',()=>{const s=state(),e=event('a','1 gás');api.accept(s,e);assert.equal(api.accept(s,e),false);assert.equal(s.orders.length,1);});
test('mensagens iguais em pedidos diferentes',()=>{const s=state();api.accept(s,event('a','1 gás'));api.accept(s,event('b','1 gás',200000));assert.equal(s.orders.length,2);});
test('novos pedidos na mesma janela',()=>{const s=state();api.accept(s,event('a','1 gás'));api.accept(s,event('b','1 gás',110000));assert.equal(s.orders.length,2);});
test('pedido não altera histórico',()=>{const s=state();api.accept(s,event('a','gas do povo casa Maria dinheiro'));assert.deepEqual(api.launch(s.orders[0],[]),[]);});
test('confirmação dupla idempotente inclusive após restart',()=>{let s=state();api.accept(s,event('a','gas do povo casa Maria dinheiro'));api.accept(s,event('b','já entreguei',110000));const first=api.launch(s.orders[0],[]);assert.equal(first.length,1);s=JSON.parse(JSON.stringify(s));assert.equal(api.launch(s.orders[0],first).length,1);});
test('outros pacotes ignorados',()=>{assert.equal(api.accept(state(),event('a','1 gas',100000,'x','outro')),false);});
test('WhatsApp normal',()=>{assert.equal(api.accept(state(),event('a','1 gas')),true);});
test('Business opt-in',()=>{const e=event('a','1 gas',100000,'x','com.whatsapp.w4b');assert.equal(api.accept(state(),e),false);assert.equal(api.accept(state(),e,{business:true}),true);});
test('confirmação ambígua não lança',()=>{const s=state();api.accept(s,event('a','1 gas casa Maria pix'));api.accept(s,event('b','1 gas casa Ana pix',101000));api.accept(s,event('c','entregue',102000));assert.equal(s.orders.filter(o=>o.status==='delivered').length,0);});
test('sem confirmação de pedido incompleto',()=>{const s=state();api.accept(s,event('a','1 gas'));api.accept(s,event('b','entregue',101000));assert.notEqual(s.orders[0].status,'delivered');});
test('janela de 90s',()=>{const s=state();api.accept(s,event('a','1 gas'));api.accept(s,event('b','Luciana',191000));assert.equal(s.orders.length,2);});
test('sintaxe de todos os assets',()=>{for(const p of ['entregas.js','v945-ui.js'])new (require('vm').Script)(fs.readFileSync('app/src/main/assets/'+p,'utf8'));});


test('remetentes distintos em conversa de grupo não misturam fragmentos',()=>{const s=state();api.accept(s,event('a','1 gas'));api.accept(s,{...event('b','Luciana',101000),sender:'Outro'});assert.equal(s.orders.length,2);});
test('resumo de mensagens não vira pedido',()=>{const s=state();api.accept(s,event('a','3 novas mensagens'));assert.equal(s.orders.length,0);});
test('nome que contém gas preservado',()=>{assert.equal(api.parse({},'1 gás casa Gaspar pix').customerName,'Gaspar');});

console.log(count+' testes aprovados');
