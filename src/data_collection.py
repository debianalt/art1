"""
Script para recolección de datos de calidad del aire
Fuentes: OpenAQ, Sentinel-5P, datos locales
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
from typing import Dict, List, Optional
import argparse
from tqdm import tqdm

from config.config import LOCATION, BBOX, POLLUTANTS, API_CONFIG, DATA_PATHS


class AirQualityDataCollector:
    """Clase para recolectar datos de calidad del aire de múltiples fuentes"""

    def __init__(self):
        self.location = LOCATION
        self.bbox = BBOX
        self.api_config = API_CONFIG

    def fetch_openaq_data(self, days: int = 30, parameters: Optional[List[str]] = None) -> pd.DataFrame:
        """
        Obtiene datos de OpenAQ para Posadas

        Args:
            days: Número de días hacia atrás desde hoy
            parameters: Lista de parámetros a obtener (pm25, pm10, no2, etc.)

        Returns:
            DataFrame con los datos de calidad del aire
        """
        print(f"🌍 Obteniendo datos de OpenAQ para {self.location['name']}...")

        # Fechas
        date_to = datetime.now()
        date_from = date_to - timedelta(days=days)

        # Parámetros por defecto
        if parameters is None:
            parameters = ['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']

        base_url = self.api_config['openaq']['base_url']

        # Endpoint actualizado de OpenAQ v2
        url = f"{base_url}measurements"

        all_data = []

        for param in parameters:
            print(f"  Descargando {param.upper()}...")

            params = {
                'location': self.location['name'],
                'parameter': param,
                'date_from': date_from.strftime('%Y-%m-%d'),
                'date_to': date_to.strftime('%Y-%m-%d'),
                'limit': self.api_config['openaq']['limit'],
                'coordinates': f"{self.location['latitude']},{self.location['longitude']}",
                'radius': self.api_config['openaq']['radius']
            }

            try:
                response = requests.get(url, params=params, timeout=30)

                if response.status_code == 200:
                    data = response.json()

                    if 'results' in data and len(data['results']) > 0:
                        for result in data['results']:
                            all_data.append({
                                'datetime': result['date']['utc'],
                                'parameter': result['parameter'],
                                'value': result['value'],
                                'unit': result['unit'],
                                'location': result['location'],
                                'city': result.get('city', self.location['name']),
                                'country': result['country'],
                                'latitude': result['coordinates']['latitude'],
                                'longitude': result['coordinates']['longitude']
                            })
                        print(f"    ✓ {len(data['results'])} mediciones obtenidas")
                    else:
                        print(f"    ⚠ No hay datos disponibles para {param}")
                else:
                    print(f"    ✗ Error {response.status_code} al obtener {param}")

            except Exception as e:
                print(f"    ✗ Error: {e}")

        if all_data:
            df = pd.DataFrame(all_data)
            df['datetime'] = pd.to_datetime(df['datetime'])
            df = df.sort_values('datetime')
            print(f"\n✓ Total: {len(df)} mediciones recolectadas")
            return df
        else:
            print("\n⚠ No se obtuvieron datos de OpenAQ")
            return pd.DataFrame()

    def generate_synthetic_data(self, days: int = 365) -> pd.DataFrame:
        """
        Genera datos sintéticos realistas para demostración
        Basado en patrones típicos de ciudades medianas en clima subtropical

        Args:
            days: Número de días de datos a generar

        Returns:
            DataFrame con datos sintéticos de calidad del aire
        """
        print(f"🔬 Generando datos sintéticos para {days} días...")

        # Rango de fechas
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        date_range = pd.date_range(start=start_date, end=end_date, freq='H')

        data = []

        for dt in tqdm(date_range, desc="Generando datos"):
            # Factores temporales
            hour = dt.hour
            day_of_week = dt.dayofweek
            month = dt.month

            # Factor hora pico (mañana y tarde)
            rush_hour_factor = 1.0
            if hour in [7, 8, 9, 18, 19, 20]:
                rush_hour_factor = 1.5
            elif hour in [0, 1, 2, 3, 4, 5]:
                rush_hour_factor = 0.6

            # Factor fin de semana
            weekend_factor = 0.8 if day_of_week >= 5 else 1.0

            # Factor estacional (invierno más alto por calefacción)
            seasonal_factor = 1.0
            if month in [6, 7, 8]:  # Invierno austral
                seasonal_factor = 1.3
            elif month in [12, 1, 2]:  # Verano
                seasonal_factor = 0.9

            # Generar valores con patrones realistas
            # PM2.5 - Valores típicos: 5-25 μg/m³, picos hasta 50
            pm25_base = 12 + 8 * np.sin(2 * np.pi * hour / 24)
            pm25 = max(0, pm25_base * rush_hour_factor * weekend_factor * seasonal_factor +
                      np.random.normal(0, 3))

            # PM10 - Generalmente 1.5-2x PM2.5
            pm10 = pm25 * 1.8 + np.random.normal(0, 5)
            pm10 = max(0, pm10)

            # NO2 - Principalmente del tráfico, 10-40 μg/m³
            no2_base = 15 + 10 * np.sin(2 * np.pi * hour / 24)
            no2 = max(0, no2_base * rush_hour_factor * weekend_factor + np.random.normal(0, 4))

            # O3 - Alto en verano y mediodía, 20-80 μg/m³
            o3_base = 40 + 20 * np.sin(2 * np.pi * (hour - 6) / 24)
            o3_seasonal = 1.3 if month in [12, 1, 2] else 0.9
            o3 = max(0, o3_base * o3_seasonal + np.random.normal(0, 8))

            # CO - 0.2-1.5 mg/m³
            co_base = 0.5 + 0.3 * np.sin(2 * np.pi * hour / 24)
            co = max(0, co_base * rush_hour_factor * weekend_factor + np.random.normal(0, 0.1))

            # SO2 - Generalmente bajo, 2-10 μg/m³
            so2 = max(0, 5 + np.random.normal(0, 2))

            # Agregar datos para cada contaminante
            measurements = {
                'pm25': pm25,
                'pm10': pm10,
                'no2': no2,
                'o3': o3,
                'co': co,
                'so2': so2
            }

            for param, value in measurements.items():
                data.append({
                    'datetime': dt,
                    'parameter': param,
                    'value': round(value, 2),
                    'unit': POLLUTANTS[param]['unit'],
                    'location': f"{self.location['name']}_station_1",
                    'city': self.location['name'],
                    'country': self.location['country'],
                    'latitude': self.location['latitude'],
                    'longitude': self.location['longitude']
                })

        df = pd.DataFrame(data)
        print(f"✓ {len(df)} mediciones sintéticas generadas")
        return df

    def save_data(self, df: pd.DataFrame, filename: str, format: str = 'csv'):
        """
        Guarda los datos en el formato especificado

        Args:
            df: DataFrame a guardar
            filename: Nombre del archivo (sin extensión)
            format: Formato ('csv', 'parquet', 'json')
        """
        os.makedirs(DATA_PATHS['raw'], exist_ok=True)

        filepath = os.path.join(DATA_PATHS['raw'], f"{filename}.{format}")

        if format == 'csv':
            df.to_csv(filepath, index=False)
        elif format == 'parquet':
            df.to_parquet(filepath, index=False)
        elif format == 'json':
            df.to_json(filepath, orient='records', date_format='iso')

        print(f"💾 Datos guardados en: {filepath}")
        print(f"   Tamaño: {len(df)} filas, {len(df.columns)} columnas")


def main():
    parser = argparse.ArgumentParser(description='Recolectar datos de calidad del aire')
    parser.add_argument('--source', choices=['openaq', 'synthetic', 'both'],
                       default='both', help='Fuente de datos')
    parser.add_argument('--days', type=int, default=365,
                       help='Días de datos a recolectar/generar')
    parser.add_argument('--format', choices=['csv', 'parquet', 'json'],
                       default='csv', help='Formato de salida')

    args = parser.parse_args()

    collector = AirQualityDataCollector()

    print("=" * 70)
    print("RECOLECCIÓN DE DATOS DE CALIDAD DEL AIRE")
    print(f"Ubicación: {LOCATION['name']}, {LOCATION['province']}, {LOCATION['country']}")
    print(f"Coordenadas: {LOCATION['latitude']}, {LOCATION['longitude']}")
    print("=" * 70)
    print()

    # OpenAQ
    if args.source in ['openaq', 'both']:
        try:
            df_openaq = collector.fetch_openaq_data(days=args.days)
            if not df_openaq.empty:
                collector.save_data(df_openaq, 'openaq_data', args.format)
            else:
                print("⚠ No se obtuvieron datos de OpenAQ, generando datos sintéticos...")
                args.source = 'synthetic'
        except Exception as e:
            print(f"✗ Error al obtener datos de OpenAQ: {e}")
            print("  Generando datos sintéticos en su lugar...")
            args.source = 'synthetic'

    # Datos sintéticos
    if args.source in ['synthetic', 'both']:
        df_synthetic = collector.generate_synthetic_data(days=args.days)
        collector.save_data(df_synthetic, 'synthetic_data', args.format)

    print()
    print("=" * 70)
    print("✓ PROCESO COMPLETADO")
    print("=" * 70)


if __name__ == "__main__":
    main()
