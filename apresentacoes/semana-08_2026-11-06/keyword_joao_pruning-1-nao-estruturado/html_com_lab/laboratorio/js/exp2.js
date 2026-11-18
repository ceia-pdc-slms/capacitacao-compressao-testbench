// Experimento 2 — Desligue pesos. Rede 4-6-6-3 (tanh nas camadas ocultas, saída linear), pesos sorteados
// com semente fixa e uma entrada fixa. O alvo y* é a saída da rede completa; erro = ||y − y*||².
// Todas as contas são feitas de verdade a cada clique (passada direta com a máscara atual).
// Botões: removem os 10% (8 conexões) de menor |w| ou de menor |w|·|x| entre as conexões ligadas,
// com |x| = ativação atual do neurônio de origem (o score do Wanda com uma única amostra).
(() => {
  const svg = document.getElementById('e2-rede'), { svg: S, fmt, tex, rico } = LAB;
  const T = [4, 6, 6, 3], X = [0.3, -1.6, 2.4, 0.1], LOTE = 8;
  const r = LAB.rng(12 * 7919);
  const W = [];
  for (let l = 0; l < 3; l++) W.push([...Array(T[l + 1])].map(() => [...Array(T[l])].map(() => r.normal() * 1.1 / Math.sqrt(T[l]))));
  const TOTAL = W.flat(2).length;
  const cheia = () => W.map(L => L.map(linha => linha.map(() => true)));
  let M = cheia();

  // Passada direta com a máscara M: devolve as ativações de todas as camadas.
  function direta(mask) {
    let a = X; const acts = [a];
    for (let l = 0; l < 3; l++) {
      const z = W[l].map((linha, i) => linha.reduce((s, w, j) => s + (mask[l][i][j] ? w * a[j] : 0), 0));
      a = l < 2 ? z.map(Math.tanh) : z;
      acts.push(a);
    }
    return acts;
  }
  const ALVO = direta(cheia())[3], NORMA2 = ALVO.reduce((s, v) => s + v * v, 0);
  const erroDe = y => y.reduce((s, v, k) => s + (v - ALVO[k]) ** 2, 0);
  const ligadas = mask => mask.flat(2).filter(Boolean).length;

  // Remove as LOTE conexões ligadas de menor score (modo 0: |w|; modo 1: |w|·|x|).
  function poda(mask, modo) {
    const acts = direta(mask), c = [];
    W.forEach((L, l) => L.forEach((linha, i) => linha.forEach((w, j) => {
      if (mask[l][i][j]) c.push([Math.abs(w) * (modo ? Math.abs(acts[l][j]) : 1), l, i, j]);
    })));
    c.sort((a, b) => a[0] - b[0]).slice(0, LOTE).forEach(([, l, i, j]) => { mask[l][i][j] = false; });
  }
  // Referência: erro de cada critério ao chegar a 50% (5 rodadas a partir da rede completa).
  const REF = [0, 1].map(modo => { const m = cheia(); for (let k = 0; k < 5; k++) poda(m, modo); return erroDe(direta(m)[3]); });

  // ---- Desenho ----
  const LX = [110, 350, 590, 800], AY = 14, AH = 452;
  const pos = (l, i) => [LX[l], AY + AH * (i + 0.5) / T[l]];
  const maxW = Math.max(...W.flat(2).map(Math.abs));
  const gA = S('g', {}, svg), gN = S('g', {}, svg);
  const arestas = [];
  W.forEach((L, l) => L.forEach((linha, i) => linha.forEach((w, j) => {
    const [x1, y1] = pos(l, j), [x2, y2] = pos(l + 1, i), d = `M${x1 + 18} ${y1}L${x2 - 18} ${y2}`;
    const g = S('g', { class: 'e2-aresta ' + (w < 0 ? 'neg' : 'pos') }, gA);
    const esp = (1.2 + 5 * Math.abs(w) / maxW).toFixed(2);
    S('path', { d, class: 'base', style: `stroke-width:${esp}px` }, g);
    S('path', { d, class: 'fluxo', style: `stroke-width:${esp}px` }, g);
    const toque = S('path', { d, class: 'toque' }, g);
    const a = { g, l, i, j, w };
    toque.addEventListener('click', () => { M[l][i][j] = !M[l][i][j]; atualiza(); info(a); });
    toque.addEventListener('mouseenter', () => { g.classList.add('foco'); info(a); });
    toque.addEventListener('mouseleave', () => { g.classList.remove('foco'); });
    arestas.push(a);
  })));
  const nos = T.map((n, l) => [...Array(n)].map((_, i) => {
    const [x, y] = pos(l, i);
    S('circle', { cx: x, cy: y, r: 18, class: 'e2-no-fundo' }, gN);
    return S('circle', { cx: x, cy: y, r: 18, class: 'e2-no' }, gN);
  }));
  X.forEach((v, i) => { const [x, y] = pos(0, i); S('text', { x: x - 30, y: y + 8, class: 'e2-val' }, gN, fmt(v, 1)); });
  ['entrada', 'tanh', 'tanh', 'saída'].forEach((t, l) => S('text', { x: LX[l], y: 496, class: 'e2-rot' }, gN, t));
  const rotSaida = T[3] ? [...Array(T[3])].map((_, i) => { const [x, y] = pos(3, i); return S('text', { x: x + 30, y: y + 8, class: 'e2-val esq' }, gN, ''); }) : [];

  // Painel: barras das saídas (alvo = faixa cinza; atual = barra colorida).
  const sv = document.getElementById('e2-saidas');
  const MEIO = 56, ESC = 44 / Math.max(1.2, ...ALVO.map(Math.abs)), BW = 56;
  S('path', { d: `M10 ${MEIO}H310`, class: 'eixo' }, sv);
  const barras = ALVO.map((v, k) => {
    const x = 40 + k * 96, h = Math.abs(v) * ESC;
    S('rect', { x: x - 8, y: v >= 0 ? MEIO - h : MEIO, width: BW + 16, height: h, rx: 3, class: 'alvo' }, sv);
    const t = S('text', { x: x + BW / 2, y: 126 }, sv, 'y'); S('tspan', { class: 'sub', dy: 4 }, t, String(k + 1));
    return S('rect', { x, width: BW, rx: 3, class: 'atual' }, sv);
  });

  const elEsp = document.getElementById('e2-esp'), elErro = document.getElementById('e2-erro'), elMed = document.getElementById('e2-medidor');
  const elInfo = document.getElementById('e2-info'), elRef = document.getElementById('e2-ref');
  function info(a) {
    const acts = direta(M), x = acts[a.l][a.j], on = M[a.l][a.i][a.j];
    elInfo.innerHTML = rico(`conexão ${on ? 'ligada' : 'desligada'}: $|w| = ${LAB.ftex(Math.abs(a.w))}$, $|w| \\cdot |x| = ${LAB.ftex(Math.abs(a.w * x))}$`);
  }

  function atualiza() {
    const acts = direta(M), y = acts[3], erro = erroDe(y), zeros = TOTAL - ligadas(M);
    let maxS = 0;
    arestas.forEach(a => { a.sinal = Math.abs(a.w * acts[a.l][a.j]); if (M[a.l][a.i][a.j]) maxS = Math.max(maxS, a.sinal); });
    arestas.forEach(a => {
      const on = M[a.l][a.i][a.j], rel = maxS ? a.sinal / maxS : 0;
      a.g.classList.toggle('off', !on);
      a.g.style.setProperty('--op', (0.25 + 0.65 * rel).toFixed(2));
      a.g.style.setProperty('--dur', (3.2 - 2.4 * rel).toFixed(2) + 's');
    });
    nos.forEach((camada, l) => camada.forEach((c, i) => {
      const v = acts[l][i], ref = l === 0 ? 2.4 : l === 3 ? Math.max(1.2, ...ALVO.map(Math.abs)) : 1;
      c.style.fillOpacity = (0.08 + 0.8 * Math.min(1, Math.abs(v) / ref)).toFixed(2);
    }));
    y.forEach((v, k) => {
      const h = Math.min(50, Math.abs(v) * ESC);
      barras[k].setAttribute('y', v >= 0 ? MEIO - h : MEIO);
      barras[k].setAttribute('height', h);
      rotSaida[k].textContent = fmt(v, 2);
    });
    elEsp.innerHTML = tex(`\\frac{${zeros}}{${TOTAL}} = ${Math.round(100 * zeros / TOTAL)}\\%`);
    elErro.textContent = fmt(erro, 3);
    elErro.className = erro < 0.02 * NORMA2 ? 'bom' : erro < 0.15 * NORMA2 ? 'medio' : 'ruim';
    elMed.style.width = Math.min(100, 100 * erro / NORMA2).toFixed(1) + '%';
    elMed.className = elErro.className;
    elRef.innerHTML = zeros / TOTAL >= 0.5
      ? rico(`A 50%, os botões chegam a: menores $|w|$ → erro ${fmt(REF[0], 3)}; menores $|w| \\cdot |x|$ → erro ${fmt(REF[1], 3)}.`)
      : 'Desafio: chegue a 50% de esparsidade com o menor erro que conseguir.';
  }

  document.getElementById('e2-mag').addEventListener('click', () => { poda(M, 0); atualiza(); elInfo.textContent = ''; });
  document.getElementById('e2-wanda').addEventListener('click', () => { poda(M, 1); atualiza(); elInfo.textContent = ''; });
  document.getElementById('e2-reset').addEventListener('click', () => { M = cheia(); atualiza(); elInfo.textContent = ''; });
  atualiza();
})();
