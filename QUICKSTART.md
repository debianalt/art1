# Guía de Inicio Rápido

## 🚀 Configuración Inicial

### 1. Crear entorno virtual

```bash
# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# En Linux/Mac:
source venv/bin/activate

# En Windows:
venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 📊 Generar Datos de Ejemplo

Para comenzar sin necesidad de APIs externas, genera datos sintéticos:

```bash
python src/data_collection.py --source synthetic --days 365 --format csv
```

Esto creará:
- `data/raw/synthetic_data.csv` con un año de datos sintéticos

## 🔬 Procesar Datos

```bash
python src/data_processing.py --input data/raw/synthetic_data.csv --output processed_data.csv
```

Esto creará:
- `data/processed/processed_data.csv` con datos limpios y procesados
- Estadísticas descriptivas en la consola

## 📈 Análisis con Jupyter Notebooks

```bash
# Iniciar Jupyter
jupyter notebook
```

Luego abre y ejecuta en orden:

1. **`notebooks/01_exploratory_analysis.ipynb`**
   - Análisis exploratorio de datos
   - Estadísticas descriptivas
   - Gráficos de distribuciones

2. **`notebooks/02_geospatial_analysis.ipynb`**
   - Mapas interactivos de Posadas
   - Visualización geoespacial
   - Mapas de calor

3. **`notebooks/03_temporal_analysis.ipynb`**
   - Series temporales
   - Predicciones
   - Análisis de tendencias

## 📁 Estructura de Salida

Después de ejecutar los notebooks, encontrarás:

```
output/
├── figures/          # Gráficos PNG y mapas HTML
│   ├── time_series.png
│   ├── distributions.png
│   ├── mapa_base_posadas.html
│   └── ...
└── reports/         # Reportes CSV
    ├── estadisticas_descriptivas.csv
    └── excedencias_oms.csv
```

## 🌍 Obtener Datos Reales (Opcional)

### OpenAQ

```bash
python src/data_collection.py --source openaq --days 30
```

### Ambas Fuentes

```bash
python src/data_collection.py --source both --days 365
```

## 🔧 Solución de Problemas

### Error: ModuleNotFoundError

Asegúrate de:
1. Tener el entorno virtual activado
2. Haber instalado las dependencias: `pip install -r requirements.txt`

### Error: No such file or directory

Crea las carpetas necesarias:
```bash
mkdir -p data/raw data/processed output/figures output/reports
```

### Notebooks no se conectan al kernel

```bash
python -m ipykernel install --user --name=venv
```

## 📚 Siguiente Pasos

1. Revisa los gráficos generados en `output/figures/`
2. Consulta las estadísticas en `output/reports/`
3. Modifica los parámetros en `config/config.py` según tus necesidades
4. Personaliza los análisis en los notebooks

## 💡 Consejos

- Los datos sintéticos están diseñados para simular patrones realistas de una ciudad como Posadas
- Para datos reales, considera contactar autoridades locales de calidad del aire
- Los límites de la OMS están configurados en `config/config.py`

## 📞 Ayuda

Si encuentras problemas, revisa:
- `README.md` para documentación completa
- Comentarios en el código fuente
- Configuración en `config/config.py`
