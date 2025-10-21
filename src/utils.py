"""
Utilidades y funciones auxiliares para el proyecto
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List


def load_config():
    """Carga la configuración del proyecto"""
    from config.config import LOCATION, POLLUTANTS, AQI_CATEGORIES
    return {
        'location': LOCATION,
        'pollutants': POLLUTANTS,
        'aqi_categories': AQI_CATEGORIES
    }


def print_summary(df: pd.DataFrame):
    """
    Imprime un resumen del DataFrame de calidad del aire

    Args:
        df: DataFrame con datos de calidad del aire
    """
    print("=" * 70)
    print("RESUMEN DE DATOS DE CALIDAD DEL AIRE")
    print("=" * 70)

    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
        print(f"\n📅 Período:")
        print(f"   Desde: {df['datetime'].min()}")
        print(f"   Hasta: {df['datetime'].max()}")
        print(f"   Duración: {(df['datetime'].max() - df['datetime'].min()).days} días")

    print(f"\n📊 Datos:")
    print(f"   Registros totales: {len(df):,}")
    print(f"   Contaminantes: {', '.join(df['parameter'].unique())}")

    if 'location' in df.columns:
        print(f"   Ubicaciones: {df['location'].nunique()}")

    print(f"\n📈 Estadísticas básicas:")
    for param in df['parameter'].unique():
        param_data = df[df['parameter'] == param]['value']
        print(f"   {param.upper()}:")
        print(f"      Media: {param_data.mean():.2f}")
        print(f"      Mediana: {param_data.median():.2f}")
        print(f"      Min: {param_data.min():.2f}")
        print(f"      Max: {param_data.max():.2f}")

    print("=" * 70)


def export_to_excel(df: pd.DataFrame, filepath: str, sheet_name: str = 'Datos'):
    """
    Exporta DataFrame a Excel con formato

    Args:
        df: DataFrame a exportar
        filepath: Ruta del archivo de salida
        sheet_name: Nombre de la hoja
    """
    try:
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        print(f"✓ Datos exportados a: {filepath}")
    except Exception as e:
        print(f"✗ Error al exportar a Excel: {e}")


def create_daily_report(df: pd.DataFrame, date: str = None) -> pd.DataFrame:
    """
    Crea un reporte diario de calidad del aire

    Args:
        df: DataFrame con datos
        date: Fecha en formato 'YYYY-MM-DD' (None = hoy)

    Returns:
        DataFrame con reporte diario
    """
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    df['datetime'] = pd.to_datetime(df['datetime'])
    df['date'] = df['datetime'].dt.date

    target_date = pd.to_datetime(date).date()
    daily_data = df[df['date'] == target_date]

    if daily_data.empty:
        print(f"⚠ No hay datos para la fecha {date}")
        return pd.DataFrame()

    # Calcular promedios diarios
    report = daily_data.groupby('parameter').agg({
        'value': ['mean', 'min', 'max', 'std', 'count']
    }).round(2)

    report.columns = ['Promedio', 'Mínimo', 'Máximo', 'Desv.Std', 'N_mediciones']
    report.index.name = 'Contaminante'

    return report.reset_index()


def calculate_health_impact_estimate(df: pd.DataFrame) -> Dict:
    """
    Estima impacto potencial en salud basado en excedencias de guías OMS

    Args:
        df: DataFrame con datos de calidad del aire

    Returns:
        Diccionario con estimaciones
    """
    from config.config import POLLUTANTS, LOCATION

    results = {
        'ubicacion': f"{LOCATION['name']}, {LOCATION['province']}",
        'poblacion_estimada': 350000,  # Posadas área metropolitana
        'contaminantes': {}
    }

    df['datetime'] = pd.to_datetime(df['datetime'])

    for param in ['pm25', 'pm10', 'no2']:
        if param not in df['parameter'].unique():
            continue

        param_data = df[df['parameter'] == param].copy()

        # Promedio diario
        daily_avg = param_data.groupby(param_data['datetime'].dt.date)['value'].mean()

        if 'who_guideline_24h' in POLLUTANTS[param]:
            guideline = POLLUTANTS[param]['who_guideline_24h']

            total_days = len(daily_avg)
            exceeded_days = (daily_avg > guideline).sum()
            percentage = (exceeded_days / total_days * 100) if total_days > 0 else 0

            # Estimación simple de población expuesta
            # (Esto es una simplificación; estudios reales requieren modelos epidemiológicos)
            population_exposed = int(results['poblacion_estimada'] * (percentage / 100))

            results['contaminantes'][param] = {
                'nombre': POLLUTANTS[param]['full_name'],
                'dias_totales': total_days,
                'dias_excedidos': exceeded_days,
                'porcentaje_excedencia': round(percentage, 1),
                'guia_oms': guideline,
                'poblacion_potencialmente_expuesta': population_exposed
            }

    return results


def generate_summary_statistics(df: pd.DataFrame, output_dir: str = 'output/reports'):
    """
    Genera y guarda estadísticas resumidas

    Args:
        df: DataFrame con datos
        output_dir: Directorio de salida
    """
    os.makedirs(output_dir, exist_ok=True)

    # Estadísticas por contaminante
    stats = []
    for param in df['parameter'].unique():
        param_data = df[df['parameter'] == param]['value']
        stats.append({
            'Contaminante': param.upper(),
            'N': len(param_data),
            'Media': param_data.mean(),
            'Mediana': param_data.median(),
            'Desv.Std': param_data.std(),
            'Mín': param_data.min(),
            'Máx': param_data.max(),
            'P25': param_data.quantile(0.25),
            'P75': param_data.quantile(0.75),
            'P95': param_data.quantile(0.95)
        })

    stats_df = pd.DataFrame(stats).round(2)
    filepath = os.path.join(output_dir, 'resumen_estadistico.csv')
    stats_df.to_csv(filepath, index=False)
    print(f"✓ Resumen estadístico guardado: {filepath}")

    return stats_df


if __name__ == "__main__":
    print("Módulo de utilidades para análisis de calidad del aire")
    print("\nFunciones disponibles:")
    print("  - load_config()")
    print("  - print_summary(df)")
    print("  - export_to_excel(df, filepath)")
    print("  - create_daily_report(df, date)")
    print("  - calculate_health_impact_estimate(df)")
    print("  - generate_summary_statistics(df)")
