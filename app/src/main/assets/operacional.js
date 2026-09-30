/* Fonte única da cobertura operacional; não altera estoque nem histórico. */
(function(root){
  'use strict';
  function operacional(cheios, separados, saldo, totalProprio){
    const cadastrados=Math.max(0,Number(separados)||0);
    const emprestadosSaldoAtual=Math.max(0,Number(saldo)||0);
    const deficitCheios=Math.max(0,-(Number(cheios)||0));
    const usandoSeparados=Math.min(deficitCheios,cadastrados);
    const deficitDepoisSeparados=Math.max(0,deficitCheios-cadastrados);
    const emprestadosEmUso=Math.min(deficitDepoisSeparados,emprestadosSaldoAtual);
    const operationalFull=Number(cheios)||0;
    const physicalFull=Math.max(0,operationalFull);
    const separatedFree=cadastrados-usandoSeparados;
    const yardEmpty=(Number(totalProprio)||0)-physicalFull-separatedFree;
    return {
      operationalFull, physicalFull, separatedRegistered:cadastrados,
      usingSeparated:usandoSeparados, separatedFree, yardEmpty,
      borrowedBalance:emprestadosSaldoAtual, borrowedInUse:emprestadosEmUso,
      uncoveredDeficit:Math.max(0,deficitDepoisSeparados-emprestadosSaldoAtual),
      physicalOwnTotal:physicalFull+separatedFree+yardEmpty,
      deficitCheios, separadosCadastrados:cadastrados, usandoSeparados,
      separadosLivres:cadastrados-usandoSeparados, deficitDepoisSeparados,
      emprestadosSaldoAtual, emprestadosEmUso,
      emprestadosDisponiveis:emprestadosSaldoAtual-emprestadosEmUso,
      emprestadosADevolver:emprestadosSaldoAtual,
      faltaCobertura:Math.max(0,deficitDepoisSeparados-emprestadosSaldoAtual)
    };
  }
  function linhas(o){
    const out=[
      `Separados cadastrados: ${o.separadosCadastrados}`,
      `Usando separados: ${o.usandoSeparados}`,
      `Separados livres: ${o.separadosLivres}`
    ];
    if(o.emprestadosSaldoAtual>0) out.push(
      `Emprestados recebidos / saldo atual: ${o.emprestadosSaldoAtual}`,
      `Emprestados em uso: ${o.emprestadosEmUso}`,
      `Emprestados ainda disponíveis: ${o.emprestadosDisponiveis}`,
      `A devolver para outra empresa: ${o.emprestadosADevolver}`
    );
    if(o.emprestadosSaldoAtual>0) out.push('Emprestados não entram no total físico próprio.');
    if(o.deficitCheios>0) out.push(`⚠ Déficit operacional: ${o.deficitCheios} unidades. Usando ${o.usandoSeparados} dos ${o.separadosCadastrados} separados cadastrados.`);
    if(o.usandoSeparados>0) out.push(`⚠️ Estoque cheio negativo. Usando ${o.usandoSeparados} separados. Restam ${o.separadosLivres} separados livres.`);
    if(o.faltaCobertura>0) out.push(`🚨 Faltam ${o.faltaCobertura} botijões para cobrir o estoque negativo. Separe/registre empréstimo.`);
    return out;
  }
  root.JMOperacional={calcular:operacional,linhas};
  if(typeof module!=='undefined') module.exports=root.JMOperacional;
})(typeof window!=='undefined'?window:globalThis);
