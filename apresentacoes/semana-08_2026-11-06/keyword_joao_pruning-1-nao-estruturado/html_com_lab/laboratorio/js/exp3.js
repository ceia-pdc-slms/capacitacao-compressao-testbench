// Experimento 3 — SparseGPT passo a passo: as contas da Eq. 3 de Frantar e Alistarh numa linha de 4 pesos
// (a mesma do slide 8), até 50% de esparsidade. A cada rodada: erro de remover cada peso,
// eps_m = w_m² / [H⁻¹]_mm; sai o de menor erro; os demais recebem delta = −(w_m / [H⁻¹]_mm) · H⁻¹[:, m];
// a inversa perde a linha e a coluna m. Tudo é calculado aqui, a partir de w e X.
// Simplificação (ver README): o artigo percorre as colunas da esquerda para a direita e só ajusta os
// pesos à direita; aqui a remoção é pelo menor erro e todos os pesos restantes são ajustados.
(() => {
  const { svg: S, el, fmt, tex, rico } = LAB;
  const w0 = [0.82, -0.07, 0.31, -1.24];
  const X = [[1.0, 0.4, -0.6, 0.9, -0.3, 0.7], [-0.9, -0.5, 0.65, -0.9, 0.25, -0.6],
             [1.5, -0.42, -0.64, 1.23, 0.29, 0.03], [0.5, -0.9, 0.2, 0.6, 0.8, -0.4]];
  const T = 6;
  const saida = v => [...Array(T).keys()].map(t => v.reduce((s, wi, i) => s + wi * X[i][t], 0));
  const alvo = saida(w0), erro = v => saida(v).reduce((s, y, t) => s + (y - alvo[t]) ** 2, 0);
  function inversa(A) {
    const n = A.length, a = A.map((l, i) => [...l, ...A.map((_, j) => +(i === j))]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]];
      const piv = a[c][c]; a[c] = a[c].map(v => v / piv);
      for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; a[r] = a[r].map((v, k) => v - f * a[c][k]); }
    }
    return a.map(l => l.slice(n));
  }
  const H = X.map(a => X.map(b => a.reduce((s, v, t) => s + v * b[t], 0)));

  // Duas rodadas de remoção + compensação.
  const rodadas = [];
  { let w = [...w0], ativos = [0, 1, 2, 3], Hi = inversa(H); const fora = [];
    for (let k = 0; k < 2; k++) {
      const eps = ativos.map((i, p) => w[i] ** 2 / Hi[p][p]);
      const p = eps.indexOf(Math.min(...eps)), m = ativos[p];
      const col = Hi.map(l => l[p]), fator = -w[m] / Hi[p][p], delta = col.map(v => fator * v);
      const antes = [...w], depois = [...w];
      ativos.forEach((i, q) => { depois[i] += delta[q]; });
      depois[m] = 0; fora.push(m);
      const soZerar = w0.map((v, i) => fora.includes(i) ? 0 : v);
      rodadas.push({ ativos: [...ativos], Hi: Hi.map(l => [...l]), eps, p, m, col, fator, delta, antes, depois, soZerar, fora: [...fora] });
      Hi = Hi.map((l, a) => l.map((v, b) => v - Hi[a][p] * Hi[p][b] / Hi[p][p])).filter((_, a) => a !== p).map(l => l.filter((_, b) => b !== p));
      ativos = ativos.filter(i => i !== m); w = depois;
    }
  }

  // ---- Peças de desenho ----
  const num = (v, c = 2) => `<span class="num">${fmt(v, c)}</span>`;
  // Tabela: linhas = [rótulo (tex), valores[], classe(j) opcional, casas].
  function tabela(pai, colunas, linhas) {
    const t = el('div', { class: 'e3-tab', style: `--cols:${colunas.length}` }, pai);
    el('div', { class: 'cab vazio' }, t);
    colunas.forEach(c => el('div', { class: 'cab' }, t, tex(c)));
    linhas.forEach(([rot, vals, cls, casas = 2]) => {
      el('div', { class: 'rot' }, t, tex(rot));
      vals.forEach((v, j) => { const c = cls ? cls(j) || '' : ''; el('div', { class: 'cel ' + c }, t, c === 'zero' ? '<span class="num">0</span>' : num(v, casas)); });
    });
    return t;
  }
  function matriz(pai, nome, dados, rots, cls, casas = 2) {
    const caixa = el('div', { class: 'e3-mat' }, pai);
    el('div', { class: 'nome' }, caixa, tex(nome + ' ='));
    const g = el('div', { class: 'grade', style: `--cols:${dados[0].length}` }, caixa);
    dados.forEach((l, i) => l.forEach((v, j) => el('div', { class: 'cel ' + (cls ? cls(i, j) || '' : '') }, g, num(v, casas))));
    if (rots) { const r = el('div', { class: 'rots' }, caixa); rots.forEach(t => el('div', {}, r, tex(t))); }
    return caixa;
  }
  const idx = l => l.map(i => `w_${i + 1}`);

  const PASSOS = [
    { titulo: 'Ponto de partida',
      texto: 'Uma linha de pesos $w$ e as ativações de calibração $X$: 4 entradas (linhas) em 6 tokens (colunas). A saída original, $y = wX$, é o alvo.',
      desenha: p => matriz(p, 'X', X, ['x_1', 'x_2', 'x_3', 'x_4']) },
    { titulo: 'Hessiana', formula: 'H = XX^{\\top}',
      texto: 'Resume as ativações: cada elemento combina duas entradas ao longo dos tokens.',
      desenha: p => matriz(p, 'H', H) },
    { titulo: 'Inversa', formula: 'H^{-1}',
      texto: 'É a inversa que entra nas próximas contas. A diagonal vai dizer quanto custa remover cada peso.',
      desenha: p => matriz(p, 'H^{-1}', rodadas[0].Hi, null, (i, j) => i === j ? 'diag' : '') },
    { titulo: 'Erro de remover cada peso', formula: '\\varepsilon_m = \\dfrac{w_m^2}{[H^{-1}]_{mm}}',
      texto: 'O menor erro é o de $w_2$: ele sai primeiro.',
      desenha: p => { const r = rodadas[0]; tabela(p, idx(r.ativos), [
        ['w_m', r.antes, null], ['[H^{-1}]_{mm}', r.Hi.map((l, i) => l[i]), () => 'diag'],
        ['\\varepsilon_m', r.eps, j => j === r.p ? 'menor' : '', 4]]); } },
    { titulo: 'Compensar nos que ficam', formula: '\\boldsymbol{\\delta} = -\\dfrac{w_m}{[H^{-1}]_{mm}}\\, H^{-1}_{:,m}',
      texto: '$w_2$ vira zero e cada peso restante recebe o seu ajuste $\\delta$, tirado da coluna 2 de $H^{-1}$.',
      desenha: p => { const r = rodadas[0]; tabela(p, idx(r.ativos), [
        ['w', r.antes, j => j === r.p ? 'sai' : ''], ['H^{-1}_{:,2}', r.col, null],
        ['\\delta', r.delta, null, 3], ['w + \\delta', r.ativos.map(i => r.depois[i]), j => j === r.p ? 'zero' : 'novo']]); } },
    { titulo: 'De novo, com 3 pesos',
      texto: 'Sem $w_2$, a inversa perde a linha e a coluna 2, e os erros são recalculados. Agora o menor é o de $w_3$.',
      desenha: p => { const r = rodadas[1];
        matriz(p, 'H^{-1}', r.Hi, null, (i, j) => i === j ? 'diag' : '');
        tabela(p, idx(r.ativos), [['w_m', r.ativos.map(i => r.antes[i]), null], ['\\varepsilon_m', r.eps, j => j === r.p ? 'menor' : '', 4]]); } },
    { titulo: 'Segunda compensação', formula: '\\boldsymbol{\\delta} = -\\dfrac{w_m}{[H^{-1}]_{mm}}\\, H^{-1}_{:,m}',
      texto: () => `Metade dos pesos saiu. Só zerar daria erro ${fmt(erro(rodadas[1].soZerar), 2)}; compensando, ${fmt(erro(rodadas[1].depois), 2)}.`,
      desenha: p => { const r = rodadas[1]; tabela(p, idx(r.ativos), [
        ['w', r.ativos.map(i => r.antes[i]), j => j === r.p ? 'sai' : ''], ['H^{-1}_{:,3}', r.col, null],
        ['\\delta', r.delta, null, 3], ['w + \\delta', r.ativos.map(i => r.depois[i]), j => j === r.p ? 'zero' : 'novo']]); } },
  ];
  // Estado da linha w e do gráfico em cada passo: nenhuma rodada (0–3), 1ª (4–5) ou 2ª (6).
  const rodadaDo = n => n >= 6 ? 1 : n >= 4 ? 0 : -1;

  const palco = document.getElementById('e3-palco'), elW = document.getElementById('e3-w'), elLeg = document.getElementById('e3-leg');
  const graf = document.getElementById('e3-graf'), elPasso = document.getElementById('e3-passo');
  const bVolta = document.getElementById('e3-volta'), bProx = document.getElementById('e3-prox');
  let passo = 0;
  const prog = document.getElementById('e3-progresso');
  const marcos = PASSOS.map((p, k) => {
    const b = el('button', { type: 'button', 'aria-label': `Passo ${k + 1}: ${p.titulo}`, title: p.titulo }, prog);
    b.addEventListener('click', () => { passo = k; mostra(); });
    return b;
  });

  function linhaW(k) {
    elW.textContent = '';
    const w = k < 0 ? w0 : rodadas[k].depois, fora = k < 0 ? [] : rodadas[k].fora;
    w.forEach((v, i) => el('div', { class: 'cel ' + (fora.includes(i) ? 'zero' : k >= 0 ? 'novo' : '') }, elW, fora.includes(i) ? '<span class="num">0</span>' : num(v, 2)));
  }
  function grafico(k) {
    graf.textContent = '';
    const MEIO = 110, ESC = 62, GW = 420 / T, BAR = 18, ESP = 5, FX = 2 * BAR + 3 * ESP;
    S('path', { d: `M0 ${MEIO}H420`, class: 'eixo' }, graf);
    const barra = (v, x, larg, cls) => { const h = Math.abs(v) * ESC; S('rect', { x, y: v >= 0 ? MEIO - h : MEIO, width: larg, height: h, rx: 3, class: cls }, graf); };
    const semComp = k < 0 ? null : saida(rodadas[k].soZerar), comComp = k < 0 ? null : saida(rodadas[k].depois);
    alvo.forEach((v, t) => {
      const x = t * GW + (GW - FX) / 2;
      barra(v, x, FX, 'alvo');
      if (k >= 0) { barra(semComp[t], x + ESP, BAR, 'sem'); barra(comComp[t], x + 2 * ESP + BAR, BAR, 'com'); }
    });
    elLeg.innerHTML = '<span class="alvo">alvo</span>' + (k < 0 ? '' :
      `<span class="sem">só zerar: erro ${fmt(erro(rodadas[k].soZerar), k ? 2 : 4)}</span><span class="com">compensando: erro ${fmt(erro(rodadas[k].depois), k ? 2 : 4)}</span>`);
  }

  function mostra() {
    const p = PASSOS[passo];
    palco.textContent = '';
    el('h3', {}, palco, `<span class="n">${passo + 1}</span>${p.titulo}`);
    if (p.formula) el('div', { class: 'formula' }, palco, tex(p.formula, true));
    const corpo = el('div', { class: 'corpo' }, palco);
    p.desenha(corpo);
    el('p', { class: 'texto' }, palco, rico(typeof p.texto === 'function' ? p.texto() : p.texto));
    linhaW(rodadaDo(passo)); grafico(rodadaDo(passo));
    elPasso.textContent = `passo ${passo + 1} de ${PASSOS.length}`;
    marcos.forEach((b, k) => { b.classList.toggle('feito', k < passo); b.classList.toggle('atual', k === passo); if (k === passo) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    bVolta.disabled = passo === 0;
    bProx.disabled = passo === PASSOS.length - 1;
  }
  bVolta.addEventListener('click', () => { if (passo > 0) { passo--; mostra(); } });
  bProx.addEventListener('click', () => { if (passo < PASSOS.length - 1) { passo++; mostra(); } });
  mostra();
})();
