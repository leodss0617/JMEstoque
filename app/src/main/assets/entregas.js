(function(root){
'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bkasa\b/g,'casa').trim();
function missing(o){return ['product','quantity','customerName','address','paymentMethod'].filter(k=>!o[k]);}
function parse(o,text){
 const n=normalize(text); const product=/\b(gas|gaz|botijao)\b/.test(n)?'Gás':/\bagua\b/.test(n)?'Água':null;
 if(product){o.product=product;o.quantity=Number(n.match(/\b(\d+)\s*(?:gas|gaz|agua|botijao)/)?.[1]||1);}
 if(/\bgas do povo\b/.test(n))o.isGasDoPovo=true;
 const payment=n.match(/\b(pix|dinheiro|debito|credito)\b/);if(payment)o.paymentMethod=payment[1];
 const address=n.match(/\b(?:na |no )?(casa|portao|rua\s+.+|avenida\s+.+|travessa\s+.+)/);if(address)o.address=address[0];
 let name=String(text).replace(/\b\d+\b/g,'').replace(/\b(?:g[aá]s do povo|g[aá]s|gaz|botij[aã]o|[aá]gua|pix|dinheiro|d[eé]bito|cr[eé]dito|na|no|casa|kasa|port[aã]o|pagamento|para|pra)\b/gi,'').trim();
 if(name && !/\b(rua|avenida|travessa|entreg|pago)\w*/i.test(name))o.customerName=name;
 o.status=missing(o).length?'waiting_info':'ready';return o;
}
function accept(state,event,options={}){
 if(event.packageName!=='com.whatsapp' && !(options.business&&event.packageName==='com.whatsapp.w4b'))return false;
 if(state.seen[event.id])return false;
 const n=normalize(event.text), time=Number(event.timestamp)||Date.now();
 if(!n || /^(?:\d+\s+)?(?:novas? mensagens?|mensagens?)(?: de .*)?$/.test(n))return false;
 const open=state.orders.filter(o=>o.conversationId===event.conversationId&&o.sender===event.sender&&!['delivered','cancelled'].includes(o.status));
 if(/^(ja entreguei|entregue|foi entregue)[.!\s]*$/.test(n)){
   const ready=open.filter(o=>!missing(o).length);
   if(ready.length===1){ready[0].deliveryConfirmedAt=time;ready[0].status='delivered';}
   else state.lastError='Confirmação ambígua ou pedido incompleto: use o botão do pedido.';
 }else{
   let order=open.slice().reverse().find(o=>time-o.updatedAt<=90000 && time>=o.createdAt && o.status!=='out_for_delivery');
   // A new product message starts another order, even within the session window.
   if(order && /\b(gas|gaz|agua|botijao)\b/.test(n) && order.product)order=null;
   if(!order){order={id:'wa_'+event.id,conversationId:event.conversationId,sender:event.sender,customerName:'',product:'',quantity:0,isGasDoPovo:false,address:'',paymentMethod:'',rawMessages:[],createdAt:time,updatedAt:time,status:'collecting',deliveryConfirmedAt:null};state.orders.push(order);}
   order.rawMessages.push({id:event.id,text:event.text,timestamp:time});order.updatedAt=time;parse(order,event.text);
 }
 state.seen[event.id]=time;return true;
}
function launch(order,entries){
 if(order.status!=='delivered'||!order.deliveryConfirmedAt||missing(order).length)return entries;
 const id='delivery_'+order.id;if(entries.some(e=>e.id===id))return entries;
 const date=new Date(order.deliveryConfirmedAt), pad=n=>String(n).padStart(2,'0');
 return [{id,prod:order.product,tipo:'Entrega',qtd:order.quantity,cliente:order.customerName,pag:({pix:'PIX',dinheiro:'Espécie',debito:'Débito',credito:'Crédito'})[order.paymentMethod]||order.paymentMethod,pagamento:order.paymentMethod,
 data:date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate()),hora:pad(date.getHours())+':'+pad(date.getMinutes()),
 obs:(order.isGasDoPovo?'Gás do povo · ':'')+order.address,deliveryId:order.id},...entries];
}
const api={normalize,parse,missing,accept,launch};root.JMEntregas=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
