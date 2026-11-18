// Formatação de números e unidades em pt-BR (vírgula decimal, ponto de milhar).
(function (root) {
  'use strict';

  const cache = new Map();
  function fmt(casas) {
    if (!cache.has(casas))
      cache.set(casas, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
    return cache.get(casas);
  }

  const numero = (x, casas = 0) => fmt(casas).format(x);

  // Bytes em unidade decimal legível (B, KB, MB, GB), com casas fixas por faixa.
  function bytes(x, casas = 3) {
    if (x < 1e3) return `${numero(x)} B`;
    if (x < 1e6) return `${numero(x / 1e3, 1)} KB`;
    if (x < 1e9) return `${numero(x / 1e6, 1)} MB`;
    return `${numero(x / 1e9, casas)} GB`;
  }

  // FLOPs com prefixo (k, M, G, T) quando o número é grande.
  function flops(x) {
    if (x < 1e4) return `${numero(x)} FLOPs`;
    const [div, pre] = x < 1e6 ? [1e3, 'k'] : x < 1e9 ? [1e6, 'M'] : x < 1e12 ? [1e9, 'G'] : [1e12, 'T'];
    return `${numero(x / div, 1)} ${pre}FLOPs`;
  }

  const formato = Object.freeze({ numero, bytes, flops });
  if (typeof module !== 'undefined' && module.exports) module.exports = formato;
  else (root.Lab = root.Lab || {}).formato = formato;
})(typeof window !== 'undefined' ? window : globalThis);
