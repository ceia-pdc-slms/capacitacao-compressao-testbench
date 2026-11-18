// Parte 2: Tokens/s. Pythia-1B no decode com batch 1: quais parâmetros mudam o teto de tokens/s
// imposto pela banda, e como. Três controles (banda, precisão dos pesos e contexto) alteram duas
// barras em escalas fixas (bytes lidos por token e tempo mínimo por token) e um velocímetro com o
// teto de tokens/s (escala logarítmica: dobrar a banda gira o ponteiro sempre o mesmo ângulo; a cor
// vai do vermelho, lento, ao verde, rápido).
// As equações ficam em “Entenda este resultado”, no fim da seção.
(function () {
  'use strict';
  const { modelo: M, formato: F, ui } = window.Lab;
  const { GB, KiB } = M.UNIDADES;
  const P = M.PYTHIA_1B;
  const FAIXAS = M.FAIXAS_TOKENS;
  const PRECISOES = M.PRECISOES_PESOS;
  const PADRAO = { bandaGBs: M.PADROES.bandaGBs, precisao: PRECISOES[0].id, contexto: M.PADROES.contexto };
  const UNIDADE = { bandaGBs: 'GB/s', contexto: 'posições' };

  // Geometria (viewBox 1000 × 760). Escalas fixas: o maior caso de cada barra cabe na área.
  const BAR = { x0: 250, x1: 900, h: 56 };
  const BYTES_MAX = 2.2 * GB;                                         // > 2,086 GB (FP16, 2.048 posições)
  const TEMPO_MAX = BYTES_MAX / (FAIXAS.bandaGBs[0] * GB);            // 44 ms (com a menor banda)
  const LINHA = { bytes: 70, tempo: 250 };
  const largura = (v, max) => v / max * (BAR.x1 - BAR.x0);

  // Velocímetro: arco de 240° (de 210° a −30°, ângulos matemáticos), escala log de 10 a 10.000 tokens/s.
  // Cobre todo o intervalo dos controles (≈ 24 a ≈ 4.400 tokens/s).
  const VEL = { cx: (BAR.x0 + BAR.x1) / 2, cy: 590, r: 190, ini: 210, varre: 240, dec: [1, 4] };
  const fracao = t => (Math.log10(Math.min(10 ** VEL.dec[1], Math.max(10 ** VEL.dec[0], t))) - VEL.dec[0]) / (VEL.dec[1] - VEL.dec[0]);
  const angulo = t => VEL.ini - VEL.varre * fracao(t);
  const ponto = (graus, r) => { const a = graus * Math.PI / 180; return [VEL.cx + r * Math.cos(a), VEL.cy - r * Math.sin(a)]; };
  // Cor própria do velocímetro: interpolada em OKLCH do vermelho (lento) ao verde (rápido), passando
  // pelo laranja, conforme a posição do ponteiro no arco. Usada no arco preenchido e no mostrador.
  const LENTO = '#fc6255', RAPIDO = '#83c167';
  const linear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const gama = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function paraOklch(hex) {
    const [r, gr, b] = [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
    const [l, m, s] = [0.4122214708 * r + 0.5363325363 * gr + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * gr + 0.1073969566 * b,
      0.0883024619 * r + 0.2817188376 * gr + 0.6299787005 * b].map(Math.cbrt);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function deOklch([L, C, h]) {
    const A = C * Math.cos(h), B = C * Math.sin(h);
    const [l, m, s] = [L + 0.3963377774 * A + 0.2158037573 * B, L - 0.1055613458 * A - 0.0638541728 * B, L - 0.0894841775 * A - 1.2914855480 * B].map(x => x ** 3);
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return `rgb(${rgb.map(c => Math.round(255 * gama(Math.min(1, Math.max(0, c))))).join(', ')})`;
  }
  const [C0, C1] = [paraOklch(LENTO), paraOklch(RAPIDO)];
  const corVelocidade = f => deOklch(C0.map((v, i) => v + (C1[i] - v) * f));

  const arco = (a0, a1, r) => {
    const [x0, y0] = ponto(a0, r), [x1, y1] = ponto(a1, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a0 - a1 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  let svg, el = {}, alvo = { ...PADRAO }, g = {}, anguloAtual = null, quadro = 0;

  const precisao = () => PRECISOES.find(p => p.id === alvo.precisao);
  const gb = (x, casas = 3) => `${F.numero(x / GB, casas)} GB`;
  const ms = s => `${F.numero(s * 1000, s < 0.01 ? 2 : 1)} ms`;
  const tps = x => F.numero(x, x < 100 ? 1 : 0);

  function calcular() {
    const b = precisao().bytes;
    const pesos = M.bytesPesosLidosPorToken() / P.bytesPorValor * b;
    const kv = M.bytesKV(alvo.contexto);
    const total = M.bytesPorToken(alvo.contexto, P, b);
    const banda = alvo.bandaGBs * GB;
    return { b, pesos, kv, total, banda, tempo: M.tempoPorToken(banda, total), tps: M.tokensPorSegundo(banda, total) };
  }

  function eixo(y, max, passo, rotulo) {
    for (let v = 0; v <= max + 1e-9; v += passo) {
      const x = BAR.x0 + largura(v, max);
      ui.svg('path', { d: `M${x} ${y + BAR.h + 6}v8`, class: 'tick-line' }, svg);
      ui.svg('text', { x, y: y + BAR.h + 38, class: 'tick' }, svg, rotulo(v));
    }
  }

  function montar() {
    // Linha 1: bytes lidos da memória a cada token (pesos + KV cache).
    ui.svg('text', { x: 20, y: LINHA.bytes + 24, class: 'row-label' }, svg, 'lido por token');
    ui.svg('text', { x: 20, y: LINHA.bytes + 50, class: 'row-sub' }, svg, 'pesos + KV cache');
    ui.svg('rect', { x: BAR.x0, y: LINHA.bytes, width: BAR.x1 - BAR.x0, height: BAR.h, class: 'track' }, svg);
    g.pesos = ui.svg('rect', { x: BAR.x0, y: LINHA.bytes, height: BAR.h, class: 'seg pesos' }, svg);
    g.kv = ui.svg('rect', { y: LINHA.bytes, height: BAR.h, class: 'seg kv' }, svg);
    g.rotPesos = ui.svg('text', { y: LINHA.bytes + BAR.h / 2 + 8, class: 'seg-label' }, svg);
    g.rotKV = ui.svg('text', { y: LINHA.bytes - 14, class: 'kv-label' }, svg);
    g.totalBytes = ui.svg('text', { y: LINHA.bytes + BAR.h / 2 + 8, class: 'bar-value' }, svg);
    eixo(LINHA.bytes, BYTES_MAX, 0.5 * GB, v => `${F.numero(v / GB, 1)} GB`);

    // Linha 2: tempo mínimo por token = bytes ÷ banda.
    ui.svg('text', { x: 20, y: LINHA.tempo + 24, class: 'row-label' }, svg, 'tempo por token');
    ui.svg('text', { x: 20, y: LINHA.tempo + 50, class: 'row-sub' }, svg, 'bytes ÷ banda');
    ui.svg('rect', { x: BAR.x0, y: LINHA.tempo, width: BAR.x1 - BAR.x0, height: BAR.h, class: 'track' }, svg);
    g.tempo = ui.svg('rect', { x: BAR.x0, y: LINHA.tempo, height: BAR.h, class: 'seg tempo' }, svg);
    g.totalTempo = ui.svg('text', { y: LINHA.tempo + BAR.h / 2 + 8, class: 'bar-value' }, svg);
    eixo(LINHA.tempo, TEMPO_MAX, 0.01, v => `${F.numero(v * 1000)} ms`);

    // Linha 3: velocímetro com o teto de tokens/s = banda ÷ bytes.
    ui.svg('text', { x: 20, y: VEL.cy - 26, class: 'row-label' }, svg, 'teto');
    ui.svg('text', { x: 20, y: VEL.cy, class: 'row-sub' }, svg, 'banda ÷ bytes');
    ui.svg('path', { d: arco(VEL.ini, VEL.ini - VEL.varre, VEL.r), class: 'gauge-track' }, svg);
    g.arco = ui.svg('path', { class: 'gauge-fill' }, svg);
    for (let e = VEL.dec[0]; e <= VEL.dec[1]; e++) {
      for (let m = 1; m <= (e < VEL.dec[1] ? 9 : 1); m++) {
        const a = angulo(m * 10 ** e), maior = m === 1;
        const [x0, y0] = ponto(a, VEL.r - (maior ? 22 : 12)), [x1, y1] = ponto(a, VEL.r + (maior ? 14 : 0));
        ui.svg('path', { d: `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`, class: maior ? 'gauge-tick major' : 'gauge-tick' }, svg);
        if (maior) {
          const [x, y] = ponto(a, VEL.r + 44);
          ui.svg('text', { x: x.toFixed(2), y: (y + 8).toFixed(2), class: 'tick' }, svg, F.numero(10 ** e));
        }
      }
    }
    g.ponteiro = ui.svg('g', { class: 'gauge-needle' }, svg);
    const ponta = VEL.cx + VEL.r - 30, { cx, cy } = VEL;
    ui.svg('path', { d: `M${cx - 26} ${cy - 3}L${cx} ${cy - 7}L${ponta} ${cy - 1.5}L${ponta} ${cy + 1.5}L${cx} ${cy + 7}L${cx - 26} ${cy + 3}Z` }, g.ponteiro);
    ui.svg('circle', { cx: VEL.cx, cy: VEL.cy, r: 13, class: 'gauge-hub' }, svg);
    g.resultado = ui.svg('text', { x: VEL.cx, y: VEL.cy + 92, class: 'resultado' }, svg);
    ui.svg('text', { x: VEL.cx, y: VEL.cy + 128, class: 'resultado-unidade' }, svg, 'tokens/s');
  }

  // Ponteiro e arco preenchido no ângulo dado.
  function ponteiro(a) {
    g.ponteiro.setAttribute('transform', `rotate(${(-a).toFixed(3)} ${VEL.cx} ${VEL.cy})`);
    g.arco.setAttribute('d', VEL.ini - a < 0.05 ? '' : arco(VEL.ini, a, VEL.r));
    const cor = corVelocidade((VEL.ini - a) / VEL.varre);
    g.arco.style.stroke = cor; g.resultado.style.fill = cor;
  }

  // Gira o ponteiro até o novo teto com desaceleração suave (instantâneo com movimento reduzido).
  function girar(destino) {
    cancelAnimationFrame(quadro);
    if (anguloAtual === null || ui.reduzirMovimento() || Math.abs(destino - anguloAtual) < 0.05) {
      anguloAtual = destino; ponteiro(destino); return;
    }
    const origem = anguloAtual, inicio = performance.now(), duracao = 320 / ui.VELOCIDADE;
    const passo = agora => {
      const u = Math.min(1, (agora - inicio) / duracao), e = 1 - (1 - u) ** 3;
      anguloAtual = origem + (destino - origem) * e; ponteiro(anguloAtual);
      if (u < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
  }

  function desenhar() {
    const c = calcular();
    const wP = largura(c.pesos, BYTES_MAX), wK = Math.max(largura(c.kv, BYTES_MAX), 1.5);
    g.pesos.setAttribute('width', wP);
    g.kv.setAttribute('x', BAR.x0 + wP); g.kv.setAttribute('width', wK);
    const fimBytes = BAR.x0 + wP + wK;

    // Rótulo dentro da barra roxa: completo quando cabe; senão, só o valor.
    g.rotPesos.setAttribute('x', BAR.x0 + wP / 2);
    g.rotPesos.textContent = `pesos (${precisao().nome}): ${gb(c.pesos)}`;
    if (g.rotPesos.getComputedTextLength() + 24 > wP) g.rotPesos.textContent = gb(c.pesos);
    g.rotKV.textContent = `KV cache: ${F.bytes(c.kv, 3)}`;
    g.rotKV.setAttribute('x', Math.min(fimBytes, BAR.x1));
    g.totalBytes.textContent = gb(c.total);
    g.totalBytes.setAttribute('x', fimBytes + 14);

    const wT = Math.max(largura(c.tempo, TEMPO_MAX), 1.5);
    g.tempo.setAttribute('width', wT);
    g.totalTempo.textContent = ms(c.tempo);
    g.totalTempo.setAttribute('x', BAR.x0 + wT + 14);

    g.resultado.textContent = `≈ ${tps(c.tps)}`;
    girar(angulo(c.tps));
    textos(c);
  }

  function textos(c) {
    el.desc.textContent = `Pythia-1B, batch 1. Com pesos em ${precisao().nome} e ${F.numero(alvo.contexto)} ${alvo.contexto === 1 ? 'posição' : 'posições'} no KV cache, ` +
      `cada token lê ${gb(c.total)} da memória: ${gb(c.pesos)} de pesos e ${F.bytes(c.kv, 3)} de KV cache. ` +
      `Com ${F.numero(alvo.bandaGBs)} GB/s, isso leva ao menos ${ms(c.tempo)} por token: teto de cerca de ${tps(c.tps)} tokens por segundo.`;

    const n = F.numero, tex = s => s.replace(/\./g, '{.}').replace(/,/g, '{,}');
    const teX = `\\text{tokens/s} \\le \\frac{${tex(n(alvo.bandaGBs))}\\ \\text{GB/s}}{${tex(n(c.pesos / GB, 3))}\\ \\text{GB} + ${tex(n(c.kv / GB, 3))}\\ \\text{GB}} \\approx ${tex(tps(c.tps))}\\ \\text{tokens/s}`;
    if (window.katex) katex.render(teX, el.equacao, { displayMode: true, throwOnError: false });
    else el.equacao.textContent = teX;

    const lidos = M.bytesPesosLidosPorToken() / P.bytesPorValor;
    el.contas.replaceChildren(...[
      `Pesos lidos: ${n(lidos)} parâmetros × ${n(c.b, c.b % 1 ? 1 : 0)} byte${c.b === 1 ? '' : 's'} (${precisao().nome}) = ${gb(c.pesos)}.`,
      `KV cache: ${n(alvo.contexto)} ${alvo.contexto === 1 ? 'posição' : 'posições'} × ${n(M.bytesKVPorPosicao())} bytes (128 KiB) = ${F.bytes(c.kv, 3)}.`,
      `Bytes por token: ${gb(c.pesos)} + ${F.bytes(c.kv, 3)} = ${gb(c.total)}.`,
      `Tempo mínimo por token: ${gb(c.total)} ÷ ${n(alvo.bandaGBs)} GB/s = ${ms(c.tempo)}.`,
      `Teto: 1 ÷ ${ms(c.tempo)} ≈ ${tps(c.tps)} tokens/s.`,
    ].map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));

    for (const [param, c2] of Object.entries(el.controles)) { c2.range.value = alvo[param]; c2.campo.sincronizar(); }
    el.precisoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.precisao === alvo.precisao)));
  }

  function definir(novos) {
    if (novos.bandaGBs !== undefined) alvo.bandaGBs = Math.min(FAIXAS.bandaGBs[1], Math.max(FAIXAS.bandaGBs[0], novos.bandaGBs));
    if (novos.contexto !== undefined) alvo.contexto = Math.min(FAIXAS.contexto[1], Math.max(FAIXAS.contexto[0], Math.round(novos.contexto)));
    if (novos.precisao !== undefined) alvo.precisao = novos.precisao;
    desenhar();
  }

  function iniciar(section) {
    svg = section.querySelector('#tok-cena');
    el = {
      desc: section.querySelector('#tok-cena-desc'),
      equacao: section.querySelector('#tok-equacao'),
      contas: section.querySelector('#tok-contas'),
      precisoes: [...section.querySelectorAll('[data-precisao]')],
      controles: {},
    };
    montar();

    section.querySelectorAll('.slider').forEach(div => {
      const param = div.dataset.param;
      const range = div.querySelector('input[type=range]'), numero = div.querySelector('input[type=number]');
      const campo = ui.campoNumerico(numero, div.querySelector('.field-msg'), {
        faixa: FAIXAS[param], unidade: UNIDADE[param], formatar: v => F.numero(v), inteiro: true,
        atual: () => alvo[param], aplicar: v => definir({ [param]: v }),
      });
      el.controles[param] = { range, campo };
      range.addEventListener('input', () => { campo.limpar(); definir({ [param]: +range.value }); });
    });
    const limpar = () => Object.values(el.controles).forEach(c => c.campo.limpar());
    el.precisoes.forEach(b => b.addEventListener('click', () => { limpar(); definir({ precisao: b.dataset.precisao }); }));
    section.querySelector('#tok-reset').addEventListener('click', () => { limpar(); definir({ ...PADRAO }); });

    desenhar();
  }

  window.Lab.experimentos.push({ id: 'tokens', iniciar, entrar() { if (svg) desenhar(); } });
})();
