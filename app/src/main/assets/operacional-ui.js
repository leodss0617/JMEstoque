/* Interface v9.4. Todo saldo vem de calc(); histórico em jm_lan e preferência em jm_cfg. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id);
  function aplicarChat(){
    const mostrar=loadCfg().mostrarChatLancamentos!==false;
    if(el('chatLancamentos')) el('chatLancamentos').style.display=mostrar?'':'none';
    if(el('mostrarChatCompacto')){
      el('mostrarChatCompacto').hidden=mostrar;
      el('mostrarChatCompacto').style.display=mostrar?'none':'inline-block';
    }
    if(el('optMostrarChat')) el('optMostrarChat').checked=mostrar;
  }
  window.jmMostrarChat=function(mostrar){
    const c=loadCfg();
    c.mostrarChatLancamentos=!!mostrar;
    saveCfgObj(c);
    aplicarChat();
  };
  let confirmandoChat=false;
  window.jmConfirmarMostrarChat=async function(){
    if(confirmandoChat || loadCfg().mostrarChatLancamentos!==false) return;
    confirmandoChat=true;
    try{
      const ok=await showModal({
        title:'Mostrar Chat de Lançamentos?',
        msg:'O chat ocupa mais espaço na aba Lançar. Deseja realmente exibi-lo agora?',
        ico:'💬', cancelText:'Cancelar', okText:'Mostrar chat', okBlue:true
      });
      if(ok) window.jmMostrarChat(true);
    } finally { confirmandoChat=false; }
  };
  function atualizarEmprestimos(){
    const s=calc(),o=s.operacionalGas;
    if(el('emprestimosResumo')) el('emprestimosResumo').textContent=
      `Saldo atual: ${o.emprestadosSaldoAtual} · Em uso: ${o.emprestadosEmUso} · Disponíveis: ${o.emprestadosDisponiveis} · A devolver: ${o.emprestadosADevolver}`;
    const hist=el('emprestimosHistorico');
    if(hist){
      hist.replaceChildren();
      const itens=loadLan().filter(x=>isGas(x.prod)&&(isEmpRecebido(x.tipo)||isEmpDevolver(x.tipo)));
      if(!itens.length) hist.textContent='Nenhum movimento de empréstimo no histórico. Saldos antigos consolidados são preservados.';
      itens.forEach(x=>{
        const p=document.createElement('p');
        p.textContent=`${x.data||'Sem data'} · ${isEmpRecebido(x.tipo)?'Recebeu':'Devolveu'} ${x.qtd} · ${x.empresa||x.cliente||'Empresa não informada'}`;
        hist.appendChild(p);
      });
    }
  }
  window.jmRegistrarEmprestimo=function(devolver){
    const qtd=Number(el('empQuantidade').value);
    const data=el('empData').value||todayStr();
    if(!Number.isSafeInteger(qtd)||qtd<=0){
      toast('Informe uma quantidade inteira maior que zero.','err');return;
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){
      toast('Informe uma data válida.','err');return;
    }
    const saldo=calc().operacionalGas.emprestadosADevolver;
    if(devolver&&qtd>saldo){
      jmAlert(`Não é possível devolver ${qtd}. O saldo a devolver é ${saldo}.`,'Devolução inválida','⚠️');return;
    }
    const empresa=el('empEmpresa').value.trim();
    const lista=loadLan();
    lista.unshift({
      id:'l_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      data,hora:nowTime(),prod:'Gás',tipo:devolver?'Devolver empréstimo':'Empréstimo recebido',
      qtd,empresa,cliente:'',pag:'-',obs:'Empréstimo de outra empresa · v9.4'
    });
    saveLanArr(lista);
    el('empQuantidade').value='';
    atualizarEmprestimos();
    toast(devolver?'Devolução registrada.':'Empréstimo recebido registrado.','ok');
  };
  const mostrar=window.show;
  window.show=function(){
    const r=mostrar.apply(this,arguments);
    aplicarChat();atualizarEmprestimos();
    if(arguments[0]==='config') el('empData').value=todayStr();
    return r;
  };
  const salvar=window.saveCfgObj;
  window.saveCfgObj=function(){
    const r=salvar.apply(this,arguments);
    aplicarChat();
    return r;
  };
  // A validação é chamada pela persistência original, inclusive por chat/exclusão.
  window.jmValidarEmprestimos=function(lista){
    const antes=calc(),depois=calc(lista);
    if(depois.empG<0 && depois.empG<antes.empG){
      const msg='Devolução/exclusão inválida: o saldo de empréstimos de gás ficaria negativo. Saldo atual: '+antes.empG+'.';
      jmAlert(msg,'Empréstimos de gás','⚠️');
      throw new Error(msg);
    }
    const ids=new Set(loadLan().map(x=>x.id));
    lista.forEach(x=>{
      if(!ids.has(x.id)&&isGas(x.prod)&&(isEmpRecebido(x.tipo)||isEmpDevolver(x.tipo))&&(!Number.isSafeInteger(Number(x.qtd))||Number(x.qtd)<=0)){
        const msg='Empréstimos exigem uma quantidade inteira maior que zero.';
        jmAlert(msg,'Empréstimos de gás','⚠️');throw new Error(msg);
      }
    });
  };
  el('empData').value=todayStr();
  aplicarChat();atualizarEmprestimos();
})();
