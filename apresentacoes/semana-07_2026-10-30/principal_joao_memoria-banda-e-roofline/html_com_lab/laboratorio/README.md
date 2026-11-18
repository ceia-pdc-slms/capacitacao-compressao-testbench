# Laboratório — Memória e banda

Página única em `index.html`, sem abas: ao abrir, aparece o **Roofline**; abaixo de uma linha separadora vem **Tokens/s**. É a mesma interface para o apresentador e para quem explora em casa. Funciona sem internet e sem backend: pelo servidor da apresentação (http://localhost:8000/laboratorio/) ou abrindo o arquivo direto no navegador. Feita para telas de desktop; não há adaptação específica para celular.

## Como executar

Na pasta `apresentacao_memoria_e_banda`:

```bash
python3 servir.py            # http://localhost:8000/ (slides) e http://localhost:8000/laboratorio/
```

O `servir.py` desativa o cache do navegador; `python3 -m http.server 8000 --directory apresentacao` também funciona, mas pode mostrar versões antigas. Sem servidor, abra `apresentacao/laboratorio/index.html` direto no navegador. KaTeX e fontes são locais.

## Estrutura

```
laboratorio/
├── index.html              página única: Roofline → separador → Tokens/s
├── lab.css                 estilos do laboratório (cores e fontes vêm de ../style.css)
├── js/
│   ├── modelo.js           ÚNICO lugar com constantes, unidades e fórmulas (Roofline, Pythia-1B)
│   ├── formato.js          números e unidades em pt-BR
│   ├── ui.js               utilitários: SVG, indicadores, tabela, campo numérico validado
│   ├── lab.js              inicia as duas partes, KaTeX, redesenho ao redimensionar a janela
│   └── experimentos/
│       ├── roofline.js     parte 1
│       └── tokens.js       parte 2
└── testes/
    ├── modelo.test.js      cálculos e validação de campos (node --test)
    ├── navegador.mjs       regressão da interface no Chrome sem janela, por file://
    ├── entrega.mjs         validação de entrega pelo servidor: links, offline, teclado, acessibilidade, contraste, janelas
    └── cdp.mjs             Chrome sem janela via DevTools Protocol, compartilhado pelos dois anteriores
```

Decisões:

- **Scripts clássicos** com o espaço de nomes `window.Lab`, sem módulos ES nem framework: assim a página também abre por `file://`. `modelo.js` e `formato.js` também exportam via CommonJS para os testes.
- Cada parte se registra em `Lab.experimentos` com `iniciar(seção)` e `entrar()`; `lab.js` chama `iniciar` ao carregar e `entrar` (redesenho) quando a janela muda de tamanho, porque os rótulos do Roofline dependem das medidas na tela.
- Fórmulas: `data-tex="…"` (e `data-display` para bloco), renderizadas com o KaTeX local de `../vendor/katex/`.
- Ao trocar arquivos, aumente o `?v=` correspondente em `index.html` para o navegador não usar a cópia antiga.
- **Leiaute:** em cada parte, visualização à esquerda e controles num painel de 320 px à direita.
- **Tamanhos de fonte:** no HTML, só três tamanhos além dos títulos, definidos em `.lab` (`lab.css`): `--fs-sm` (16 px: notas, unidades, rótulos de cartões, avisos), `--fs-md` (20 px: corpo, controles, botões, tabelas) e `--fs-lg` (24 px: pergunta, fórmulas, valores em destaque). Em telas estreitas, `--fs-md` e `--fs-lg` caem para 18 e 20 px. Nos SVGs, 22 unidades para texto e 24 para símbolos matemáticos; a única exceção é o valor no mostrador do velocímetro de Tokens/s (44 unidades), o destaque da parte.

## Parte 1 — Roofline

- **Gráfico (SVG) com eixos lineares e fixos:** intensidade $I$ de 0 a 600 FLOP/byte (marcas a cada 100) e desempenho de 0 a 44 TFLOP/s (marcas a cada 10), em `M.EIXOS_ROOFLINE`. Como os eixos não mudam, a reta da banda $P = B \cdot I$ tem inclinação proporcional a $B$: mais banda deixa a reta mais íngreme e aproxima a transição $I_{\text{transição}} = P_{\text{pico}}/B$ da origem. O 0 do eixo x não é rotulado (fica implícito no 0 do eixo y), para não disputar a origem com o decode.
- Mostra a reta da banda, o teto de cálculo, as duas regiões, a linha de transição, as posições ilustrativas de decode ($I = 1$) e prefill ($I = 512$) sobre o teto atual e o ponto da operação, com guias até os eixos. Com eixos lineares, o decode fica colado à origem, como no slide 8.
- **Rótulos sem sobreposição:** cada rótulo tem posições candidatas, testadas em ordem de prioridade (ponto, pico, transição, banda, decode/prefill, regiões); fica na primeira que não colide com os já posicionados nem com as marcas dos eixos; se nenhuma servir, é ocultado.
- **Controles lineares:** banda $B$ (50–2.000 GB/s, passo 10), pico $P_{\text{pico}}$ (5–40 TFLOP/s, passo 1) e intensidade $I$ (1–600 FLOP/byte, passo 1), cada um com deslizante e campo numérico (`FAIXAS_ROOFLINE`). O campo só é validado ao confirmar (Enter ou saída): fora da faixa, ajusta ao limite e avisa; vazio, zero, negativo ou texto, recusa e avisa (`M.validarEntrada`). Botões *Decode (ilustrativo)*, *Prefill (ilustrativo)* e *Reiniciar* (200 GB/s, 20 TFLOP/s, decode).
- **Animação:** botões e campos deslizam do estado anterior ao novo (interpolação linear, 1,25×); ao arrastar um deslizante, o gráfico é redesenhado na hora, sem interpolação.
- **Indicadores e equação:** limite de desempenho, gargalo (memória, cálculo ou os dois, na transição), transição e fração do pico usada; $P_{\text{limite}} = \min(P_{\text{pico}}, B \cdot I)$ com os valores atuais. Não há parágrafo de conclusão.
- **Atividade:** “× 2 TFLOP/s” e “× 2 GB/s” registram o limite antes e depois.
- **Entenda este resultado:** fórmulas, unidades, inclinação em eixos lineares, transição, regiões e hipóteses (valores hipotéticos, posições ilustrativas, modelo idealizado).

## Parte 2 — Tokens/s

Mostra que parâmetros mudam o teto de tokens/s no decode e como. Cenário: Pythia-1B, batch 1, KV cache em FP16.

- **Controles:** largura de banda $B$ (50–2.000 GB/s), precisão dos pesos (FP16, INT8 ou 4 bits: 2, 1 ou 0,5 byte por parâmetro, em `PRECISOES_PESOS`) e contexto $n$ (1–2.048 posições). *Reiniciar* volta a 200 GB/s, FP16 e 1.024 posições.
- **Visualização (SVG), em escalas fixas:** barra “lido por token” (pesos em roxo + KV cache em azul; escala até 2,2 GB), barra “tempo por token” (bytes ÷ banda, em amarelo; escala até 44 ms, o pior caso com 50 GB/s) e um velocímetro com o teto (“≈ 102” tokens/s no mostrador). O velocímetro tem arco de 240° em escala logarítmica de 10 a 10.000 tokens/s (cobre de ≈ 24, com 50 GB/s, FP16 e 2.048 posições, a ≈ 4.400, com 2.000 GB/s, 4 bits e 1 posição): dobrar a banda ou reduzir os bytes à metade gira o ponteiro sempre 80° × log₁₀ 2 ≈ 24°. O arco preenchido e o valor no mostrador têm cor própria, que muda com a posição do ponteiro: interpolada em OKLCH do vermelho (`#fc6255`, 10 tokens/s) ao verde (`#83c167`, 10.000 tokens/s), passando pelo laranja (`LENTO` e `RAPIDO` em `tokens.js`). Mudar a banda muda só o tempo; mudar a precisão encolhe os pesos; aumentar o contexto alonga o KV cache. Barras e mostrador mudam na hora; só o ponteiro gira em cerca de 0,26 s (320 ms ÷ 1,25), com desaceleração, e fica instantâneo com movimento reduzido.
- **Entenda este resultado** (no fim da seção): $\text{tokens/s} \le B / \text{bytes por token}$, com $\text{bytes por token} = N \cdot b + n \cdot k_{\text{KV}}$; o significado de cada termo; a mesma conta com os valores atuais (KaTeX) e passo a passo; hipóteses.
- Valores de referência (200 GB/s, 1.024 posições), coerentes com o slide 10: FP16 1,952 GB → 102 tokens/s; INT8 1,043 GB → 192 tokens/s; 4 bits 0,589 GB → 340 tokens/s. Com 2.048 posições em FP16: 2,086 GB → 95,9 tokens/s.
- Contas: $N = 908.759.040$ parâmetros lidos por token (1.011.781.632 menos o embedding de entrada, 50.304 × 2.048, do qual só uma linha de 4 KB é lida); $k_{\text{KV}} = 2 \times 16 \times 8 \times 256 \times 2 = 131.072$ bytes (128 KiB) por posição, em todas as camadas. Verificado contra `verificacao/`.
- Hipóteses (em “Entenda este resultado”): teto idealizado, não medição; banda hipotética; cada peso lido uma vez por token e o KV cache uma vez por etapa; KV cache em FP16 em todas as precisões; quantização sem o custo das escalas e da desquantização; sem ativações, buffers, caches de hardware e overheads; batch 1.

## Como modificar valores

Edite `js/modelo.js`: `PYTHIA_1B`, `PADROES` (contexto, banda e pico), `PRESETS_ROOFLINE`, `FAIXAS_ROOFLINE`, `EIXOS_ROOFLINE`, `PRECISOES_PESOS` e `FAIXAS_TOKENS`. Se mudar uma faixa, ajuste também `min`, `max` e `step` dos deslizantes em `index.html`. Depois rode os testes.

## Testes e validação

Na pasta `apresentacao_memoria_e_banda` (os dois últimos exigem `google-chrome`, ou `CHROME=/caminho`):

```bash
node --test apresentacao/laboratorio/testes/*.test.js      # cálculos, sem navegador          → 11 testes
node apresentacao/laboratorio/testes/navegador.mjs        # regressão da interface (file://) → 60 verificações
node apresentacao/laboratorio/testes/entrega.mjs          # entrega pelo servidor local      → 49 verificações
```

- `modelo.test.js`: unidades; Roofline (limite, gargalo, equilíbrio com tolerância, valores-padrão e predefinições dentro das faixas, eixos fixos que contêm os controles); Tokens/s com as três precisões (102, 192 e 340 tokens/s); valores de referência do Pythia-1B; decomposição dos pesos e do KV cache; armazenado × tráfego; validação de campos; formatação pt-BR.
- `navegador.mjs`: página única (ordem Roofline → separador → Tokens/s, sem abas e sem conclusão); transição e atividade; **inclinação da reta proporcional a $B$**; marcas lineares dos eixos; deslizante redesenhando sem atraso; 8 combinações extremas (ponto na área, rótulos sem sobreposição e dentro da área); campos (9999, vazio, 0, −5, abaixo da faixa, edição sem reformatação); Tokens/s (padrão, banda dobrada, ponteiro do velocímetro em escala log e giro de ≈ 24,1° ao dobrar a banda, INT8, 4 bits, contexto 2.048 e 1, campos, Reiniciar, textos do SVG sem sobreposição em casos extremos); ausência de exceções.
- `entrega.mjs`, pelo `servir.py`: percurso apresentação → laboratório → volta; nenhum recurso de outro host; todas as requisições respondem; fontes do KaTeX locais; links dos dois documentos; **teclado** (ordem de Tab, Enter em “Entenda este resultado”, End/Home nos deslizantes, digitação + Enter + saída no campo de banda, Espaço em Reiniciar, Enter na precisão); **foco visível**; transição memória ↔ cálculo com indicadores, descrição, equação e ponto coerentes com `modelo.js`; **nomes acessíveis**; **contraste WCAG 2.1** nas duas partes; **janelas** 1920 × 1080, 1366 × 768 e 1100 × 700 (sem rolagem lateral, figuras inteiras, textos SVG ≥ 14 px e sem sobreposição); ausência de erros JavaScript.

## Histórico

- Fases 0 a 5: estrutura, três experimentos (Prefill × decode, Roofline e Pythia-1B), animações Manim, 3D seletivo, acabamento e validação de entrega.
- Removido o experimento Prefill × decode (seção, `prefill-decode.js`, estilos, `ui.segmentado`, `projecao` e testes).
- Página única: sem início nem abas; Roofline com eixos e deslizantes lineares e sem o parágrafo de conclusão; o experimento Pythia-1B (barras armazenado × lido, VRAM camada a camada, animação de decode e vídeo 3D) foi substituído pela parte **Tokens/s**, mais simples (`tokens.js`). Saíram `pythia.js`, `ui.videoGuiado` e os estilos correspondentes. As cenas Manim `animacoes/reutilizacao_pesos.py` e `animacoes/kv_cache_3d.py` e os arquivos `lab-reutilizacao-pesos.*` e `lab-kv-cache-3d.*` continuam no projeto, mas o laboratório não os usa mais.
- Fontes padronizadas em três tamanhos; arraste dos deslizantes sem atraso.

## Limitações conhecidas

- Sem adaptação específica para celular; validado só em janelas de desktop.
- `navegador.mjs` e `entrega.mjs` dependem do Chrome instalado; foram executados só no Chrome.
- O contraste é verificado sobre o fundo da página para textos SVG; textos sobre áreas translúcidas usam o fundo da página como aproximação.
- As duas partes são estimativas idealizadas: não medem a GPU nem executam o modelo.
- Com eixos lineares, o decode ($I = 1$) fica colado à origem; quando o ponto da operação está sobre ele, o rótulo “decode” pode ser ocultado para não sobrepor o rótulo do ponto ou da banda.
