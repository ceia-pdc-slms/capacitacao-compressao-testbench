# Laboratório

Quatro experimentos, um por tela, para testar o que a apresentação mostra. Página em `index.html`; a barra do topo e os botões no pé de cada tela trocam de experimento (endereços `#1` a `#4`). Cada tela tem um cartão com o desenho e um cartão com as leituras e os controles. Estilos em `lab.css` (sobre as variáveis de `../style.css`); fórmulas com o KaTeX local. Tudo funciona sem internet.

| Arquivo | Conteúdo |
| --- | --- |
| `js/lab.js` | utilidades (SVG, KaTeX, formatação, gerador com semente) e navegação |
| `js/exp1.js` | 1 · Qual peso sai? |
| `js/exp2.js` | 2 · Desligue pesos |
| `js/exp3.js` | 3 · SparseGPT passo a passo |
| `js/exp4.js` | 4 · Chegue a 2× |
| `testes/cdp.mjs` | controla um Chrome sem janela para testes de interface |

## 1 · Qual peso sai? (slides 4 a 6)

A rede de 2 entradas e 1 saída do slide 6, com pesos e normas $\lVert X_j \rVert_2$ sorteados. A pessoa escolhe (botão, clique na conexão ou teclado) a conexão que a poda por magnitude remove e, depois, a que o Wanda remove. A resposta mostra a conta $S_{ij} = |W_{ij}| \cdot \lVert X_j \rVert_2$ (Sun et al., Eq. 1–2) e marca as conexões na rede. O sorteio evita empates e faz os dois métodos discordarem em cerca de 2/3 dos casos.

## 2 · Desligue pesos (slides 1, 2, 4 e 5)

Rede 4-6-6-3 (78 conexões): tanh nas camadas ocultas, saída linear, pesos sorteados com semente fixa e entrada fixa $(0{,}3;\ -1{,}6;\ 2{,}4;\ 0{,}1)$. O alvo $y^{*}$ é a saída da rede completa e o erro é $\lVert y - y^{*} \rVert_2^2$. Cada clique numa conexão a desliga ou religa e refaz a passada direta: as contas são reais. Espessura da conexão $\propto |w|$; cor = sinal; brilho e velocidade do fluxo $\propto |w \cdot x|$; brilho do neurônio $\propto$ |ativação|.

Os botões removem as 8 conexões ligadas (10%) de menor $|w|$ ou de menor $|w| \cdot |x|$, com $|x|$ a ativação atual do neurônio de origem. Ao chegar a 50%, a página mostra o erro que cada botão atinge partindo da rede completa (0,572 e 0,131 com a semente atual).

Simplificações: o critério $|w| \cdot |x|$ é o score do Wanda com uma única amostra e comparação global, não por saída e por camada como no artigo. A semente foi escolhida para a diferença ficar clara; em 40 sementes testadas, $|w| \cdot |x|$ teve erro menor a 50% na maioria, mas não em todas.

## 3 · SparseGPT passo a passo (slides 8 e 9)

Sete passos, com botões de avançar e voltar, sobre a mesma linha de pesos do slide 8: $w = (0{,}82;\ -0{,}07;\ 0{,}31;\ -1{,}24)$ e $X$ de 4 entradas × 6 tokens. Tudo é calculado na página: $H = XX^\top$, $H^{-1}$, o erro de remover cada peso $\varepsilon_m = w_m^2 / [H^{-1}]_{mm}$, o ajuste $\boldsymbol\delta = -\frac{w_m}{[H^{-1}]_{mm}} H^{-1}_{:,m}$ (Frantar e Alistarh, Eq. 3) e a atualização da inversa (sem a linha e a coluna removidas). Duas rodadas levam a 50%: sai $w_2$, depois $w_3$, e o resultado é $(1{,}18;\ 0;\ 0;\ -0{,}98)$, com erro 0,02 contra 0,55 sem compensação — os mesmos números do slide 8. O painel da direita mostra os pesos atuais e a saída por token (alvo, só zerar, compensando).

Simplificação: aqui sai sempre o peso de menor $\varepsilon$ e todos os pesos restantes são ajustados (reconstrução exata, que o artigo descreve na seção 3.1). O SparseGPT de fato percorre as colunas da esquerda para a direita, ajusta só os pesos à direita e escolhe a máscara em blocos de colunas.

## 4 · Chegue a 2× (slides 11 e 12)

Lei de Amdahl com dois controles, cada um com o símbolo e a definição ao lado: $p$, a parte acelerável (fração do tempo gasta nas multiplicações por matrizes de pesos), e $s$, a aceleração dessa parte (quantas vezes ela fica mais rápida com os zeros). O cartão principal explica por que só uma parte acelera: o pruning zera pesos, então só ganham as contas que usam pesos — as camadas lineares da atenção e do MLP; o resto (atenção entre tokens, normalizações, funções de ativação, amostragem) não tem pesos podados. A barra "depois" mostra o tempo novo, $(1 - p) + p/s$, contra a meta de 50% (2×); a página exibe a conta com $p$ e $s$ em cores e o teto $1/(1 - p)$ para aceleração infinita. Começa em $p = 60\%$ e $s = 2$ (1,43×, o exemplo do slide 12); com 60%, o 2× só chega em $s = 6$, e com até 50% acelerável é impossível. O "≈ 1,6× com 2:4" citado em $s$ é o medido em Sun et al. (Wanda), Tabela 5.
