// Experimento 1 — Qual peso sai? Rede com 2 entradas e 1 saída (a do slide 6), valores sorteados.
// Magnitude remove o menor |W|; o Wanda remove o menor S = |W| · ||X||_2 (Sun et al., Eq. 1–2).
(() => {
  const svg = document.getElementById('e1-rede'), painel = document.getElementById('e1-painel');
  const { svg: S, el, fmt, ftex, tex, AZ, RX, DR } = LAB;
  const IN = [[270, 120], [270, 330]], OUT = [610, 225], R = 34;
  const PESOS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 1.4], NORMAS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10];
  const sorteia = l => l[Math.floor(Math.random() * l.length)];
  let caso, fase, acertos = 0, total = 0, respostas;

  // Sorteia um caso sem empates; em cerca de 2/3 das vezes, os dois métodos discordam.
  function novoCaso() {
    const querDiscordar = Math.random() < 0.66;
    for (;;) {
      const w = [sorteia(PESOS), sorteia(PESOS)].map(v => v * (Math.random() < 0.4 ? -1 : 1)), n = [sorteia(NORMAS), sorteia(NORMAS)];
      const a = w.map(Math.abs), s = a.map((v, k) => v * n[k]);
      if (a[0] === a[1] || Math.max(...s) / Math.min(...s) < 1.25) continue;
      const mag = a[0] < a[1] ? 0 : 1, wanda = s[0] < s[1] ? 0 : 1;
      if ((mag !== wanda) !== querDiscordar) continue;
      return { w, n, s, mag, wanda };
    }
  }

  function texto(x, y, codigo, cls, largura = 240) {
    const fo = S('foreignObject', { x: x - largura / 2, y: y - 24, width: largura, height: 48, class: 'e1-fo ' + cls }, svg);
    const d = document.createElement('div');
    d.innerHTML = tex(codigo);
    fo.append(d);
    return fo;
  }

  function desenha() {
    svg.textContent = '';
    const { w, n } = caso, maxW = 1.4, maxN = 10;
    IN.forEach(([x, y], k) => {
      const g = S('g', { class: 'e1-aresta', 'data-k': k, tabindex: 0, role: 'button', 'aria-label': `Conexão ${k + 1}: peso ${fmt(w[k], 1)}` }, svg);
      S('path', { d: `M${x + R} ${y}L${OUT[0] - R} ${OUT[1]}`, class: 'linha', style: `stroke-width:${3 + 15 * Math.abs(w[k]) / maxW}px` }, g);
      S('path', { d: `M${x + R} ${y}L${OUT[0] - R} ${OUT[1]}`, class: 'toque' }, g);
      g.addEventListener('click', () => responde(k));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); responde(k); } });
    });
    IN.forEach(([x, y], k) => {
      const rh = R + 6 + 30 * Math.sqrt(n[k] / maxN);
      S('circle', { cx: x, cy: y, r: rh, class: 'halo', style: `fill-opacity:${(0.1 + 0.25 * n[k] / maxN).toFixed(2)}` }, svg);
      S('circle', { cx: x, cy: y, r: R, class: 'no' }, svg);
      texto(x, y, `x_${k + 1}`, 'no-t', 80);
      texto((x - rh - 14) / 2, y, `{\\color{${RX}}\\lVert X_${k + 1} \\rVert_2 = ${ftex(n[k], n[k] % 1 ? 1 : 0)}}`, 'rot dir', x - rh - 14);
      texto(360, k ? 250 : 200, '', 'marca m' + k, 330);
      texto(490, k ? 336 : 114, `{\\color{${AZ}}W_{i${k + 1}} = ${ftex(w[k], 1)}}`, 'rot');
    });
    S('circle', { cx: OUT[0], cy: OUT[1], r: R, class: 'no' }, svg);
    texto(OUT[0], OUT[1], 'y_i', 'no-t', 80);
  }

  // Marca na rede a conexão que cada método remove (depois de respondido).
  function marca() {
    svg.querySelectorAll('.e1-aresta').forEach(g => {
      const k = +g.dataset.k;
      g.classList.toggle('sai-mag', fase !== 'mag' && caso.mag === k);
      g.classList.toggle('sai-wanda', fase === 'fim' && caso.wanda === k);
      const m = fase !== 'mag' && caso.mag === k, wd = fase === 'fim' && caso.wanda === k;
      svg.querySelector('.m' + k + ' div').innerHTML = m && wd ? '<span class="wd">os dois removem</span>'
        : m ? '<span class="mag">magnitude remove</span>' : wd ? '<span class="wd">Wanda remove</span>' : '';
    });
  }

  function pergunta(titulo, feitas) {
    const bloco = el('div', { class: 'e1-q' }, painel);
    el('p', { class: 'q' }, bloco, titulo);
    if (!feitas) {
      const linha = el('div', { class: 'botoes lado' }, bloco);
      [0, 1].forEach(k => {
        const b = el('button', { type: 'button' }, linha, tex(`W_{i${k + 1}} = ${ftex(caso.w[k], 1)}`));
        b.addEventListener('click', () => responde(k));
        const g = () => svg.querySelector(`.e1-aresta[data-k="${k}"]`);
        b.addEventListener('mouseenter', () => g().classList.add('foco'));
        b.addEventListener('mouseleave', () => g().classList.remove('foco'));
        b.addEventListener('focus', () => g().classList.add('foco'));
        b.addEventListener('blur', () => g().classList.remove('foco'));
      });
    }
    return bloco;
  }
  const veredito = (bloco, certo, explica) => el('p', { class: 'veredito ' + (certo ? 'certo' : 'errado') }, bloco, `<span class="selo">${certo ? '✓' : '✗'}</span><span><b>${certo ? 'Isso.' : 'Não.'}</b> ${explica}</span>`);

  function painelAtual() {
    painel.textContent = '';
    const { w, n, s, mag, wanda } = caso;
    const q1 = pergunta('Qual conexão a <strong>poda por magnitude</strong> remove?', fase !== 'mag');
    if (fase !== 'mag') {
      veredito(q1, respostas.mag === mag, `Sai o menor ${tex('|W|')}: ${tex(`|{${ftex(w[mag], 1)}}| < |{${ftex(w[1 - mag], 1)}}|`)}.`);
      const q2 = pergunta('E o <strong>Wanda</strong>?', fase === 'fim');
      if (fase === 'fim') {
        const conta = el('div', { class: 'e1-conta' }, q2);
        [0, 1].forEach(k => el('div', {}, conta, tex(`{\\color{${DR}}S_{i${k + 1}}} = {\\color{${AZ}}|{${ftex(w[k], 1)}}|} \\cdot {\\color{${RX}}${ftex(n[k], n[k] % 1 ? 1 : 0)}} = {\\color{${DR}}${ftex(s[k], 2)}}`)));
        veredito(q2, respostas.wanda === wanda, `Sai o menor ${tex('S')}: ${tex(`W_{i${wanda + 1}}`)}.`);
        el('p', { class: 'resumo' }, painel, mag === wanda
          ? 'Aqui os dois métodos concordam.'
          : `Os métodos discordam: o peso menor (${tex(`W_{i${mag + 1}}`)}) está ligado à entrada de ativações maiores.`);
        const fim = el('div', { class: 'botoes' }, painel);
        el('button', { type: 'button', id: 'e1-novo' }, fim, 'Novo exemplo').addEventListener('click', inicia);
        el('span', { class: 'placar' }, fim, `acertos <b>${acertos}/${total}</b>`);
      }
    }
    marca();
  }

  function responde(k) {
    if (fase === 'fim') return;
    total++;
    if (fase === 'mag') { respostas.mag = k; if (k === caso.mag) acertos++; fase = 'wanda'; }
    else { respostas.wanda = k; if (k === caso.wanda) acertos++; fase = 'fim'; }
    svg.classList.toggle('fim', fase === 'fim');
    painelAtual();
    const foco = painel.querySelector('.e1-q:last-of-type button, #e1-novo');
    if (foco) foco.focus({ preventScroll: true });
  }

  function inicia() {
    caso = novoCaso(); fase = 'mag'; respostas = {};
    svg.classList.remove('fim');
    desenha(); painelAtual();
  }
  inicia();
})();
