"""
Módulo para procesamiento y limpieza de datos de calidad del aire
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
import argparse

from config.config import POLLUTANTS, AQI_BREAKPOINTS, AQI_CATEGORIES, DATA_PATHS


class AirQualityProcessor:
    """Clase para procesar y analizar datos de calidad del aire"""

    def __init__(self):
        self.pollutants = POLLUTANTS
        self.aqi_breakpoints = AQI_BREAKPOINTS
        self.aqi_categories = AQI_CATEGORIES

    def load_data(self, filepath: str) -> pd.DataFrame:
        """Carga datos desde archivo"""
        print(f"📂 Cargando datos desde {filepath}...")

        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath)
        elif filepath.endswith('.parquet'):
            df = pd.read_parquet(filepath)
        elif filepath.endswith('.json'):
            df = pd.read_json(filepath)
        else:
            raise ValueError(f"Formato no soportado: {filepath}")

        df['datetime'] = pd.to_datetime(df['datetime'])
        print(f"  ✓ {len(df)} registros cargados")
        return df

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Limpia los datos:
        - Elimina duplicados
        - Maneja valores faltantes
        - Elimina valores negativos
        - Detecta y maneja outliers
        """
        print("\n🧹 Limpiando datos...")

        initial_rows = len(df)

        # Eliminar duplicados
        df = df.drop_duplicates(subset=['datetime', 'parameter', 'location'])
        print(f"  - Duplicados eliminados: {initial_rows - len(df)}")

        # Eliminar valores negativos
        negative_mask = df['value'] < 0
        df = df[~negative_mask]
        print(f"  - Valores negativos eliminados: {negative_mask.sum()}")

        # Detectar outliers usando IQR (Rango Intercuartílico)
        outliers_removed = 0
        for param in df['parameter'].unique():
            param_mask = df['parameter'] == param
            Q1 = df.loc[param_mask, 'value'].quantile(0.25)
            Q3 = df.loc[param_mask, 'value'].quantile(0.75)
            IQR = Q3 - Q1

            # Límites para outliers (1.5 * IQR es estándar, pero usamos 3 para ser conservadores)
            lower_bound = Q1 - 3 * IQR
            upper_bound = Q3 + 3 * IQR

            outlier_mask = param_mask & ((df['value'] < lower_bound) | (df['value'] > upper_bound))
            outliers_removed += outlier_mask.sum()
            df = df[~outlier_mask]

        print(f"  - Outliers extremos eliminados: {outliers_removed}")

        # Ordenar por fecha
        df = df.sort_values(['datetime', 'parameter'])

        print(f"  ✓ Datos limpios: {len(df)} registros ({initial_rows - len(df)} eliminados)")
        return df

    def calculate_aqi(self, concentration: float, pollutant: str) -> float:
        """
        Calcula el AQI (Air Quality Index) para un contaminante dado

        Args:
            concentration: Concentración del contaminante
            pollutant: Nombre del contaminante (pm25, pm10, etc.)

        Returns:
            Valor del AQI
        """
        if pollutant not in self.aqi_breakpoints:
            return np.nan

        breakpoints = self.aqi_breakpoints[pollutant]

        for bp_lo, bp_hi, aqi_lo, aqi_hi in breakpoints:
            if bp_lo <= concentration <= bp_hi:
                # Fórmula del AQI
                aqi = ((aqi_hi - aqi_lo) / (bp_hi - bp_lo)) * (concentration - bp_lo) + aqi_lo
                return round(aqi)

        # Si está fuera de rango, retornar el máximo
        return 500

    def get_aqi_category(self, aqi: float) -> Dict:
        """
        Obtiene la categoría del AQI

        Args:
            aqi: Valor del AQI

        Returns:
            Diccionario con información de la categoría
        """
        for category in self.aqi_categories:
            if category['range'][0] <= aqi <= category['range'][1]:
                return category

        return self.aqi_categories[-1]  # Peligrosa

    def add_aqi_column(self, df: pd.DataFrame) -> pd.DataFrame:
        """Agrega columnas de AQI al DataFrame"""
        print("\n📊 Calculando AQI...")

        df['aqi'] = df.apply(
            lambda row: self.calculate_aqi(row['value'], row['parameter']),
            axis=1
        )

        # Agregar categoría y color
        df['aqi_category'] = df['aqi'].apply(lambda x: self.get_aqi_category(x)['label'] if pd.notna(x) else None)
        df['aqi_color'] = df['aqi'].apply(lambda x: self.get_aqi_category(x)['color'] if pd.notna(x) else None)

        print(f"  ✓ AQI calculado para {len(df)} registros")
        return df

    def resample_data(self, df: pd.DataFrame, freq: str = 'D') -> pd.DataFrame:
        """
        Re-muestrea los datos a una frecuencia específica

        Args:
            df: DataFrame con datos
            freq: Frecuencia ('H'=horario, 'D'=diario, 'W'=semanal, 'M'=mensual)

        Returns:
            DataFrame remuestreado
        """
        print(f"\n⏱ Re-muestreando datos a frecuencia {freq}...")

        # Pivotar para tener cada parámetro como columna
        df_pivot = df.pivot_table(
            values='value',
            index='datetime',
            columns='parameter',
            aggfunc='mean'
        )

        # Remuestrear
        df_resampled = df_pivot.resample(freq).mean()

        print(f"  ✓ Datos remuestreados: {len(df_resampled)} períodos")
        return df_resampled

    def calculate_statistics(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calcula estadísticas descriptivas por contaminante

        Returns:
            DataFrame con estadísticas
        """
        print("\n📈 Calculando estadísticas...")

        stats = []

        for param in df['parameter'].unique():
            param_data = df[df['parameter'] == param]['value']

            if param in POLLUTANTS:
                pollutant_info = POLLUTANTS[param]
                guideline_24h = pollutant_info.get('who_guideline_24h')
                guideline_annual = pollutant_info.get('who_guideline_annual')
            else:
                guideline_24h = None
                guideline_annual = None

            stats.append({
                'contaminante': param.upper(),
                'nombre_completo': pollutant_info['full_name'] if param in POLLUTANTS else param,
                'n_mediciones': len(param_data),
                'media': param_data.mean(),
                'mediana': param_data.median(),
                'min': param_data.min(),
                'max': param_data.max(),
                'std': param_data.std(),
                'percentil_25': param_data.quantile(0.25),
                'percentil_75': param_data.quantile(0.75),
                'percentil_95': param_data.quantile(0.95),
                'unidad': pollutant_info['unit'] if param in POLLUTANTS else 'N/A',
                'guia_oms_24h': guideline_24h,
                'excedencias_24h': (param_data > guideline_24h).sum() if guideline_24h else None
            })

        stats_df = pd.DataFrame(stats)
        print(f"  ✓ Estadísticas calculadas para {len(stats_df)} contaminantes")
        return stats_df

    def add_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Agrega características temporales útiles para análisis

        Args:
            df: DataFrame con columna 'datetime'

        Returns:
            DataFrame con columnas adicionales
        """
        print("\n🕐 Agregando características temporales...")

        df['year'] = df['datetime'].dt.year
        df['month'] = df['datetime'].dt.month
        df['day'] = df['datetime'].dt.day
        df['hour'] = df['datetime'].dt.hour
        df['dayofweek'] = df['datetime'].dt.dayofweek
        df['weekday_name'] = df['datetime'].dt.day_name()
        df['month_name'] = df['datetime'].dt.month_name()
        df['is_weekend'] = df['dayofweek'].isin([5, 6])

        # Estación del año (hemisferio sur)
        df['season'] = df['month'].map({
            12: 'Verano', 1: 'Verano', 2: 'Verano',
            3: 'Otoño', 4: 'Otoño', 5: 'Otoño',
            6: 'Invierno', 7: 'Invierno', 8: 'Invierno',
            9: 'Primavera', 10: 'Primavera', 11: 'Primavera'
        })

        # Período del día
        df['period_of_day'] = pd.cut(
            df['hour'],
            bins=[0, 6, 12, 18, 24],
            labels=['Madrugada', 'Mañana', 'Tarde', 'Noche'],
            include_lowest=True
        )

        print(f"  ✓ Características temporales agregadas")
        return df

    def save_processed_data(self, df: pd.DataFrame, filename: str):
        """Guarda datos procesados"""
        os.makedirs(DATA_PATHS['processed'], exist_ok=True)
        filepath = os.path.join(DATA_PATHS['processed'], filename)

        df.to_csv(filepath, index=False)
        print(f"\n💾 Datos procesados guardados en: {filepath}")


def main():
    parser = argparse.ArgumentParser(description='Procesar datos de calidad del aire')
    parser.add_argument('--input', required=True, help='Archivo de entrada')
    parser.add_argument('--output', default='processed_data.csv', help='Archivo de salida')

    args = parser.parse_args()

    processor = AirQualityProcessor()

    print("=" * 70)
    print("PROCESAMIENTO DE DATOS DE CALIDAD DEL AIRE")
    print("=" * 70)

    # Cargar datos
    df = processor.load_data(args.input)

    # Limpiar datos
    df = processor.clean_data(df)

    # Agregar características temporales
    df = processor.add_temporal_features(df)

    # Calcular AQI
    df = processor.add_aqi_column(df)

    # Calcular estadísticas
    stats = processor.calculate_statistics(df)
    print("\n" + "=" * 70)
    print("ESTADÍSTICAS DESCRIPTIVAS")
    print("=" * 70)
    print(stats.to_string(index=False))

    # Guardar datos procesados
    processor.save_processed_data(df, args.output)

    print("\n" + "=" * 70)
    print("✓ PROCESAMIENTO COMPLETADO")
    print("=" * 70)


if __name__ == "__main__":
    main()
