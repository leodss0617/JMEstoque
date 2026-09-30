/* Atualiza apenas a visualização diária. Não grava nem exclui movimentos. */
(function(){
  'use strict';
  let dia, timer;
  function atualizar(){
    dia=todayStr();
    renderLista();
    clearTimeout(timer);
    const agora=new Date();
    const meiaNoite=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()+1);
    timer=setTimeout(atualizar,Math.max(1,meiaNoite.getTime()-agora.getTime()));
  }
  const mostrar=window.show;
  window.show=function(){
    const r=mostrar.apply(this,arguments);
    if(arguments[0]==='lan') atualizar();
    return r;
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') atualizar();
  });
  window.addEventListener('jm:resume',atualizar);
  window.addEventListener('pageshow',atualizar);
  window.addEventListener('focus',atualizar);
  // Detecta também ajustes manuais de data/fuso enquanto a tela está aberta.
  setInterval(()=>{if(dia!==todayStr()) atualizar();},1000);
  atualizar();
})();
