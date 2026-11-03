/* Caderno de Acessos — js/relatorios/extras.js (v3.1.0 · v3.1.1: sobre + dados para o Excel)
 * Relatórios complementares (começam recolhidos). Cada bloco é um relRegistrar() independente; remover um não afeta os outros. */
function relNomePerfil(ctx, id) { const p = ctx.pessoas.find((x) => x.id === id) || lerPerfis().find((x) => x.id === id); return p ? p.nome : "Perfil removido"; }
function relLinhaCard(c) { return [nomeDe(c), relOp(c), c.categoria === "Externo" ? "Fornecedor" : "Ferramenta", compartilhado(c) ? "Equipe" : "Meus"]; }
/* 1. Envios por pessoa e por card */
relRegistrar({ id: "envios", sobre: "Pessoa × card enviado: quem recebeu cada card enviado pelo Administrador.", dados(ctx) { return { cab: ["Card", "Operação", "Recebeu", "Total"], linhas: ctx.modelos.filter((m) => Array.isArray(m.destinatarios) && m.destinatarios.length).map((m) => [m.nome || m.sistema || "", m.cliente || "Sem operação", m.destinatarios.map((id) => relNomePerfil(ctx, id)).join(", "), m.destinatarios.length]) }; }, titulo: "Envios por pessoa e por card", desc: "Quem recebeu cada card enviado pelo Administrador", render(ctx, c) {
  const env = ctx.modelos.filter((m) => Array.isArray(m.destinatarios) && m.destinatarios.length);
  const porP = new Map(); env.forEach((m) => m.destinatarios.forEach((id) => { const n = relNomePerfil(ctx, id); if (!porP.has(n)) porP.set(n, []); porP.get(n).push(m.nome || m.sistema || ""); }));
  const analistas = ctx.pessoas.filter((p) => p.ativo && p.papel !== "admin");
  const sem = analistas.filter((p) => !porP.has(p.nome)).map((p) => p.nome);
  c.innerHTML = "<h4>Por pessoa</h4>" + relBarras(relOrdena(porP).map(([n, l]) => ({ n: n, v: l.length, tip: n + "\n" + l.join("\n") })), "var(--teal)") +
    (sem.length ? '<p class="rel-nota">Analistas ativos sem nenhum envio: ' + relEsc(sem.join(", ")) + "</p>" : "") +
    "<h4>Por card</h4>" + relTabela(["Card", "Operação", "Recebeu", "Total"], env.map((m) => [m.nome || m.sistema || "", m.cliente || "Sem operação", m.destinatarios.map((id) => relNomePerfil(ctx, id)).join(", "), m.destinatarios.length]));
} });
/* 2. Cards sem escalonamento ou sem Resumo */
relRegistrar({ id: "sem-esc", sobre: "Card × contato: cards ativos sem níveis de escalonamento e/ou sem Resumo.", dados(ctx) { return { cab: ["Card", "Operação", "Tipo", "Visibilidade", "Falta"], linhas: ctx.ativos.filter((x) => !niveisDe(x).length || !String(x.escalonamento || "").trim()).map((x) => relLinhaCard(x).concat([[!niveisDe(x).length ? "Escalonamento" : "", !String(x.escalonamento || "").trim() ? "Resumo" : ""].filter(Boolean).join(" e ")])) }; }, titulo: "Cards sem escalonamento ou sem Resumo", desc: "Ativos que ainda não têm a quem recorrer", render(ctx, c) {
  const l = ctx.ativos.filter((x) => !niveisDe(x).length || !String(x.escalonamento || "").trim());
  c.innerHTML = relTabela(["Card", "Operação", "Tipo", "Visibilidade", "Falta"], l.map((x) => relLinhaCard(x).concat([[!niveisDe(x).length ? "Escalonamento" : "", !String(x.escalonamento || "").trim() ? "Resumo" : ""].filter(Boolean).join(" e ")])));
} });
/* 3. Cards sem data da última troca */
relRegistrar({ id: "sem-ultima", sobre: "Ciclo × data: cards com ciclo de troca mas sem a data da última troca (ficam sem vencimento).", dados(ctx) { return { cab: ["Card", "Operação", "Tipo", "Visibilidade", "Ciclo"], linhas: ctx.ativos.filter((x) => relFaixa(x) === 6).map((x) => relLinhaCard(x).concat([x.ciclo + " dias"])) }; }, titulo: "Cards sem data da última troca", desc: "Com ciclo, mas sem a data: ficam sem vencimento", render(ctx, c) {
  const l = ctx.ativos.filter((x) => relFaixa(x) === 6);
  c.innerHTML = relTabela(["Card", "Operação", "Tipo", "Visibilidade", "Ciclo"], l.map((x) => relLinhaCard(x).concat([x.ciclo + " dias"])));
} });
/* 4. Calendário das próximas trocas (por semana) */
relRegistrar({ id: "calendario", sobre: "Semana × trocas: quantas senhas vencem em cada uma das próximas 8 semanas.", dados(ctx) { const hj = hoje(), r = []; for (let i = 0; i < 8; i++) { const ini = addDias(hj, i * 7), fim = addDias(hj, i * 7 + 6); const l = ctx.ativos.filter((x) => { const v = relVence(x); return v && v >= ini && v <= fim; }); r.push([relData(ini) + " a " + relData(fim), l.length, l.map((x) => nomeDe(x) + " (" + relOp(x) + ") " + relData(relVence(x))).join("; ")]); } return { cab: ["Semana", "Trocas", "Cards"], linhas: r }; }, titulo: "Próximas trocas de senha por semana", desc: "As próximas 8 semanas", render(ctx, c) {
  const hj = hoje(), sem = [];
  for (let i = 0; i < 8; i++) { const ini = addDias(hj, i * 7), fim = addDias(hj, i * 7 + 6); const l = ctx.ativos.filter((x) => { const v = relVence(x); return v && v >= ini && v <= fim; });
    sem.push({ n: relData(ini).slice(0, 5) + " a " + relData(fim).slice(0, 5), v: l.length, sub: i === 0 ? "esta semana" : "", tip: l.length ? l.map((x) => "• " + nomeDe(x) + " (" + relOp(x) + ") " + relData(relVence(x))).join("\n") : "" }); }
  const venc = ctx.ativos.filter((x) => relFaixa(x) === 0).length;
  c.innerHTML = (venc ? '<p class="rel-nota rel-nota--alerta">' + venc + " senha(s) já vencida(s), fora deste calendário.</p>" : "") + relBarras(sem, "var(--teal)");
} });
/* 5. Operação × vencimento */
relRegistrar({ id: "op-venc", sobre: "Operação × faixa de vencimento: qual operação acumula senhas vencidas ou perto de vencer.", dados(ctx) { return { cab: ["Operação"].concat(REL_FAIXAS), linhas: relOrdena(relAgrupa(ctx.ativos, relOp)).map(([o, l]) => [o].concat(REL_FAIXAS.map((f, i) => l.filter((x) => relFaixa(x) === i).length))) }; }, titulo: "Operação × vencimento", desc: "Qual operação acumula senhas vencidas ou perto de vencer", render(ctx, c) {
  const g = relOrdena(relAgrupa(ctx.ativos, relOp));
  c.innerHTML = '<div class="rel-tab-wrap"><table class="rel-heat"><thead><tr><th></th>' + REL_FAIXAS.map((f) => "<th>" + f + "</th>").join("") + "</tr></thead><tbody>" +
    g.map(([o, l]) => '<tr><th scope="row">' + relEsc(o) + "</th>" + REL_FAIXAS.map((f, i) => { const q = l.filter((x) => relFaixa(x) === i);
      const cor = i === 0 ? "var(--danger)" : i <= 1 ? "#B4530A" : "var(--teal)";
      return '<td data-tip="' + relEsc(q.length ? o + " · " + f + "\n" + q.map((x) => "• " + nomeDe(x)).join("\n") : "") + '" data-st="' + (q.length ? "background:color-mix(in srgb, " + cor + " " + Math.min(80, 25 + q.length * 18) + "%, transparent)" : "") + '">' + (q.length || "–") + "</td>"; }).join("") + "</tr>").join("") + "</tbody></table></div>";
} });
/* 6. Cards da Equipe por ciclo */
relRegistrar({ id: "ciclo", sobre: "Ciclo × cards da Equipe: quantos cards compartilhados trocam a cada 30, 60, 90 dias ou nunca.", dados(ctx) { const eq = ctx.ativos.filter(compartilhado); return { cab: ["Ciclo", "Cards", "Quais"], linhas: ["30", "60", "90", "Nunca"].map((k) => { const l = eq.filter((x) => (x.ciclo || "Nunca") === k); return [k === "Nunca" ? "Nunca expira" : k + " dias", l.length, l.map((x) => nomeDe(x) + " (" + relOp(x) + ")").join("; ")]; }) }; }, titulo: "Cards da Equipe por ciclo", desc: "30, 60, 90 dias ou Nunca", render(ctx, c) {
  const eq = ctx.ativos.filter(compartilhado);
  c.innerHTML = relBarras(["30", "60", "90", "Nunca"].map((k) => { const l = eq.filter((x) => (x.ciclo || "Nunca") === k); return { n: k === "Nunca" ? "Nunca expira" : k + " dias", v: l.length, tip: l.slice(0, 15).map((x) => "• " + nomeDe(x) + " (" + relOp(x) + ")").join("\n") }; }), "var(--teal)");
} });
/* 7. Atividade do Log */
const relLogEstado = { dias: 7 };
relRegistrar({ id: "log", sobre: "Ação × dia × pessoa: atividade registrada no Log (no Excel, os últimos 30 dias).", dados(ctx) { const lim = Date.now() - 30 * 864e5; return { cab: ["Quando", "Quem", "Ação", "Card"], linhas: ctx.hist.filter((e) => CadernoSync.ts(e.quando) >= lim).map((e) => [dataHoraBR(e.quando), e.quem || "—", (() => { try { return acaoDoLog(e); } catch (x) { return "Ação"; } })(), e.card || ""]) }; }, titulo: "Atividade do Log", desc: "Por ação, por dia e por pessoa", render(ctx, c) {
  const desenha = () => {
    const lim = Date.now() - relLogEstado.dias * 864e5, l = ctx.hist.filter((e) => CadernoSync.ts(e.quando) >= lim);
    const porDia = []; for (let i = relLogEstado.dias - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toLocaleDateString("pt-BR"); porDia.push({ d: d, v: l.filter((e) => new Date(e.quando).toLocaleDateString("pt-BR") === d).length }); }
    const mx = Math.max(1, ...porDia.map((x) => x.v));
    c.innerHTML = '<div class="rel-filtro">' + [[7, "7 dias"], [30, "30 dias"]].map(([k, t]) => '<button type="button" class="rel-pill' + (k === relLogEstado.dias ? " on" : "") + '" data-d="' + k + '">' + t + "</button>").join("") + "</div>" +
      "<p class=\"rel-nota\">" + l.length + " registro(s) no período.</p><h4>Por dia</h4><div class=\"rel-cols rel-cols--fino\">" + porDia.map((x) => '<div class="rel-col" data-tip="' + x.d + ": " + x.v + ' registro(s)"><span class="rel-col__q">' + (x.v || "") + '</span><div class="rel-col__p" data-st="height:' + (x.v / mx * 100).toFixed(0) + 'px"><i data-st="flex:1;background:var(--teal)"></i></div><span class="rel-col__r">' + x.d.slice(0, 5) + "</span></div>").join("") + "</div>" +
      "<h4>Por ação</h4>" + relBarras(relOrdena(relAgrupa(l, (e) => { try { return acaoDoLog(e); } catch (x) { return "Ação"; } })).slice(0, 12).map(([n, g]) => ({ n: n, v: g.length })), "var(--teal)") +
      "<h4>Por pessoa</h4>" + relBarras(relOrdena(relAgrupa(l, (e) => e.quem || "—")).map(([n, g]) => ({ n: n, v: g.length })), "#5B4BB7");
    c.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => { relLogEstado.dias = Number(b.dataset.d); desenha(); }));
  };
  desenha();
} });
/* 8. Perfis sem acesso recente ou com versão antiga */
function relVerNum(v) { return String(v || "").split(".").map(Number).reduce((s, n, i) => s + (n || 0) * [1e6, 1e3, 1][i], 0); }
relRegistrar({ id: "acessos", sobre: "Perfil × acesso e versão: perfis ativos sem entrar há 7+ ou 30+ dias, ou com versão antiga do app.", dados(ctx) { return { cab: ["Nome", "RE", "Último acesso", "Situação", "Versão"], linhas: ctx.pessoas.filter((p) => p.ativo).map((p) => { const d = p.ultimoAcesso ? Math.floor(diasDesde(p.ultimoAcesso)) : null; const velha = p.versao && relVerNum(p.versao) < relVerNum(APP_VERSAO); return { p, d, velha }; }).filter((x) => x.d == null || x.d >= 7 || x.velha)
    .map((x) => [x.p.nome, x.p.matricula || "—", x.p.ultimoAcesso ? dataHoraBR(x.p.ultimoAcesso) : "Nunca entrou", x.d == null ? "Nunca entrou" : x.d >= 30 ? "30+ dias" : x.d >= 7 ? "7+ dias" : "Recente", x.p.versao ? "v" + x.p.versao + (x.velha ? " (atualizar)" : "") : "—"]) }; }, titulo: "Perfis sem acesso recente ou com versão antiga", desc: "Sem entrar há 7+ ou 30+ dias, ou abaixo da v" + (typeof APP_VERSAO !== "undefined" ? APP_VERSAO : ""), render(ctx, c) {
  const l = ctx.pessoas.filter((p) => p.ativo).map((p) => { const d = p.ultimoAcesso ? Math.floor(diasDesde(p.ultimoAcesso)) : null; const velha = p.versao && relVerNum(p.versao) < relVerNum(APP_VERSAO); return { p, d, velha }; })
    .filter((x) => x.d == null || x.d >= 7 || x.velha);
  c.innerHTML = relTabela(["Nome", "RE", "Último acesso", "Situação", "Versão"], l.map((x) => [x.p.nome, x.p.matricula || "—", x.p.ultimoAcesso ? dataHoraBR(x.p.ultimoAcesso) : "Nunca entrou",
    { html: x.d == null ? relChip("Nunca entrou", "rel-st-desativado") : x.d >= 30 ? relChip("30+ dias", "rel-st-bloqueado") : x.d >= 7 ? relChip("7+ dias", "rel-t-op") : relChip("Recente", "rel-st-ativo") },
    { html: x.p.versao ? (x.velha ? relChip("v" + x.p.versao + " · atualizar", "rel-st-bloqueado") : "v" + relEsc(x.p.versao)) : "—" }]));
} });
/* 9. Links duplicados (Meus × Equipe) */
relRegistrar({ id: "duplicados", sobre: "Meus × Equipe: o mesmo link aparece num card da Equipe e num card de Meus.", dados(ctx) { return { cab: ["Link", "Na Equipe", "Em Meus"], linhas: Array.from(relAgrupa(ctx.ativos.filter((x) => normUrl(x.url)), (x) => normUrl(x.url))).filter(([, l]) => l.length > 1 && l.some(compartilhado) && l.some((x) => !compartilhado(x))).map(([u, l]) => [u, l.filter(compartilhado).map((x) => nomeDe(x) + " (" + relOp(x) + ")").join(", "), l.filter((x) => !compartilhado(x)).map((x) => nomeDe(x) + " (" + relOp(x) + ")").join(", ")]) }; }, titulo: "Links repetidos entre Meus e Equipe", desc: "Mesmo link em mais de um card ativo", render(ctx, c) {
  const g = Array.from(relAgrupa(ctx.ativos.filter((x) => normUrl(x.url)), (x) => normUrl(x.url))).filter(([, l]) => l.length > 1 && l.some(compartilhado) && l.some((x) => !compartilhado(x)));
  c.innerHTML = relTabela(["Link", "Na Equipe", "Em Meus"], g.map(([u, l]) => [u, l.filter(compartilhado).map((x) => nomeDe(x) + " (" + relOp(x) + ")").join(", "), l.filter((x) => !compartilhado(x)).map((x) => nomeDe(x) + " (" + relOp(x) + ")").join(", ")]));
} });
/* 10. Arquivados por mês e categoria */
relRegistrar({ id: "arquivados", sobre: "Mês × categoria: cards arquivados em cada mês, ferramentas internas × fornecedores externos.", dados(ctx) { return { cab: ["Mês", "Ferramentas", "Fornecedores", "Cards"], linhas: Array.from(relAgrupa(ctx.base.filter((x) => x.arquivado_em), (x) => String(x.arquivado_em).slice(0, 7))).sort((a, b) => b[0].localeCompare(a[0])).map(([m, l]) => [m.split("-").reverse().join("/"), l.filter((x) => x.categoria !== "Externo").length, l.filter((x) => x.categoria === "Externo").length, l.map((x) => nomeDe(x)).join(", ")]) }; }, titulo: "Cards arquivados por mês", desc: "Ferramentas × fornecedores", render(ctx, c) {
  const arq = ctx.base.filter((x) => x.arquivado_em), g = Array.from(relAgrupa(arq, (x) => String(x.arquivado_em).slice(0, 7))).sort((a, b) => b[0].localeCompare(a[0]));
  c.innerHTML = relTabela(["Mês", "Ferramentas", "Fornecedores", "Cards"], g.map(([m, l]) => [m.split("-").reverse().join("/"), l.filter((x) => x.categoria !== "Externo").length, l.filter((x) => x.categoria === "Externo").length, l.map((x) => nomeDe(x)).join(", ")]));
} });
/* 11. Escalonamento editado (quem e quando) */
relRegistrar({ id: "esc-edit", sobre: "Card enviado × edição: quem editou por último o escalonamento de cada card enviado, e quando.", dados(ctx) { return { cab: ["Card", "Operação", "Editado por", "Quando", "Níveis"], linhas: ctx.modelos.filter((m) => m.escComp && m.escComp.em).sort((a, b) => CadernoSync.ts(b.escComp.em) - CadernoSync.ts(a.escComp.em)).map((m) => [m.nome || m.sistema || "", m.cliente || "Sem operação", m.escComp.por || "—", dataHoraBR(m.escComp.em), (m.escComp.l || []).length]) }; }, titulo: "Escalonamento editado nos cards enviados", desc: "Última edição: quem e quando", render(ctx, c) {
  const l = ctx.modelos.filter((m) => m.escComp && m.escComp.em).sort((a, b) => CadernoSync.ts(b.escComp.em) - CadernoSync.ts(a.escComp.em));
  c.innerHTML = relTabela(["Card", "Operação", "Editado por", "Quando", "Níveis"], l.map((m) => [m.nome || m.sistema || "", m.cliente || "Sem operação", m.escComp.por || "—", dataHoraBR(m.escComp.em), (m.escComp.l || []).length]));
} });
