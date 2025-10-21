# Análisis de Calidad del Aire - Posadas, Misiones, Argentina

## 📍 Descripción del Proyecto

Proyecto de análisis integral de contaminación atmosférica en la ciudad de Posadas, provincia de Misiones, Argentina. Combina técnicas de geociencias y ciencias sociales para estudiar la calidad del aire local.

**Ubicación:**
- Ciudad: Posadas, Misiones, Argentina
- Coordenadas: 27.3670° S, 55.8960° O
- Población: ~350,000 habitantes (área metropolitana)

## 🌍 Contaminantes Analizados

- **PM2.5** - Material particulado fino (≤2.5 μm)
- **PM10** - Material particulado (≤10 μm)
- **NO₂** - Dióxido de nitrógeno
- **O₃** - Ozono troposférico
- **CO** - Monóxido de carbono
- **SO₂** - Dióxido de azufre

## 📊 Fuentes de Datos

1. **OpenAQ** - Datos de estaciones de monitoreo terrestres
2. **Sentinel-5P (Copernicus)** - Datos satelitales de contaminantes atmosféricos
3. **ERA5** - Datos meteorológicos (temperatura, viento, precipitación)
4. **Datos locales** - Si están disponibles de fuentes gubernamentales argentinas

## 🛠️ Tecnologías Utilizadas

- **Python 3.8+**
- **Análisis de datos:** pandas, numpy, scipy
- **Geoespacial:** geopandas, folium, rasterio
- **Visualización:** matplotlib, seaborn, plotly
- **Machine Learning:** scikit-learn
- **APIs:** requests, sentinelsat

## 📁 Estructura del Proyecto

```
art1/
├── config/              # Archivos de configuración
├── data/
│   ├── raw/            # Datos crudos sin procesar
│   └── processed/      # Datos procesados y limpios
├── src/                # Código fuente
│   ├── data_collection.py
│   ├── data_processing.py
│   ├── visualization.py
│   └── utils.py
├── notebooks/          # Jupyter notebooks para análisis
│   ├── 01_exploratory_analysis.ipynb
│   ├── 02_geospatial_analysis.ipynb
│   └── 03_temporal_analysis.ipynb
├── output/
│   ├── figures/        # Gráficos generados
│   └── reports/        # Reportes en PDF/HTML
└── requirements.txt    # Dependencias del proyecto
```

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd art1

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

## 📖 Uso

### 1. Recolección de Datos

```bash
# Descargar datos de OpenAQ
python src/data_collection.py --source openaq --days 30

# Descargar datos satelitales Sentinel-5P
python src/data_collection.py --source sentinel --start-date 2024-01-01 --end-date 2024-12-31
```

### 2. Procesamiento de Datos

```bash
python src/data_processing.py --input data/raw --output data/processed
```

### 3. Análisis Interactivo

```bash
jupyter notebook notebooks/01_exploratory_analysis.ipynb
```

## 📈 Análisis Incluidos

1. **Análisis Exploratorio de Datos (EDA)**
   - Estadísticas descriptivas
   - Distribución de contaminantes
   - Identificación de valores atípicos

2. **Análisis Geoespacial**
   - Mapas de distribución de contaminantes
   - Mapas de calor interactivos
   - Análisis de patrones espaciales

3. **Análisis Temporal**
   - Series temporales de contaminantes
   - Estacionalidad y tendencias
   - Correlaciones con variables meteorológicas
   - Predicción de niveles de contaminación

4. **Impacto en Salud Pública**
   - Índice de Calidad del Aire (ICA/AQI)
   - Días de excedencia de límites OMS
   - Estimación de población expuesta

## 🎯 Resultados Esperados

- Caracterización de la calidad del aire en Posadas
- Identificación de principales fuentes de contaminación
- Patrones temporales (diarios, semanales, estacionales)
- Visualizaciones interactivas
- Reportes técnicos y de divulgación

## 📚 Referencias

- OMS - Directrices sobre calidad del aire
- EPA - Air Quality Index
- Copernicus Sentinel-5P TROPOMI
- OpenAQ - Open Air Quality Data

## 👥 Contribuciones

Este es un proyecto de investigación abierto. Las contribuciones son bienvenidas.

## 📄 Licencia

MIT License

---

**Nota:** Este proyecto es con fines educativos y de investigación. Los datos deben ser validados con fuentes oficiales para toma de decisiones de política pública.
