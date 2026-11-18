// Parte 1: Roofline interativo com eixos lineares. Os controles definem a banda B, o pico
// de cálculo e a intensidade I; o gráfico e os indicadores mostram P_limite = min(P_pico, B·I).
// Os eixos são fixos: mudar B muda a inclinação da reta da banda. Botões e campos deslizam do
// estado anterior ao novo; ao arrastar um deslizante, o gráfico acompanha sem interpolação.
(function () {
  'use strict';
  const { modelo: M, formato: F, ui } = window.Lab;
  const { GB, TFLOP } = M.UNIDADES;
  const FAIXAS = M.FAIXAS_ROOFLINE;
  const PADRAO = { bandaGBs: M.PADROES.bandaGBs, picoTFLOPs: M.PADROES.picoTFLOPs, intensidade: M.PRESETS_ROOFLINE.decode.intensidade };
  const UNIDADE = { bandaGBs: 'GB/s', picoTFLOPs: 'TFLOP/s', intensidade: 'FLOP/byte' };

  // Área do gráfico (viewBox 1000 × 700) e eixos lineares fixos (M.EIXOS_ROOFLINE).
  const PLOT = { x0: 120, x1: 960, y0: 30, y1: 620 };
  const I_MAX = M.EIXOS_ROOFLINE.intensidadeMax, P_MAX = M.EIXOS_ROOFLINE.desempenhoMaxTFLOPs * TFLOP;
  const PASSO_X = 100, PASSO_Y = 10 * TFLOP;     // marcas dos eixos
  const TWEEN = 0.45;                           // s, antes da velocidade comum

  let svg, el = {}, alvo = { ...PADRAO }, atual = { ...PADRAO }, quadro = null, g = {};

  const X = i => PLOT.x0 + i / I_MAX * (PLOT.x1 - PLOT.x0);
  const Y = p => PLOT.y1 - p / P_MAX * (PLOT.y1 - PLOT.y0);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // Arredonda para 3 algarismos significativos, para exibir valores calculados.
  function redondo(x) {
    const p = 10 ** (Math.floor(Math.log10(x)) - 2);
    return Math.round(x / p) * p;
  }
  function numeroCurto(x) {
    if (x >= 100) return F.numero(Math.round(x));
    if (x >= 10) return F.numero(x, x % 1 ? 1 : 0);
    if (x >= 1) return F.numero(x, Math.abs(x - Math.round(x)) < 1e-9 ? 0 : 2).replace(/,?0+$/, '');
    return F.numero(x, 3).replace(/0+$/, '').replace(/,$/, '');
  }
  const tflops = flops => numeroCurto(redondo(flops / TFLOP));

  function montarEixos() {
    const defs = ui.svg('defs', {}, svg);
    const clip = ui.svg('clipPath', { id: 'exp1-area' }, defs);
    ui.svg('rect', { x: PLOT.x0, y: PLOT.y0, width: PLOT.x1 - PLOT.x0, height: PLOT.y1 - PLOT.y0 }, clip);

    g.regioes = ui.svg('g', { 'clip-path': 'url(#exp1-area)' }, svg);
    g.memoria = ui.svg('rect', { y: PLOT.y0, height: PLOT.y1 - PLOT.y0, class: 'region memoria' }, g.regioes);
    g.calculo = ui.svg('rect', { y: PLOT.y0, height: PLOT.y1 - PLOT.y0, class: 'region calculo' }, g.regioes);

    // Grade e marcas lineares: a cada 100 FLOP/byte e a cada 10 TFLOP/s.
    const grade = ui.svg('g', { class: 'grid' }, svg);
    for (let i = 0; i <= I_MAX; i += PASSO_X) {
      const x = X(i);
      ui.svg('path', { d: `M${x} ${PLOT.y0}V${PLOT.y1}` }, grade);
      // O 0 do eixo x fica implícito no 0 do eixo y, para não disputar a origem com o decode.
      if (i > 0) ui.svg('text', { x, y: PLOT.y1 + 30, class: 'tick' }, svg, F.numero(i));
    }
    for (let p = 0; p <= P_MAX; p += PASSO_Y) {
      const y = Y(p);
      ui.svg('path', { d: `M${PLOT.x0} ${y}H${PLOT.x1}` }, grade);
      ui.svg('text', { x: PLOT.x0 - 12, y: y + 7, class: 'tick y' }, svg, F.numero(p / TFLOP));
    }
    ui.svg('rect', { x: PLOT.x0, y: PLOT.y0, width: PLOT.x1 - PLOT.x0, height: PLOT.y1 - PLOT.y0, class: 'frame' }, svg);
    const tituloX = ui.svg('text', { x: (PLOT.x0 + PLOT.x1) / 2, y: PLOT.y1 + 68, class: 'axis-title' }, svg, 'intensidade aritmética ');
    ui.svg('tspan', { class: 'math' }, tituloX, 'I');
    ui.svg('tspan', {}, tituloX, ' (FLOP/byte)');
    ui.svg('text', { x: 28, y: (PLOT.y0 + PLOT.y1) / 2, class: 'axis-title', transform: `rotate(-90 28 ${(PLOT.y0 + PLOT.y1) / 2})` }, svg, 'desempenho (TFLOP/s)');

    const area = ui.svg('g', { 'clip-path': 'url(#exp1-area)' }, svg);
    g.extBanda = ui.svg('path', { class: 'ext banda' }, area);
    g.extPico = ui.svg('path', { class: 'ext pico' }, area);
    g.transicao = ui.svg('path', { class: 'transition' }, area);
    g.tetoBanda = ui.svg('path', { class: 'roof banda' }, area);
    g.tetoPico = ui.svg('path', { class: 'roof pico' }, area);
    g.guiaX = ui.svg('path', { class: 'guide' }, area);
    g.guiaY = ui.svg('path', { class: 'guide' }, area);
    g.rotMemoria = ui.svg('text', { y: PLOT.y0 + 30, class: 'region-label memoria' }, svg, 'limitado pela memória');
    g.rotCalculo = ui.svg('text', { y: PLOT.y0 + 30, class: 'region-label calculo' }, svg, 'limitado pelo cálculo');
    g.rotBanda = ui.svg('text', { class: 'line-label banda' }, svg, '');
    g.rotPico = ui.svg('text', { class: 'line-label pico' }, svg, '');
    g.rotTransicao = ui.svg('text', { class: 'transition-label' }, svg, '');

    // Posições ilustrativas de decode e prefill, sobre o teto atual.
    g.presets = Object.entries(M.PRESETS_ROOFLINE).map(([id, p]) => {
      const grupo = ui.svg('g', { class: `preset ${id}` }, svg);
      return { p, c: ui.svg('circle', { r: 7 }, grupo), t: ui.svg('text', {}, grupo, id) };
    });
    g.ponto = ui.svg('circle', { r: 11, class: 'point' }, svg);
    g.rotPonto = ui.svg('text', { class: 'point-label' }, svg, '');
  }

  // Rótulos sem sobreposição: em ordem de prioridade, cada rótulo tenta as posições candidatas e
  // fica na primeira que não colide com os já posicionados; se nenhuma servir, é ocultado.
  function retangulo(node) {
    const r = node.getBoundingClientRect();
    return { l: r.left - 3, r: r.right + 3, t: r.top - 2, b: r.bottom + 2 };
  }
  const colide = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  function posicionarRotulos(itens) {
    // As marcas dos eixos também contam como ocupadas.
    const ocupados = [...svg.querySelectorAll('.tick')].map(retangulo);
    for (const { node, posicoes, visivel = true } of itens) {
      node.style.opacity = 0;
      if (!visivel) continue;
      for (const aplicar of posicoes) {
        aplicar();
        const r = retangulo(node);
        if (r.r - r.l < 4) break;                      // sem texto
        if (!ocupados.some(o => colide(o, r))) { node.style.opacity = 1; ocupados.push(r); break; }
      }
    }
  }
  const em = (node, x, y) => () => { node.setAttribute('x', x); node.setAttribute('y', y); };

  function desenhar(v) {
    const B = v.bandaGBs * GB, P = v.picoTFLOPs * TFLOP, I = v.intensidade;
    const It = M.intensidadeTransicao({ picoFlops: P, bandaBytes: B });
    const lim = M.desempenhoLimite({ picoFlops: P, bandaBytes: B, intensidade: I });
    const xt = clamp(X(It), PLOT.x0, PLOT.x1), yp = Y(P);

    g.memoria.setAttribute('x', PLOT.x0); g.memoria.setAttribute('width', xt - PLOT.x0);
    g.calculo.setAttribute('x', xt); g.calculo.setAttribute('width', PLOT.x1 - xt);
    g.extBanda.setAttribute('d', `M${X(0)} ${Y(0)}L${X(I_MAX)} ${Y(B * I_MAX)}`);
    g.extPico.setAttribute('d', `M${PLOT.x0} ${yp}H${PLOT.x1}`);
    g.tetoBanda.setAttribute('d', `M${X(0)} ${Y(0)}L${X(It)} ${yp}`);
    g.tetoPico.setAttribute('d', `M${X(It)} ${yp}H${PLOT.x1}`);
    g.transicao.setAttribute('d', `M${X(It)} ${PLOT.y0}V${PLOT.y1}`);

    g.presets.forEach(({ p, c }) => {
      c.setAttribute('cx', X(p.intensidade));
      c.setAttribute('cy', Y(M.desempenhoLimite({ picoFlops: P, bandaBytes: B, intensidade: p.intensidade })));
    });
    const xo = X(I), yo = Y(lim);
    g.ponto.setAttribute('cx', xo); g.ponto.setAttribute('cy', yo);
    g.guiaX.setAttribute('d', `M${xo} ${yo}V${PLOT.y1}`);
    g.guiaY.setAttribute('d', `M${PLOT.x0} ${yo}H${xo}`);

    // Textos dos rótulos.
    g.rotPonto.textContent = `${tflops(lim)} TFLOP/s`;
    g.rotPico.textContent = `pico: ${numeroCurto(redondo(v.picoTFLOPs))} TFLOP/s`;
    g.rotBanda.textContent = `banda: ${numeroCurto(redondo(v.bandaGBs))} GB/s`;
    g.rotTransicao.textContent = `transição: ${numeroCurto(redondo(It))} FLOP/byte`;

    // Rótulo da banda ao longo da diagonal (inclinação proporcional a B), abaixo e à direita dela.
    const rad = Math.atan2(Y(B * 10) - Y(0), X(10) - X(0)), ang = rad * 180 / Math.PI;
    const iRot = Math.min(It, I_MAX) * 0.62;
    const xb = X(iRot) - Math.sin(rad) * 30, yb = Y(B * iRot) + Math.cos(rad) * 30;
    const compBanda = Math.hypot(X(Math.min(It, I_MAX)) - X(0), Y(0) - Y(B * Math.min(It, I_MAX)));
    g.rotBanda.setAttribute('transform', `rotate(${ang} ${xb} ${yb})`);
    // Centro horizontal que mantém o rótulo inteiro dentro da área do gráfico.
    const noPlot = (node, x) => { const m = node.getComputedTextLength() / 2 + 8; return clamp(x, PLOT.x0 + m, PLOT.x1 - m); };
    const xpx = noPlot(g.rotPonto, X(I));
    const xPico = noPlot(g.rotPico, (Math.max(xt, PLOT.x0) + PLOT.x1) / 2);
    const xTr = noPlot(g.rotTransicao, X(It));
    const dentro = (x, y) => x >= PLOT.x0 && x <= PLOT.x1 && y >= PLOT.y0 && y <= PLOT.y1;

    posicionarRotulos([
      { node: g.rotPonto, posicoes: [em(g.rotPonto, xpx, yo - 24), em(g.rotPonto, xpx, yo + 40),
        em(g.rotPonto, noPlot(g.rotPonto, xo + 110), yo + 7), em(g.rotPonto, noPlot(g.rotPonto, xo - 110), yo + 7)] },
      { node: g.rotPico, posicoes: [em(g.rotPico, xPico, yp - 14), em(g.rotPico, xPico, yp + 30)] },
      { node: g.rotTransicao, visivel: X(It) >= PLOT.x0 && X(It) <= PLOT.x1, posicoes: [em(g.rotTransicao, xTr, PLOT.y1 - 14), em(g.rotTransicao, xTr, PLOT.y0 + 60)] },
      { node: g.rotBanda, visivel: compBanda > 240 && dentro(xb, yb), posicoes: [em(g.rotBanda, xb, yb)] },
      ...g.presets.map(({ c, t }) => {
        const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
        return { node: t, posicoes: [em(t, x, y + 30), em(t, x, y - 16), em(t, x + 70, y - 62)] };
      }),
      { node: g.rotMemoria, visivel: xt - PLOT.x0 > 250, posicoes: [em(g.rotMemoria, (PLOT.x0 + xt) / 2, PLOT.y0 + 30)] },
      { node: g.rotCalculo, visivel: PLOT.x1 - xt > 250, posicoes: [em(g.rotCalculo, (xt + PLOT.x1) / 2, PLOT.y0 + 30)] },
    ]);
  }

  // Indicadores, equação e descrição usam sempre os valores-alvo (não os intermediários).
  function textos() {
    const B = alvo.bandaGBs * GB, P = alvo.picoTFLOPs * TFLOP, I = alvo.intensidade;
    const It = M.intensidadeTransicao({ picoFlops: P, bandaBytes: B });
    const lim = M.desempenhoLimite({ picoFlops: P, bandaBytes: B, intensidade: I });
    const estado = M.gargalo({ picoFlops: P, bandaBytes: B, intensidade: I });
    const fracao = lim / P;
    const pct = `${F.numero(fracao * 100, fracao < 0.1 ? 1 : 0)} %`;
    const iTxt = numeroCurto(redondo(I)), itTxt = numeroCurto(redondo(It));
    const GARGALO = {
      memoria: ['memória', 'memory-bound', 'limitada pela memória'],
      calculo: ['cálculo', 'compute-bound', 'limitada pelo cálculo'],
      equilibrio: ['os dois (transição)', 'banda e cálculo empatam', 'na transição: banda e cálculo limitam igualmente'],
    }[estado];
    ui.indicadores(el.indicadores, [
      ['Limite de desempenho', `${tflops(lim)} TFLOP/s`, { destaque: true }],
      ['Gargalo', GARGALO[0], { nota: GARGALO[1] }],
      ['Transição', `${itTxt} FLOP/byte`],
      ['Uso da capacidade máxima de cálculo', pct],
    ]);
    const tex = x => numeroCurto(x).replace(/\./g, '{.}').replace(',', '{,}');
    const teX = `P_{\\text{limite}} = \\min\\left(${tex(redondo(alvo.picoTFLOPs))}\\ \\text{TFLOP/s},\\ ${tex(redondo(alvo.bandaGBs))}\\ \\text{GB/s} \\times ${tex(redondo(I))}\\ \\text{FLOP/byte}\\right) = ${tex(redondo(lim / TFLOP))}\\ \\text{TFLOP/s}`;
    if (window.katex) katex.render(teX, el.equacao, { displayMode: true, throwOnError: false });
    el.desc.textContent = `Gráfico Roofline com eixos lineares: intensidade de 0 a 600 FLOP/byte e desempenho de 0 a 44 TFLOP/s. Banda ${numeroCurto(redondo(alvo.bandaGBs))} GB/s, pico ${tflops(P)} TFLOP/s, ` +
      `transição em ${itTxt} FLOP/byte. Operação com intensidade ${iTxt} FLOP/byte: limite de ${tflops(lim)} TFLOP/s, ${GARGALO[2]}.`;
    sincronizarControles();
  }

  // Controles: deslizante linear (min, max e passo no HTML) + campo numérico.
  // O campo em edição não é reescrito a cada mudança externa; ao confirmar, mostra o valor aplicado.
  function sincronizarControles() {
    for (const [param, c] of Object.entries(el.controles)) {
      c.range.value = alvo[param];
      c.campo.sincronizar();
      c.range.setAttribute('aria-valuetext', `${numeroCurto(redondo(alvo[param]))} ${UNIDADE[param]}`);
    }
  }

  // imediato = true (arrastar um deslizante): desenha o alvo já, sem interpolação, para o gráfico
  // acompanhar o dedo/mouse. Botões e campos continuam com a transição suave.
  function definir(novos, imediato = false) {
    for (const [param, v] of Object.entries(novos))
      if (Number.isFinite(v) && v > 0) alvo[param] = clamp(v, FAIXAS[param][0], FAIXAS[param][1]);
    textos();
    if (imediato) {
      if (quadro) { cancelAnimationFrame(quadro); quadro = null; }
      atual = { ...alvo };
      desenhar(atual);
    } else animar();
  }

  // Interpolação linear entre o estado atual e o alvo.
  function animar() {
    if (quadro) cancelAnimationFrame(quadro);
    if (ui.reduzirMovimento()) { atual = { ...alvo }; desenhar(atual); return; }
    const de = { ...atual }, dur = TWEEN / ui.VELOCIDADE * 1000;
    let inicio = null;
    const passo = agora => {
      if (inicio === null) inicio = agora;
      const p = clamp((agora - inicio) / dur, 0, 1), e = 1 - (1 - p) ** 3;
      for (const k of Object.keys(alvo)) atual[k] = de[k] + (alvo[k] - de[k]) * e;
      desenhar(atual);
      quadro = p < 1 ? requestAnimationFrame(passo) : null;
    };
    quadro = requestAnimationFrame(passo);
  }

  function iniciar(section) {
    svg = section.querySelector('#exp1-grafico');
    el = {
      indicadores: section.querySelector('#exp1-indicadores'),
      equacao: section.querySelector('#exp1-equacao'),
      registro: section.querySelector('#exp1-registro'),
      desc: section.querySelector('#exp1-grafico-desc'),
      controles: {},
    };
    montarEixos();

    section.querySelectorAll('.slider').forEach(div => {
      const param = div.dataset.param;
      const range = div.querySelector('input[type=range]'), numero = div.querySelector('input[type=number]');
      const campo = ui.campoNumerico(numero, div.querySelector('.field-msg'), {
        faixa: FAIXAS[param], unidade: UNIDADE[param], formatar: numeroCurto,
        atual: () => alvo[param], aplicar: v => definir({ [param]: v }),
      });
      el.controles[param] = { range, numero, campo };
      range.addEventListener('input', () => { campo.limpar(); definir({ [param]: +range.value }, true); });
    });

    const limpar = () => Object.values(el.controles).forEach(c => c.campo.limpar());
    section.querySelector('#exp1-preset-decode').addEventListener('click', () => { limpar(); definir({ intensidade: M.PRESETS_ROOFLINE.decode.intensidade }); });
    section.querySelector('#exp1-preset-prefill').addEventListener('click', () => { limpar(); definir({ intensidade: M.PRESETS_ROOFLINE.prefill.intensidade }); });
    section.querySelector('#exp1-reset').addEventListener('click', () => { limpar(); el.registro.textContent = ''; definir({ ...PADRAO }); });

    // Atividade: dobra um dos tetos e registra o efeito sobre o limite.
    const dobrar = (param, nome) => {
      limpar();
      const antes = M.desempenhoLimite({ picoFlops: alvo.picoTFLOPs * TFLOP, bandaBytes: alvo.bandaGBs * GB, intensidade: alvo.intensidade });
      const estadoAntes = M.gargalo({ picoFlops: alvo.picoTFLOPs * TFLOP, bandaBytes: alvo.bandaGBs * GB, intensidade: alvo.intensidade });
      if (alvo[param] * 2 > FAIXAS[param][1]) { el.registro.textContent = `${nome[0].toUpperCase() + nome.slice(1)} já está no máximo desta simulação. Use Reiniciar.`; return; }
      definir({ [param]: alvo[param] * 2 });
      const depois = M.desempenhoLimite({ picoFlops: alvo.picoTFLOPs * TFLOP, bandaBytes: alvo.bandaGBs * GB, intensidade: alvo.intensidade });
      const mudou = Math.abs(depois - antes) / antes > 1e-6;
      el.registro.textContent = `Dobrar ${nome}: limite ${tflops(antes)} → ${tflops(depois)} TFLOP/s` +
        (mudou ? ` (×${F.numero(depois / antes, 1)}).` : estadoAntes === 'equilibrio' ? ' — não mudou: na transição, o outro teto passa a limitar.' : ' — não mudou.');
    };
    section.querySelector('#exp1-dobrar-pico').addEventListener('click', () => dobrar('picoTFLOPs', 'o pico de cálculo'));
    section.querySelector('#exp1-dobrar-banda').addEventListener('click', () => dobrar('bandaGBs', 'a banda'));

    textos();
    desenhar(atual);
  }

  // Ao reabrir a aba, o gráfico é redesenhado (os rótulos dependem das medidas na tela).
  window.Lab.experimentos.push({ id: 'roofline', iniciar, entrar() { if (svg) desenhar(atual); } });
})();
