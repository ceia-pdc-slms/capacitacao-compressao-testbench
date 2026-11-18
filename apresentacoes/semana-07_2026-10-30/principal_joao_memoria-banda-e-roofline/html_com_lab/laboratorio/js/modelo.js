// Constantes, unidades e fórmulas do laboratório. Único lugar com cálculos: os experimentos
// só chamam estas funções. Funciona como script clássico (window.Lab.modelo), inclusive em
// file://, e como módulo CommonJS nos testes (node --test).
(function (root) {
  'use strict';

  // Unidades decimais (SI) e binárias. GB = 10⁹ bytes; GiB = 2³⁰ bytes.
  const UNIDADES = Object.freeze({
    KB: 1e3, MB: 1e6, GB: 1e9,
    KiB: 2 ** 10, MiB: 2 ** 20, GiB: 2 ** 30,
    GFLOP: 1e9, TFLOP: 1e12,
  });
  const BYTES_FP16 = 2;

  // Pythia-1B (GPTNeoX). Fonte: verificacao/pythia-config.json e verificacao/pythia-contagem.json.
  const PYTHIA_1B = Object.freeze({
    nome: 'Pythia-1B',
    parametros: 1011781632,
    parametrosPorBloco: 50358272,    // atenção + MLP + normas de um bloco do Transformer
    camadas: 16,
    cabecas: 8,
    dimModelo: 2048,
    dimCabeca: 256,
    vocabulario: 50304,
    contextoMax: 2048,
    bytesPorValor: BYTES_FP16,
  });

  // Cenário-padrão das duas partes (Roofline e Tokens/s). Banda hipotética, não medida.
  const PADROES = Object.freeze({
    contexto: 1024,
    bandaGBs: 200,
    picoTFLOPs: 20,
  });

  // Posições ilustrativas no Roofline (FLOP/byte). Dependem do hardware e da operação.
  const PRESETS_ROOFLINE = Object.freeze({
    decode: Object.freeze({ nome: 'Decode (ilustrativo)', intensidade: 1 }),
    prefill: Object.freeze({ nome: 'Prefill (ilustrativo)', intensidade: 512 }),
  });

  // Faixas dos controles do Roofline (eixos e deslizantes lineares). Unidades: GB/s, TFLOP/s, FLOP/byte.
  const FAIXAS_ROOFLINE = Object.freeze({
    bandaGBs: Object.freeze([50, 2000]),
    picoTFLOPs: Object.freeze([5, 40]),
    intensidade: Object.freeze([1, 600]),
  });
  // Eixos lineares fixos do Roofline: x de 0 a 600 FLOP/byte e y de 0 a 44 TFLOP/s (o pico máximo,
  // 40 TFLOP/s, com folga para rótulos). Fixos para que mudar B mude a inclinação da reta.
  const EIXOS_ROOFLINE = Object.freeze({ intensidadeMax: 600, desempenhoMaxTFLOPs: 44 });

  // Parte Tokens/s: precisões dos pesos (bytes por parâmetro) e faixas dos controles.
  // O KV cache fica em FP16 em todas as precisões.
  const PRECISOES_PESOS = Object.freeze([
    Object.freeze({ id: 'fp16', nome: 'FP16', bytes: 2 }),
    Object.freeze({ id: 'int8', nome: 'INT8', bytes: 1 }),
    Object.freeze({ id: 'int4', nome: '4 bits', bytes: 0.5 }),
  ]);
  const FAIXAS_TOKENS = Object.freeze({
    bandaGBs: Object.freeze([50, 2000]),
    contexto: Object.freeze([1, 2048]),
  });

  function exigirFaixa(nome, valor, min, max) {
    if (!Number.isFinite(valor) || valor < min || valor > max)
      throw new RangeError(`${nome} deve estar entre ${min} e ${max} (recebido: ${valor}).`);
  }

  // --- Parte 1: Roofline. Unidades: FLOP/s, bytes/s, FLOP/byte. ---
  function desempenhoLimite({ picoFlops, bandaBytes, intensidade }) {
    return Math.min(picoFlops, bandaBytes * intensidade);
  }
  function intensidadeTransicao({ picoFlops, bandaBytes }) {
    return picoFlops / bandaBytes;
  }
  // Tolerância relativa para considerar que os dois tetos coincidem (B·I = P_pico).
  const TOLERANCIA_TRANSICAO = 1e-6;
  // 'memoria' (B·I < P), 'calculo' (B·I > P) ou 'equilibrio' (na transição, os dois tetos
  // coincidem: aumentar só a banda ou só o pico não eleva o limite).
  function gargalo({ picoFlops, bandaBytes, intensidade }) {
    const razao = bandaBytes * intensidade / picoFlops;
    if (Math.abs(razao - 1) <= TOLERANCIA_TRANSICAO) return 'equilibrio';
    return razao < 1 ? 'memoria' : 'calculo';
  }

  // Lê o texto de um campo numérico e o confronta com a faixa [min, max].
  // Retorna { estado: 'ok' | 'ajustado' | 'invalido', valor }; com 'invalido', valor é null.
  function validarEntrada(texto, [min, max]) {
    const limpo = String(texto ?? '').trim().replace(',', '.');
    const v = limpo === '' ? NaN : Number(limpo);
    if (!Number.isFinite(v) || v <= 0) return { estado: 'invalido', valor: null };
    if (v < min) return { estado: 'ajustado', valor: min };
    if (v > max) return { estado: 'ajustado', valor: max };
    return { estado: 'ok', valor: v };
  }

  // --- Parte 2 (Tokens/s): bytes lidos por token no decode (batch 1). ---
  function bytesPesos(m = PYTHIA_1B) {
    return m.parametros * m.bytesPorValor;
  }
  // Embedding de entrada: só uma linha é consultada por token, não a matriz inteira.
  function bytesEmbeddingEntrada(m = PYTHIA_1B) {
    return m.vocabulario * m.dimModelo * m.bytesPorValor;
  }
  // Parcela principal de pesos lida a cada token (inclui a projeção de saída para logits).
  function bytesPesosLidosPorToken(m = PYTHIA_1B) {
    return bytesPesos(m) - bytesEmbeddingEntrada(m);
  }
  // Decomposição da parcela lida por token: blocos, norma final e projeção de saída (logits).
  // Sem pesos compartilhados (tie_word_embeddings = false), a saída é uma matriz própria.
  function bytesPorBloco(m = PYTHIA_1B) {
    return m.parametrosPorBloco * m.bytesPorValor;
  }
  function bytesProjecaoSaida(m = PYTHIA_1B) {
    return m.vocabulario * m.dimModelo * m.bytesPorValor;
  }
  function bytesNormaFinal(m = PYTHIA_1B) {
    return 2 * m.dimModelo * m.bytesPorValor;   // ganho e viés
  }
  // Uma linha do embedding de entrada, lida por token (desprezada no tráfego estimado).
  function bytesLinhaEmbedding(m = PYTHIA_1B) {
    return m.dimModelo * m.bytesPorValor;
  }
  // K e V de uma posição em uma camada.
  function bytesKVPorPosicaoPorCamada(m = PYTHIA_1B) {
    return 2 * m.cabecas * m.dimCabeca * m.bytesPorValor;
  }
  // Ocupação da VRAM (capacidade), diferente do tráfego por token.
  function bytesArmazenados(contexto, m = PYTHIA_1B) {
    return bytesPesos(m) + bytesKV(contexto, m);
  }
  // Tempo mínimo por token imposto pela banda (s).
  function tempoPorToken(bandaBytes, bytesToken) {
    return bytesToken / bandaBytes;
  }

  // K e V de uma posição, em todas as camadas.
  function bytesKVPorPosicao(m = PYTHIA_1B) {
    return 2 * m.camadas * m.cabecas * m.dimCabeca * m.bytesPorValor;
  }
  function bytesKV(contexto, m = PYTHIA_1B) {
    exigirFaixa('contexto', contexto, 0, m.contextoMax);
    return contexto * bytesKVPorPosicao(m);
  }
  // bytesPorPeso: 2 (FP16), 1 (INT8) ou 0,5 (4 bits); o KV cache continua em FP16.
  function bytesPorToken(contexto, m = PYTHIA_1B, bytesPorPeso = m.bytesPorValor) {
    return bytesPesosLidosPorToken(m) / m.bytesPorValor * bytesPorPeso + bytesKV(contexto, m);
  }
  // Teto idealizado pela banda: bytes/s ÷ bytes/token.
  function tokensPorSegundo(bandaBytes, bytesToken) {
    return bandaBytes / bytesToken;
  }

  const modelo = Object.freeze({
    UNIDADES, BYTES_FP16, PYTHIA_1B, PADROES, PRESETS_ROOFLINE, FAIXAS_ROOFLINE, EIXOS_ROOFLINE, PRECISOES_PESOS, FAIXAS_TOKENS,
    desempenhoLimite, intensidadeTransicao, gargalo, TOLERANCIA_TRANSICAO, validarEntrada,
    bytesPesos, bytesEmbeddingEntrada, bytesPesosLidosPorToken, bytesKVPorPosicao, bytesKV,
    bytesPorToken, tokensPorSegundo, bytesPorBloco, bytesProjecaoSaida, bytesNormaFinal, bytesLinhaEmbedding,
    bytesKVPorPosicaoPorCamada, bytesArmazenados, tempoPorToken,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = modelo;
  else (root.Lab = root.Lab || {}).modelo = modelo;
})(typeof window !== 'undefined' ? window : globalThis);
