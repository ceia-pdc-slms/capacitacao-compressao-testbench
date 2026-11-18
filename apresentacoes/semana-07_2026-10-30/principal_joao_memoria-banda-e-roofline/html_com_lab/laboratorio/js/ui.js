// Utilitários de interface compartilhados pelos experimentos (SVG, indicadores, controles).
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // Cria um elemento SVG com atributos e, opcionalmente, texto.
  function svg(tag, attrs = {}, parent, text) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.append(node);
    return node;
  }

  // Lista de indicadores: [[rótulo, valor, opções]], com opções.destaque e opções.nota.
  // Cada par rótulo/valor fica num <div class="ind"> (válido em <dl>), para leiaute em faixa.
  function indicadores(dl, itens) {
    dl.replaceChildren(...itens.map(([rotulo, valor, op = {}]) => {
      const grupo = document.createElement('div');
      grupo.className = 'ind' + (op.destaque ? ' destaque' : '');
      const dt = document.createElement('dt');
      dt.textContent = rotulo;
      const dd = document.createElement('dd');
      dd.textContent = valor;
      if (op.nota) { const s = document.createElement('small'); s.textContent = op.nota; dd.append(s); }
      grupo.append(dt, dd);
      return grupo;
    }));
  }

  // Tabela de comparação: cabeçalho e linhas [rótulo, ...valores, opções?]; opções.destaque
  // realça a linha e opções.nota a mostra em texto menor.
  function tabela(table, cabecalho, linhas) {
    const head = document.createElement('thead');
    const tr = document.createElement('tr');
    cabecalho.forEach((c, i) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = c; if (i) th.className = 'num'; tr.append(th); });
    head.append(tr);
    const body = document.createElement('tbody');
    linhas.forEach(linha => {
      const op = typeof linha[linha.length - 1] === 'object' ? linha.pop() : {};
      const row = document.createElement('tr');
      if (op.destaque) row.className = 'destaque';
      if (op.nota) row.className = 'nota';
      linha.forEach((v, i) => {
        const cell = document.createElement(i ? 'td' : 'th');
        if (!i) cell.scope = 'row'; else cell.className = 'num';
        cell.textContent = v;
        row.append(cell);
      });
      body.append(row);
    });
    table.replaceChildren(head, body);
  }

  // Campo numérico validado só na confirmação (Enter ou saída), sem reformatar a cada tecla.
  // Fora da faixa: ajusta ao limite e avisa; vazio, zero, negativo ou texto: recusa, avisa e
  // volta a mostrar o valor em uso. Com inteiro = true, arredonda e avisa.
  // op: { faixa, unidade, formatar(v), atual(), aplicar(v), inteiro }
  const valorCampo = v => String(Number(v.toPrecision(6)));
  function campoNumerico(numero, msg, op) {
    const { faixa: [min, max], unidade, formatar, atual, aplicar, inteiro = false } = op;
    numero.min = min; numero.max = max;
    const limpar = () => { msg.textContent = ''; numero.removeAttribute('aria-invalid'); };
    function confirmar() {
      let r = numero.validity.badInput ? { estado: 'invalido', valor: null } : root.Lab.modelo.validarEntrada(numero.value, [min, max]);
      if (r.estado !== 'invalido' && inteiro && !Number.isInteger(r.valor))
        r = { estado: 'arredondado', valor: Math.min(max, Math.max(min, Math.round(r.valor))) };
      const faixa = `${formatar(min)} a ${formatar(max)} ${unidade}`;
      msg.textContent = {
        invalido: `Valor inválido: use um número entre ${faixa}. Mantido: ${formatar(atual())} ${unidade}.`,
        ajustado: `Fora da faixa (${faixa}): ajustado para ${formatar(r.valor)} ${unidade}.`,
        arredondado: `Use um número inteiro: arredondado para ${formatar(r.valor)} ${unidade}.`,
        ok: '',
      }[r.estado];
      if (r.estado !== 'invalido') aplicar(r.valor);
      numero.value = valorCampo(atual());
      numero.setAttribute('aria-invalid', String(r.estado === 'invalido'));
    }
    numero.addEventListener('change', confirmar);
    // Depois de um Enter, sair do campo não dispara 'change'; aqui o valor exibido é conferido.
    numero.addEventListener('blur', () => { if (numero.value !== valorCampo(atual())) confirmar(); });
    return {
      limpar,
      sincronizar() { if (document.activeElement !== numero) numero.value = valorCampo(atual()); },
    };
  }

  const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  (root.Lab = root.Lab || {}).ui = Object.freeze({ svg, indicadores, tabela, campoNumerico, valorCampo, reduzirMovimento, VELOCIDADE: 1.25 });
  root.Lab.experimentos = root.Lab.experimentos || [];
})(window);
