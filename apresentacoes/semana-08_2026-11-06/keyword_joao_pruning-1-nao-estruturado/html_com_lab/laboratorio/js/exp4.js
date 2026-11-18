// Experimento 4 — Chegue a 2×. Lei de Amdahl: com uma fração p do tempo acelerada s vezes,
// o tempo novo é (1 − p) + p/s e o modelo inteiro fica 1 / ((1 − p) + p/s) vezes mais rápido.
// Com s → ∞, o limite é 1 / (1 − p).
// p = fração do tempo gasta nas multiplicações por matrizes de pesos (as camadas lineares, onde os
// zeros do pruning podem ser aproveitados); o resto (atenção entre tokens, normalizações, ativações,
// amostragem) não tem pesos podados. s ≈ 1,6× é o medido para 2:4 em Sun et al. (Wanda), Tabela 5.
(() => {
  const { fmt, ftex, tex, AZ, DR } = LAB;
  const $ = id => document.getElementById(id);
  const ip = $('e4-p'), is = $('e4-s');
  const P = c => `{\\color{${AZ}}${c}}`, Sc = c => `{\\color{${DR}}${c}}`;

  function atualiza() {
    const p = ip.value / 100, s = +is.value;
    const acel = p / s, resto = 1 - p, novo = acel + resto, speed = 1 / novo, limite = resto > 0 ? 1 / resto : Infinity;
    const pct = Math.round(100 * p) + '%', vezes = fmt(s, 1) + '×';
    $('e4-pv').textContent = pct;
    $('e4-sv').textContent = vezes;
    $('e4-a1').style.width = 100 * p + '%'; $('e4-r1').style.width = 100 * resto + '%';
    $('e4-a2').style.width = 100 * acel + '%'; $('e4-r2').style.width = 100 * resto + '%';
    $('e4-a1').textContent = p >= 0.25 ? 'pesos · ' + pct : ''; $('e4-r1').textContent = resto >= 0.2 ? 'resto · ' + Math.round(100 * resto) + '%' : '';
    $('e4-a2').textContent = acel >= 0.12 ? Math.round(100 * acel) + '%' : ''; $('e4-r2').textContent = resto >= 0.2 ? Math.round(100 * resto) + '%' : '';
    $('e4-total').textContent = Math.round(100 * novo) + '%';
    const chegou = speed >= 2 - 1e-9, el = $('e4-speed');
    el.textContent = fmt(speed, 2) + '×';
    el.className = chegou ? 'bom' : '';
    $('e4-conta').innerHTML = tex(
      `\\frac{1}{(1 - ${P('p')}) + \\dfrac{${P('p')}}{${Sc('s')}}} = \\frac{1}{${ftex(resto)} + \\dfrac{${P(ftex(p))}}{${Sc(ftex(s, 1))}}} = ${ftex(speed)}\\times`, true);
    const lim = isFinite(limite) ? fmt(limite, 2) + '×' : 'sem limite';
    $('e4-msg').innerHTML = chegou
      ? `<b class="bom">2× atingido.</b> Foi preciso acelerar ${pct} do tempo em ${vezes}.`
      : limite <= 2
        ? `Com ${pct} do tempo nas multiplicações por pesos, o teto é ${lim}, mesmo com aceleração infinita: o resto continua lá. Para 2×, mais da metade do tempo precisa ser acelerável.`
        : `Ainda falta. Com ${pct} acelerável, o teto (aceleração infinita) é ${lim}.`;
  }
  ip.addEventListener('input', atualiza);
  is.addEventListener('input', atualiza);
  atualiza();
})();
