"""
Módulo para visualización de datos de calidad del aire
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from typing import List, Optional
import warnings
warnings.filterwarnings('ignore')

from config.config import POLLUTANTS, AQI_CATEGORIES, LOCATION, PLOT_CONFIG, DATA_PATHS


class AirQualityVisualizer:
    """Clase para visualización de datos de calidad del aire"""

    def __init__(self):
        self.pollutants = POLLUTANTS
        self.location = LOCATION
        self.plot_config = PLOT_CONFIG

        # Configurar estilo de gráficos
        plt.style.use('seaborn-v0_8-darkgrid')
        sns.set_palette("husl")

    def plot_time_series(self, df: pd.DataFrame, pollutants: Optional[List[str]] = None,
                        save: bool = True, filename: str = 'time_series.png'):
        """
        Gráfico de series temporales para contaminantes

        Args:
            df: DataFrame con datos procesados
            pollutants: Lista de contaminantes a graficar (None = todos)
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        if pollutants is None:
            pollutants = ['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']

        # Filtrar datos
        df_filtered = df[df['parameter'].isin(pollutants)].copy()

        # Crear subplots
        n_pollutants = len(pollutants)
        fig, axes = plt.subplots(n_pollutants, 1, figsize=(14, 3 * n_pollutants))

        if n_pollutants == 1:
            axes = [axes]

        for idx, param in enumerate(pollutants):
            ax = axes[idx]
            param_data = df_filtered[df_filtered['parameter'] == param]

            if not param_data.empty:
                # Línea principal
                ax.plot(param_data['datetime'], param_data['value'],
                       color=POLLUTANTS[param]['color'], linewidth=1, alpha=0.7)

                # Media móvil de 24 horas
                param_data_sorted = param_data.sort_values('datetime')
                rolling_mean = param_data_sorted.set_index('datetime')['value'].rolling(window=24).mean()
                ax.plot(rolling_mean.index, rolling_mean.values,
                       color=POLLUTANTS[param]['color'], linewidth=2,
                       label='Media móvil 24h')

                # Línea guía OMS si existe
                if 'who_guideline_24h' in POLLUTANTS[param]:
                    guideline = POLLUTANTS[param]['who_guideline_24h']
                    ax.axhline(y=guideline, color='red', linestyle='--',
                             linewidth=1.5, label=f'Guía OMS 24h: {guideline} {POLLUTANTS[param]["unit"]}')

                ax.set_ylabel(f'{POLLUTANTS[param]["name"]}\n({POLLUTANTS[param]["unit"]})',
                            fontsize=12, fontweight='bold')
                ax.set_xlabel('Fecha', fontsize=10)
                ax.legend(loc='upper right')
                ax.grid(True, alpha=0.3)
                ax.set_title(f'{POLLUTANTS[param]["full_name"]}', fontsize=13, pad=10)

        plt.suptitle(f'Series Temporales de Calidad del Aire - {self.location["name"]}, {self.location["province"]}',
                    fontsize=16, fontweight='bold', y=0.995)
        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig

    def plot_distributions(self, df: pd.DataFrame, save: bool = True,
                          filename: str = 'distributions.png'):
        """
        Gráficos de distribución de contaminantes

        Args:
            df: DataFrame con datos
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        pollutants = df['parameter'].unique()
        n_pollutants = len(pollutants)

        fig, axes = plt.subplots(2, 3, figsize=(16, 10))
        axes = axes.flatten()

        for idx, param in enumerate(pollutants[:6]):
            ax = axes[idx]
            param_data = df[df['parameter'] == param]['value']

            if not param_data.empty:
                # Histograma y KDE
                ax.hist(param_data, bins=50, alpha=0.6, color=POLLUTANTS[param]['color'],
                       edgecolor='black', density=True)

                param_data.plot.kde(ax=ax, color='darkblue', linewidth=2)

                # Línea guía OMS
                if 'who_guideline_24h' in POLLUTANTS[param]:
                    guideline = POLLUTANTS[param]['who_guideline_24h']
                    ax.axvline(x=guideline, color='red', linestyle='--',
                             linewidth=2, label=f'OMS: {guideline}')

                # Media
                mean_val = param_data.mean()
                ax.axvline(x=mean_val, color='green', linestyle='-',
                         linewidth=2, label=f'Media: {mean_val:.1f}')

                ax.set_xlabel(f'{POLLUTANTS[param]["unit"]}', fontsize=11)
                ax.set_ylabel('Densidad', fontsize=11)
                ax.set_title(f'{POLLUTANTS[param]["name"]} - {POLLUTANTS[param]["full_name"]}',
                           fontsize=12, fontweight='bold')
                ax.legend()
                ax.grid(True, alpha=0.3)

        plt.suptitle(f'Distribución de Contaminantes - {self.location["name"]}',
                    fontsize=16, fontweight='bold')
        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig

    def plot_heatmap_by_time(self, df: pd.DataFrame, pollutant: str = 'pm25',
                            save: bool = True, filename: str = 'heatmap_temporal.png'):
        """
        Mapa de calor de contaminante por hora y día de la semana

        Args:
            df: DataFrame con datos
            pollutant: Contaminante a visualizar
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        # Filtrar datos del contaminante
        param_data = df[df['parameter'] == pollutant].copy()

        if param_data.empty:
            print(f"⚠ No hay datos para {pollutant}")
            return None

        # Crear pivot table
        pivot_data = param_data.pivot_table(
            values='value',
            index='dayofweek',
            columns='hour',
            aggfunc='mean'
        )

        # Nombres de días
        day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        pivot_data.index = [day_names[i] if i < len(day_names) else str(i) for i in pivot_data.index]

        # Crear gráfico
        fig, ax = plt.subplots(figsize=(14, 6))

        sns.heatmap(pivot_data, cmap='YlOrRd', annot=False, fmt='.1f',
                   cbar_kws={'label': f'{POLLUTANTS[pollutant]["unit"]}'}, ax=ax)

        ax.set_xlabel('Hora del día', fontsize=12, fontweight='bold')
        ax.set_ylabel('Día de la semana', fontsize=12, fontweight='bold')
        ax.set_title(f'Patrón Horario Semanal - {POLLUTANTS[pollutant]["name"]} ({POLLUTANTS[pollutant]["full_name"]})\n{self.location["name"]}, {self.location["province"]}',
                    fontsize=14, fontweight='bold', pad=15)

        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig

    def plot_seasonal_patterns(self, df: pd.DataFrame, save: bool = True,
                              filename: str = 'seasonal_patterns.png'):
        """
        Gráfico de patrones estacionales

        Args:
            df: DataFrame con datos
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        fig, axes = plt.subplots(2, 3, figsize=(16, 10))
        axes = axes.flatten()

        pollutants = ['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']

        for idx, param in enumerate(pollutants):
            ax = axes[idx]
            param_data = df[df['parameter'] == param]

            if not param_data.empty and 'season' in param_data.columns:
                # Box plot por estación
                season_order = ['Verano', 'Otoño', 'Invierno', 'Primavera']
                param_data_sorted = param_data[param_data['season'].isin(season_order)]

                sns.boxplot(data=param_data_sorted, x='season', y='value',
                           order=season_order, ax=ax, palette='Set2')

                # Línea guía OMS
                if 'who_guideline_24h' in POLLUTANTS[param]:
                    guideline = POLLUTANTS[param]['who_guideline_24h']
                    ax.axhline(y=guideline, color='red', linestyle='--',
                             linewidth=1.5, label='OMS')

                ax.set_xlabel('Estación', fontsize=11, fontweight='bold')
                ax.set_ylabel(f'{POLLUTANTS[param]["unit"]}', fontsize=11)
                ax.set_title(f'{POLLUTANTS[param]["name"]} - {POLLUTANTS[param]["full_name"]}',
                           fontsize=12, fontweight='bold')
                ax.grid(True, alpha=0.3, axis='y')

        plt.suptitle(f'Variación Estacional de Contaminantes - {self.location["name"]}',
                    fontsize=16, fontweight='bold')
        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig

    def plot_aqi_distribution(self, df: pd.DataFrame, save: bool = True,
                             filename: str = 'aqi_distribution.png'):
        """
        Gráfico de distribución de categorías AQI

        Args:
            df: DataFrame con columna AQI
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        if 'aqi_category' not in df.columns:
            print("⚠ No hay datos de AQI")
            return None

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

        # Gráfico de barras de categorías
        category_counts = df['aqi_category'].value_counts()

        colors_dict = {cat['label']: cat['color'] for cat in AQI_CATEGORIES}
        colors = [colors_dict.get(cat, '#CCCCCC') for cat in category_counts.index]

        ax1.barh(category_counts.index, category_counts.values, color=colors, edgecolor='black')
        ax1.set_xlabel('Número de mediciones', fontsize=12, fontweight='bold')
        ax1.set_title('Distribución de Categorías de Calidad del Aire (AQI)', fontsize=13, fontweight='bold')
        ax1.grid(True, alpha=0.3, axis='x')

        # Gráfico circular
        ax2.pie(category_counts.values, labels=category_counts.index, autopct='%1.1f%%',
               colors=colors, startangle=90, textprops={'fontsize': 10})
        ax2.set_title('Proporción de Categorías AQI', fontsize=13, fontweight='bold')

        plt.suptitle(f'Índice de Calidad del Aire - {self.location["name"]}, {self.location["province"]}',
                    fontsize=16, fontweight='bold', y=1.02)
        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig

    def plot_correlation_matrix(self, df: pd.DataFrame, save: bool = True,
                               filename: str = 'correlation_matrix.png'):
        """
        Matriz de correlación entre contaminantes

        Args:
            df: DataFrame con datos
            save: Si guardar el gráfico
            filename: Nombre del archivo
        """
        # Pivotar datos
        df_pivot = df.pivot_table(values='value', index='datetime', columns='parameter', aggfunc='mean')

        # Calcular correlación
        corr_matrix = df_pivot.corr()

        # Gráfico
        fig, ax = plt.subplots(figsize=(10, 8))

        sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='coolwarm',
                   center=0, square=True, linewidths=1, cbar_kws={'label': 'Correlación'},
                   ax=ax, vmin=-1, vmax=1)

        ax.set_title(f'Matriz de Correlación entre Contaminantes\n{self.location["name"]}, {self.location["province"]}',
                    fontsize=14, fontweight='bold', pad=15)

        # Nombres de contaminantes en mayúsculas
        ax.set_xticklabels([label.get_text().upper() for label in ax.get_xticklabels()])
        ax.set_yticklabels([label.get_text().upper() for label in ax.get_yticklabels()])

        plt.tight_layout()

        if save:
            os.makedirs(DATA_PATHS['figures'], exist_ok=True)
            filepath = os.path.join(DATA_PATHS['figures'], filename)
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            print(f"📊 Gráfico guardado: {filepath}")

        return fig


if __name__ == "__main__":
    # Ejemplo de uso
    print("Este módulo debe ser importado o usado con datos procesados.")
    print("Ejemplo:")
    print("  from visualization import AirQualityVisualizer")
    print("  viz = AirQualityVisualizer()")
    print("  viz.plot_time_series(df)")
