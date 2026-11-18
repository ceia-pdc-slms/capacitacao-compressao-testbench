// Laboratório: utilidades comuns e navegação entre os experimentos (um por tela, endereço #1 a #4).
const LAB = {
  NS: 'http://www.w3.org/2000/svg',
  // Cria um elemento SVG.
  svg(tag, attrs = {}, parent, text) {
    const n = document.createElementNS(LAB.NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.append(n);
    return n;
  },
  // Cria um elemento HTML.
  el(tag, attrs = {}, parent, html) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (html !== undefined) n.innerHTML = html;
    if (parent) parent.append(n);
    return n;
  },
  // Número com vírgula decimal e sinal de menos tipográfico.
  fmt(v, casas = 2) {
    const s = Math.abs(v).toFixed(casas).replace('.', ',');
    return (v < 0 && Number(Math.abs(v).toFixed(casas)) !== 0 ? '−' : '') + s;
  },
  // O mesmo, para dentro de fórmulas KaTeX.
  ftex(v, casas = 2) {
    const s = Math.abs(v).toFixed(casas).replace('.', '{,}');
    return (v < 0 && Number(Math.abs(v).toFixed(casas)) !== 0 ? '-' : '') + s;
  },
  // Fórmula KaTeX como HTML (ou o código-fonte, sem KaTeX).
  tex(codigo, bloco = false) {
    return window.katex ? katex.renderToString(codigo, { displayMode: bloco, throwOnError: false }) : codigo;
  },
  // Troca os trechos $…$ de um texto por fórmulas.
  rico(texto) { return texto.replace(/\$([^$]+)\$/g, (_, t) => LAB.tex(t)); },
  // Gerador pseudoaleatório com semente (resultados reprodutíveis).
  rng(semente) {
    let s = semente;
    const u = () => (s = s * 16807 % 2147483647) / 2147483647;
    u.normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    return u;
  },
  AZ: '#58c4dd', RX: '#b9a0ee', DR: '#f4ce72', VM: '#fc6255', VD: '#83c167',
};

// Fórmulas estáticas da página.
document.querySelectorAll('[data-tex]').forEach(el => { el.innerHTML = LAB.tex(el.dataset.tex, el.hasAttribute('data-display')); });

// Navegação: mostra um experimento por vez.
(() => {
  const botoes = [...document.querySelectorAll('.lab-nav button')];
  function ir(n, empurra = true) {
    const alvo = document.getElementById('exp-' + n) ? n : '1';
    document.querySelectorAll('.lab-view').forEach(v => { v.hidden = v.id !== 'exp-' + alvo; });
    botoes.forEach(b => {
      const ativo = b.dataset.ir === alvo;
      b.classList.toggle('ativo', ativo);
      if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (empurra && location.hash !== '#' + alvo) history.replaceState(null, '', '#' + alvo);
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));
  window.addEventListener('hashchange', () => ir(location.hash.slice(1), false));
  ir(location.hash.slice(1) || '1', false);
})();
