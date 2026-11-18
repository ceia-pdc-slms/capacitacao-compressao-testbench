# Memória e banda

A apresentação em PDF está no arquivo [memoria-e-banda.pdf](memoria-e-banda.pdf).

Na pasta [`html_com_lab`](html_com_lab/), está a versão interativa em HTML. Para acessá-la, baixe o projeto e abra `html_com_lab/index.html` no navegador.

Essa versão inclui um **laboratório de Roofline e tokens/s**, que permite variar a intensidade aritmética, a banda e o tamanho do modelo para ver onde está o gargalo e quantos tokens por segundo cabem na banda da memória.

Na pasta [`experimento_memory_bandwidth`](experimento_memory_bandwidth/), está o notebook que mede a banda e o Roofline de uma GPU NVIDIA real.
