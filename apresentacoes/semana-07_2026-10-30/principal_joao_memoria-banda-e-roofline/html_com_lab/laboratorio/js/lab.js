// Estrutura do laboratório: página única com as duas partes (Roofline e Tokens/s), iniciadas ao
// carregar. Renderiza as fórmulas KaTeX e redesenha os gráficos quando a janela muda de tamanho
// (os rótulos dependem das medidas na tela).
(function () {
  'use strict';
  const Lab = window.Lab;

  // Renderiza [data-tex] com o KaTeX local; sem KaTeX, mostra o código-fonte.
  function renderTex(root = document) {
    root.querySelectorAll('[data-tex]').forEach(el => {
      const tex = el.dataset.tex;
      if (window.katex) katex.render(tex, el, { displayMode: el.hasAttribute('data-display'), throwOnError: false });
      else el.textContent = tex;
    });
  }

  renderTex();
  document.documentElement.classList.add('js');
  for (const exp of Lab.experimentos) {
    const section = document.getElementById(exp.id);
    if (section) exp.iniciar(section);
  }
  let pendente = null;
  addEventListener('resize', () => {
    cancelAnimationFrame(pendente);
    pendente = requestAnimationFrame(() => Lab.experimentos.forEach(e => e.entrar && e.entrar()));
  });
})();
