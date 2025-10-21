"""
Configuración del proyecto de análisis de calidad del aire
Posadas, Misiones, Argentina
"""

# Coordenadas de Posadas, Misiones, Argentina
LOCATION = {
    'name': 'Posadas',
    'province': 'Misiones',
    'country': 'Argentina',
    'latitude': -27.3670,
    'longitude': -55.8960,
    'altitude': 125,  # metros sobre el nivel del mar
    'timezone': 'America/Argentina/Buenos_Aires'
}

# Área de estudio (bounding box)
# Aproximadamente 50km alrededor de Posadas
BBOX = {
    'min_lat': -27.6670,
    'max_lat': -27.0670,
    'min_lon': -56.1960,
    'max_lon': -55.5960
}

# Contaminantes a analizar
POLLUTANTS = {
    'pm25': {
        'name': 'PM2.5',
        'full_name': 'Material particulado fino',
        'unit': 'μg/m³',
        'who_guideline_24h': 15,  # μg/m³ (OMS 2021)
        'who_guideline_annual': 5,
        'color': '#FF6B6B'
    },
    'pm10': {
        'name': 'PM10',
        'full_name': 'Material particulado',
        'unit': 'μg/m³',
        'who_guideline_24h': 45,
        'who_guideline_annual': 15,
        'color': '#4ECDC4'
    },
    'no2': {
        'name': 'NO₂',
        'full_name': 'Dióxido de nitrógeno',
        'unit': 'μg/m³',
        'who_guideline_24h': 25,
        'who_guideline_annual': 10,
        'color': '#45B7D1'
    },
    'o3': {
        'name': 'O₃',
        'full_name': 'Ozono troposférico',
        'unit': 'μg/m³',
        'who_guideline_8h': 100,
        'color': '#96CEB4'
    },
    'co': {
        'name': 'CO',
        'full_name': 'Monóxido de carbono',
        'unit': 'mg/m³',
        'who_guideline_24h': 4,
        'color': '#FFEAA7'
    },
    'so2': {
        'name': 'SO₂',
        'full_name': 'Dióxido de azufre',
        'unit': 'μg/m³',
        'who_guideline_24h': 40,
        'color': '#DFE6E9'
    }
}

# Índice de Calidad del Aire (AQI) - EPA Standard
AQI_BREAKPOINTS = {
    'pm25': [
        (0, 12.0, 0, 50),      # Good
        (12.1, 35.4, 51, 100),  # Moderate
        (35.5, 55.4, 101, 150), # Unhealthy for Sensitive Groups
        (55.5, 150.4, 151, 200),# Unhealthy
        (150.5, 250.4, 201, 300),# Very Unhealthy
        (250.5, 500.4, 301, 500)# Hazardous
    ],
    'pm10': [
        (0, 54, 0, 50),
        (55, 154, 51, 100),
        (155, 254, 101, 150),
        (255, 354, 151, 200),
        (355, 424, 201, 300),
        (425, 604, 301, 500)
    ],
    'no2': [
        (0, 53, 0, 50),
        (54, 100, 51, 100),
        (101, 360, 101, 150),
        (361, 649, 151, 200),
        (650, 1249, 201, 300),
        (1250, 2049, 301, 500)
    ],
    'o3': [
        (0, 54, 0, 50),
        (55, 70, 51, 100),
        (71, 85, 101, 150),
        (86, 105, 151, 200),
        (106, 200, 201, 300)
    ],
    'co': [
        (0, 4.4, 0, 50),
        (4.5, 9.4, 51, 100),
        (9.5, 12.4, 101, 150),
        (12.5, 15.4, 151, 200),
        (15.5, 30.4, 201, 300),
        (30.5, 50.4, 301, 500)
    ],
    'so2': [
        (0, 35, 0, 50),
        (36, 75, 51, 100),
        (76, 185, 101, 150),
        (186, 304, 151, 200),
        (305, 604, 201, 300),
        (605, 1004, 301, 500)
    ]
}

# Categorías del AQI
AQI_CATEGORIES = [
    {'range': (0, 50), 'label': 'Buena', 'color': '#00E400', 'health': 'La calidad del aire es satisfactoria'},
    {'range': (51, 100), 'label': 'Moderada', 'color': '#FFFF00', 'health': 'Aceptable para la mayoría'},
    {'range': (101, 150), 'label': 'Insalubre para grupos sensibles', 'color': '#FF7E00', 'health': 'Grupos sensibles pueden experimentar efectos'},
    {'range': (151, 200), 'label': 'Insalubre', 'color': '#FF0000', 'health': 'Todos pueden comenzar a experimentar efectos'},
    {'range': (201, 300), 'label': 'Muy Insalubre', 'color': '#8F3F97', 'health': 'Alerta de salud: todos pueden experimentar efectos graves'},
    {'range': (301, 500), 'label': 'Peligrosa', 'color': '#7E0023', 'health': 'Alerta de emergencia: toda la población afectada'}
]

# APIs y configuración de datos
API_CONFIG = {
    'openaq': {
        'base_url': 'https://api.openaq.org/v2/',
        'radius': 50000,  # metros (50km)
        'limit': 10000
    },
    'sentinel': {
        'api_url': 'https://scihub.copernicus.eu/dhus',
        'products': ['S5P_L2__NO2', 'S5P_L2__CO', 'S5P_L2__SO2', 'S5P_L2__O3']
    }
}

# Configuración de visualización
PLOT_CONFIG = {
    'figsize': (12, 8),
    'dpi': 300,
    'style': 'seaborn-v0_8-darkgrid',
    'font_size': 12,
    'title_size': 16
}

# Rutas de datos
DATA_PATHS = {
    'raw': 'data/raw/',
    'processed': 'data/processed/',
    'figures': 'output/figures/',
    'reports': 'output/reports/'
}
