# Experimento: banda de memória da GPU

Mede a banda e o Roofline da GPU com kernels Triton, como em *Making Deep Learning Go Brrrr*, de Horace He.

**Requisitos:** Linux, GPU NVIDIA com driver CUDA e Python 3.12.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install torch triton numpy plotly ipykernel
# ou, com as versões exatas usadas: pip install -r requirements.txt
```

Abra `memory_bandwidth.ipynb` no VS Code ou no Jupyter, selecione o Python da `.venv` como kernel e execute as células em ordem. A primeira execução leva alguns minutos para compilar os kernels.

Os resultados (CSV, gráficos HTML e PTX) são salvos em `resultados_memory_bandwidth/`.
