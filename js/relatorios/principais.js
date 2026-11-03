/* Caderno de Acessos — js/relatorios/principais.js (v3.1.0 · v3.1.1: sobre + dados para o Excel)
 * Resumo do topo (com listas que abrem ao clicar) e os relatórios principais: ferramentas internas, fornecedores externos,
 * ferramenta × operação, senhas vencendo e analistas. Cada bloco é um relRegistrar() independente. */
function relVisTxt(c) { return compartilhado(c) ? "Equipe (compartilhada)" : "Meus (individual)"; }
function relVencTxt(c) {
  const f = relFaixa(c); if (f === 5) return "Não expira"; if (f === 6) return "Sem data da última troca";
  const d = diasAte(c); return relData(relVence(c)) + (d < 0 ? " (vencido há " + -d + " d)" : " (em " + d + " d)");
}
function relUnicos(l, fn) { const s = []; l.forEach((c) => { const v = String(fn(c) || "").trim(); if (v && s.indexOf(v) < 0) s.push(v); }); return s; }
/* Ficha de uma ferramenta ou fornecedor (vários cards da mesma Aplicação). Sem usuário e senha. */
function relFicha(l) {
  const ops = relUnicos(l, relOp), urls = relUnicos(l, (c) => c.url), t = relTipoUrl(l);
  const lin = (r, v) => "<dt>" + r + "</dt><dd>" + v + "</dd>";
  const porOp = (fn) => l.map((c) => "<div>" + (l.length > 1 ? "<b>" + relEsc(relOp(c)) + ":</b> " : "") + fn(c) + "</div>").join("");
  const resumos = relUnicos(l, (c) => c.escalonamento), obs = relUnicos(l, (c) => c.obs), hor = relUnicos(l, (c) => c.horario);
  const niveis = Math.max(0, ...l.map((c) => niveisDe(c).length));
  return '<div class="rel-ficha"><div class="rel-ficha__tt">' + relEsc(relApp(l[0])) + relChip(REL_TIPO_TXT[t], "rel-t-" + t) + "</div><dl>" +
    lin("Operações", ops.map((o) => relChip(o, "rel-op")).join("")) +
    lin("URL de acesso", urls.length <= 1 ? relEsc(urls[0] || "—") : porOp((c) => relEsc(c.url || "—"))) +
    lin("Visibilidade", relEsc(relUnicos(l, relVisTxt).join(", "))) +
    lin("Ciclo · vencimento", porOp((c) => relEsc((c.ciclo === "Nunca" || !c.ciclo ? "Nunca" : c.ciclo + " dias") + " · " + relVencTxt(c)))) +
    lin("Horário", relEsc(hor.join(" · ") || "—")) + lin("Resumo", relEsc(resumos.join(" · ") || "—")) +
    lin("Escalonamento", niveis ? niveis + " nível(is)" : "Sem escalonamento") + lin("Observação", relEsc(obs.join(" · ") || "—")) + "</dl></div>";
}
function relTabPessoas(ctx) {
  return relTabela(["Nome", "RE", "Papel", "Status", "Último acesso", "Versão"], ctx.pessoas.map((p) => {
    const st = relStatus(p);
    return [{ html: "<b>" + relEsc(p.nome) + "</b>" }, p.matricula || "—", p.papel === "admin" ? "Administrador" : "Analista", { html: relChip(st[1], "rel-st-" + st[0]) },
      p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "Nunca entrou", p.versao ? "v" + p.versao : "—"];
  }), "rel-tab--pessoas");
}
/* ---------- Resumo do topo ---------- */
function relResumo(ctx, wrap) {
  const venc30 = ctx.ativos.filter((c) => relFaixa(c) <= 1), ativosP = ctx.pessoas.filter((p) => relStatus(p)[0] === "ativo");
  const kp = [
    { k: "fer", n: ctx.ferr.size, t: "Ferramentas internas ativas", lista: () => '<div class="rel-fichas">' + relOrdena(ctx.ferr).map(([, l]) => relFicha(l)).join("") + "</div>" },
    { k: "forn", n: ctx.forn.size, t: "Fornecedores externos ativos", lista: () => '<div class="rel-fichas">' + relOrdena(ctx.forn).map(([, l]) => relFicha(l)).join("") + "</div>" },
    { k: "venc", n: venc30.length, t: "Senhas vencidas ou vencendo em 30 dias", alerta: venc30.length > 0, lista: () => relTabela(["Card", "Operação", "Tipo", "Visibilidade", "Vencimento"],
      venc30.sort((a, b) => diasAte(a) - diasAte(b)).map((c) => [nomeDe(c), relOp(c), c.categoria === "Externo" ? "Fornecedor" : "Ferramenta", compartilhado(c) ? "Equipe" : "Meus", relVencTxt(c)])) },
    { k: "pes", n: ativosP.length + "/" + ctx.pessoas.length, t: "Perfis ativos", lista: () => relTabPessoas(ctx) }
  ];
  const grade = el("div", "rel-kpis"); const painel = el("div", "card painel-mais rel-kpi-painel"); painel.id = "relPainel";
  const abrir = () => {
    grade.querySelectorAll(".rel-kpi").forEach((b) => { const on = b.dataset.k === relEstado.resumo; b.classList.toggle("on", on); b.setAttribute("aria-expanded", on ? "true" : "false"); });
    const k = kp.find((x) => x.k === relEstado.resumo); painel.hidden = !k; painel.innerHTML = "";
    if (k) painel.innerHTML = "<h4>" + relEsc(k.t) + " · " + k.n + "</h4>" + k.lista() + '<p class="rel-nota">Sem usuário e senha.</p>';
  };
  kp.forEach((k) => {
    const b = el("button", "rel-kpi" + (k.alerta ? " alerta" : "")); b.type = "button"; b.dataset.k = k.k;
    b.innerHTML = "<b>" + k.n + "</b><span>" + relEsc(k.t) + '</span><small class="rel-kpi__ver">ver lista</small>';
    b.addEventListener("click", () => { relEstado.resumo = relEstado.resumo === k.k ? "" : k.k; abrir(); });
    grade.appendChild(b);
  });
  const arq = ctx.base.length - ctx.ativos.length;
  const info = el("div", "rel-kpi rel-kpi--info"); info.innerHTML = "<b>" + ctx.ativos.length + "</b><span>Cards ativos · " + arq + " arquivado(s)</span>"; grade.appendChild(info);
  wrap.appendChild(grade); wrap.appendChild(painel); abrir();
}
/* ---------- Ferramentas internas ---------- */
relRegistrar({ id: "ferramentas", sobre: "Ferramenta × operações: quantas operações cada ferramenta interna atende e se usa URL única, uma URL por operação ou só 1 operação.", dados(ctx) { return { cab: ["Ferramenta", "Tipo de URL", "Operações", "Qtd. operações", "Cards ativos", "URL(s)"], linhas: relOrdena(ctx.ferr).map(([, l]) => { const ops = relUnicos(l, relOp); return [relApp(l[0]), REL_TIPO_TXT[relTipoUrl(l)], ops.join(", "), ops.length, l.length, relUnicos(l, (c) => c.url).join(" | ")]; }) }; }, titulo: "Ferramentas internas", desc: "Agrupadas pela Aplicação · passe o mouse para ver as operações", aberto: true, render(ctx, c) {
  const g = relOrdena(ctx.ferr), cont = { unica: 0, op: 0, um: 0 }; g.forEach(([, l]) => cont[relTipoUrl(l)]++);
  c.innerHTML = '<div class="rel-split"><div class="rel-t-unica"><b>' + cont.unica + "</b>URL única para todas as operações</div><div class=\"rel-t-op\"><b>" + cont.op +
    "</b>URL muda por operação</div><div class=\"rel-t-um\"><b>" + cont.um + "</b>Só 1 operação</div></div>" +
    relBarras(g.map(([, l]) => { const ops = relUnicos(l, relOp); return { n: relApp(l[0]), v: l.length, sub: ops.length + (ops.length === 1 ? " operação" : " operações"),
      tip: relApp(l[0]) + "\n" + ops.length + (ops.length === 1 ? " operação: " : " operações: ") + ops.join(", ") + "\n" + { um: "1 operação", unica: "Mesma URL para todas", op: "Uma URL por operação" }[relTipoUrl(l)] }; }), "var(--teal)");
} });
/* ---------- Fornecedores externos ---------- */
relRegistrar({ id: "fornecedores", sobre: "Fornecedor × cards: quantos cards ativos cada fornecedor externo tem e em quais operações.", dados(ctx) { return { cab: ["Fornecedor", "Operações", "Cards ativos", "URL(s)", "Resumo"], linhas: relOrdena(ctx.forn).map(([, l]) => [relApp(l[0]), relUnicos(l, relOp).join(", "), l.length, relUnicos(l, (c) => c.url).join(" | "), relUnicos(l, (c) => c.escalonamento).join(" · ")]) }; }, titulo: "Fornecedores externos ativos", desc: "Cards ativos por fornecedor", aberto: true, render(ctx, c) {
  c.innerHTML = relBarras(relOrdena(ctx.forn).map(([, l]) => { const ops = relUnicos(l, relOp); return { n: relApp(l[0]), v: l.length, sub: ops.length + (ops.length === 1 ? " operação" : " operações"), tip: relApp(l[0]) + "\nOperações: " + ops.join(", ") }; }), "#B4530A");
} });
/* ---------- Ferramenta × operação ---------- */
relRegistrar({ id: "ferr-op", sobre: "Ferramenta × operação: em quais operações cada ferramenta interna tem card ativo (quantidade em cada cruzamento).", dados(ctx) { const ops = relUnicos(ctx.internos, relOp).sort((a, b) => a.localeCompare(b, "pt-BR")); return { cab: ["Ferramenta", "Tipo de URL"].concat(ops), linhas: relOrdena(ctx.ferr).map(([, l]) => [relApp(l[0]), REL_TIPO_TXT[relTipoUrl(l)]].concat(ops.map((o) => l.filter((x) => relOp(x) === o).length))) }; }, titulo: "Ferramenta × operação", desc: "Cards ativos de cada ferramenta interna por operação", aberto: true, render(ctx, c) {
  const g = relOrdena(ctx.ferr), ops = relUnicos(ctx.internos, relOp).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (!g.length) { c.innerHTML = '<p class="rel-vazio">Nenhuma ferramenta interna ativa.</p>'; return; }
  const mx = Math.max(1, ...g.map(([, l]) => Math.max(...ops.map((o) => l.filter((x) => relOp(x) === o).length))));
  c.innerHTML = '<div class="rel-tab-wrap"><table class="rel-heat"><thead><tr><th></th>' + ops.map((o) => "<th>" + relEsc(o) + "</th>").join("") + "</tr></thead><tbody>" +
    g.map(([, l]) => { const t = relTipoUrl(l); return '<tr><th scope="row">' + relEsc(relApp(l[0])) + relChip(REL_TIPO_TXT[t], "rel-t-" + t) + "</th>" + ops.map((o) => { const q = l.filter((x) => relOp(x) === o).length;
      return '<td data-tip="' + relEsc(q ? relApp(l[0]) + " · " + o + "\n" + q + " card(s)" : "") + '" data-st="' + (q ? "background:color-mix(in srgb, var(--teal) " + Math.round(25 + q / mx * 55) + "%, transparent)" : "") + '">' + (q || "–") + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
} });
/* ---------- Senhas vencendo ---------- */
relRegistrar({ id: "senhas", sobre: "Vencimento × visibilidade: senhas por faixa de prazo (última troca + ciclo), comparando cards da Equipe e de Meus.", dados(ctx) { return { cab: ["Card", "Operação", "Tipo", "Visibilidade", "Ciclo", "Última troca", "Faixa", "Vencimento"], linhas: ctx.ativos.slice().sort((a, b) => relFaixa(a) - relFaixa(b) || (diasAte(a) || 0) - (diasAte(b) || 0)).map((x) => relLinhaCard(x).concat([x.ciclo === "Nunca" || !x.ciclo ? "Nunca" : x.ciclo + " dias", relData(x.ultima), REL_FAIXAS[relFaixa(x)], relVencTxt(x)])) }; }, titulo: "Senhas vencendo", desc: "Pela data da última troca + ciclo · Equipe × Meus", aberto: true, render(ctx, c) {
  const desenha = () => {
    const f = relEstado.filtroSenhas, l = ctx.ativos.filter((x) => f === "todos" || (f === "forn") === (x.categoria === "Externo"));
    const v = REL_FAIXAS.map((_, i) => ({ e: l.filter((x) => relFaixa(x) === i && compartilhado(x)), m: l.filter((x) => relFaixa(x) === i && !compartilhado(x)) }));
    const mx = Math.max(1, ...v.map((x) => x.e.length + x.m.length));
    c.innerHTML = '<div class="rel-filtro" role="group" aria-label="Filtro">' + [["todos", "Todos"], ["ferr", "Ferramentas"], ["forn", "Fornecedores"]].map(([k, t]) => '<button type="button" class="rel-pill' + (k === f ? " on" : "") + '" data-f="' + k + '">' + t + "</button>").join("") + "</div>" +
      '<div class="rel-cols">' + v.map((x, i) => { const n = x.e.length + x.m.length, nomes = x.e.concat(x.m).slice(0, 12).map((y) => "• " + nomeDe(y) + " (" + relOp(y) + ")").join("\n");
        return '<div class="rel-col" data-tip="' + relEsc(REL_FAIXAS[i] + ": " + n + " · Equipe " + x.e.length + " · Meus " + x.m.length + (n ? "\n" + nomes : "")) + '"><span class="rel-col__q' + (i === 0 && n ? " alerta" : "") + '">' + n + '</span><div class="rel-col__p" data-st="height:' + (n / mx * 130).toFixed(0) + 'px"><i data-st="flex:' + x.m.length + ';background:#9BB3CF"></i><i data-st="flex:' + x.e.length + ";background:" + (i === 0 ? "var(--danger)" : "var(--teal)") + '"></i></div><span class="rel-col__r">' + REL_FAIXAS[i] + "</span></div>"; }).join("") + "</div>" +
      '<div class="rel-leg"><span><i data-st="background:var(--teal)"></i>Equipe (compartilhada)</span><span><i data-st="background:#9BB3CF"></i>Meus (individual)</span></div><p class="rel-nota">Meus: só os cards de Meus deste aparelho.</p>';
    c.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { relEstado.filtroSenhas = b.dataset.f; desenha(); }));
  };
  desenha();
} });
/* ---------- Analistas ---------- */
relRegistrar({ id: "analistas", sobre: "Perfis × status: quantos perfis estão ativos, desativados ou bloqueados, com último acesso e versão.", dados(ctx) { return { cab: ["Nome", "RE", "Papel", "Status", "Último acesso", "Versão"], linhas: ctx.pessoas.map((p) => [p.nome, p.matricula || "—", p.papel === "admin" ? "Administrador" : "Analista", relStatus(p)[1], p.ultimoAcesso ? dataHoraBR(p.ultimoAcesso) : "Nunca entrou", p.versao ? "v" + p.versao : "—"]) }; }, titulo: "Analistas e perfis", desc: "Ativos, desativados e bloqueados · passe o mouse para ver quem", aberto: true, render(ctx, c) {
  const fat = [["ativo", "Ativo", "var(--green)"], ["desativado", "Desativado", "#98A2B3"], ["bloqueado", "Bloqueado (15 min)", "var(--danger)"]].map(([k, t, cor]) => {
    const ps = ctx.pessoas.filter((p) => relStatus(p)[0] === k); return { t: t, v: ps.length, cor: cor, tip: t + ": " + ps.length + (ps.length ? "\n" + ps.map((p) => p.nome + " · RE " + (p.matricula || "—")).join("\n") : "") }; });
  c.innerHTML = relDonut(fat, ctx.pessoas.length, "perfis");
  const d = el("details", "rel-sub"); d.appendChild(el("summary", "", "Ver perfis")); const t = el("div"); t.innerHTML = relTabPessoas(ctx); d.appendChild(t); c.appendChild(d);
} });
