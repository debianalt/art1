# 📊 MF-7: Notebooks de Análisis de Flujos de Materiales

## 🎯 Descripción General

Conjunto de **3 notebooks HTML interactivos** para el análisis de Material Flow Analysis (MFA) de la Unión Europea y Mercosur (1970-2024). Los notebooks están optimizados para visualización en GitHub Pages y funcionan completamente en el navegador sin necesidad de servidor.

### ✨ Características

- **100% Interactivos**: Gráficos dinámicos con Plotly.js
- **Sin dependencias de servidor**: Todo funciona en el navegador
- **Responsive**: Se adaptan a cualquier tamaño de pantalla
- **Datos de 50+ años**: Análisis histórico desde 1970
- **Múltiples indicadores**: MF, DMC, GDP, Población, y más

---

## 📦 Estructura de Notebooks

### 🔍 **MF-7a: Exploración de Datos**

**Objetivo**: Explorar, filtrar y visualizar estadísticas básicas de los datos MFA.

**Funcionalidades**:
- Selección de región (UE, Mercosur, Ambos, o países personalizados)
- Filtrado por indicador (Flow) y rango de años
- Estadísticas descriptivas en tiempo real
- Histograma de distribución de valores
- Tabla interactiva de datos filtrados (primeros 100 registros)

**Ideal para**: Familiarizarse con los datos, explorar rangos y valores.

**Ubicación**: `/MF-7a/index.html`

---

### 📈 **MF-7b: Visualizaciones de Series Temporales**

**Objetivo**: Visualizar y comparar series temporales por país con múltiples opciones de normalización.

**Funcionalidades**:
- Gráfico global de comparación de todos los países
- Paneles apilados individuales por país
- **Normalización**:
  - Ninguna (valores absolutos)
  - Índice base=100 (primera año como referencia)
  - Z-score (estandarización)
  - Min-Max (normalización 0-1)
- **Suavizado**: Media móvil de 0 a 5 años
- **Ordenamiento**: Por máximo, último valor, media, o alfabético
- Límite configurable de paneles a mostrar

**Ideal para**: Comparar tendencias entre países, identificar patrones temporales.

**Ubicación**: `/MF-7b/index.html`

---

### 🔬 **MF-7c: Análisis de Desacoplamiento Tapio**

**Objetivo**: Analizar la relación entre uso de materiales y variables económicas/ambientales usando la metodología Tapio.

**Funcionalidades**:
- Selección de indicador principal y variable driver
- Cálculo automático de elasticidad año a año
- Clasificación en 8 categorías Tapio:
  - **Strong Decoupling** (verde): Material ↓, Driver ↑
  - **Weak Decoupling** (verde claro): Ambos ↑, Material crece menos
  - **Expansive Coupling** (naranja): Ambos ↑ al mismo ritmo
  - **Expansive Negative** (naranja oscuro): Ambos ↑, Material crece más
  - **Strong Negative** (rojo): Material ↑, Driver ↓
  - **Weak Negative** (rojo oscuro): Ambos ↓, Material decrece menos
  - **Recessive Coupling** (gris): Ambos ↓ al mismo ritmo
  - **Recessive Decoupling** (gris oscuro): Ambos ↓, Material decrece más
- Tolerancia configurable (0.1 - 0.5)
- Visualizaciones:
  - Distribución de estados (gráfico de pastel)
  - Evolución temporal por país
  - Dispersión de tasas de cambio

**Ideal para**: Estudios de sostenibilidad, política ambiental, eficiencia de recursos.

**Ubicación**: `/MF-7c/index.html`

---

## 🚀 Cómo Usar

### Opción 1: GitHub Pages (Recomendado)

Una vez configurado GitHub Pages en el repositorio, los notebooks estarán disponibles en:

```
https://tu-usuario.github.io/art1/MF-7a/
https://tu-usuario.github.io/art1/MF-7b/
https://tu-usuario.github.io/art1/MF-7c/
```

### Opción 2: Servidor Local

```bash
# Opción A: Python
cd MF-7a
python -m http.server 8000

# Opción B: Node.js
npx http-server MF-7a -p 8000

# Luego abrir: http://localhost:8000
```

### Opción 3: Abrir Directamente

Simplemente abre `index.html` de cualquier notebook en tu navegador. Los archivos CSV deben estar en la misma carpeta.

---

## 📊 Datos Incluidos

**Archivo**: `mfa_data.csv` (3.4 MB, 6,745 filas)

**Estructura**:
- **Country**: Países de la UE y Mercosur
- **Flow name**: Nombre descriptivo del indicador
- **Flow code**: Código del indicador (MF, DMC, GDP, etc.)
- **Flow unit**: Unidad de medida (tonnes, million EUR, etc.)
- **1970-2024**: Columnas con valores anuales

**Indicadores principales**:
- **MF**: Material Footprint
- **DMC**: Domestic Material Consumption
- **GDP**: Gross Domestic Product
- **POP**: Population
- Y más de 50 indicadores adicionales

---

## 🎨 Diseño y UX

### Características de Diseño:

- **Gradientes modernos**: Cada notebook tiene su paleta de colores distintiva
  - MF-7a: Púrpura (exploración)
  - MF-7b: Rosa-Rojo (visualizaciones)
  - MF-7c: Azul (análisis científico)
- **Responsive**: Se adapta a desktop, tablet y móvil
- **Controles intuitivos**: Sliders con valores en vivo, dropdowns organizados
- **Feedback visual**: Hover effects, transiciones suaves
- **Accesibilidad**: Colores contrastados, textos legibles

---

## 🔧 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Diseño moderno con Grid y Flexbox
- **JavaScript (ES6+)**: Lógica de procesamiento
- **Plotly.js v2.27**: Visualizaciones interactivas
- **Sin frameworks**: Vanilla JavaScript para máxima performance

---

## 📈 Casos de Uso

### 1. **Investigación Académica**
Analizar patrones históricos de consumo de materiales en diferentes regiones.

### 2. **Política Pública**
Identificar países con mejor desacoplamiento (sostenibilidad) para replicar políticas.

### 3. **Educación**
Enseñar conceptos de economía circular, MFA, y análisis Tapio de forma visual.

### 4. **Reportes**
Generar gráficos para informes técnicos, presentaciones o publicaciones.

---

## 🤝 Navegación Recomendada

**Flujo sugerido**:

1. **MF-7a** → Explorar los datos, familiarizarse con indicadores y períodos
2. **MF-7b** → Visualizar tendencias, comparar países, identificar patrones
3. **MF-7c** → Análisis profundo de desacoplamiento, estudiar sostenibilidad

Cada notebook incluye enlaces directos a los otros para fácil navegación.

---

## 📝 Notas Técnicas

### Normalización (MF-7b)

- **Índice base=100**: Primer valor = 100, resto proporcional
- **Z-score**: `(x - μ) / σ` - útil para comparar distribuciones
- **Min-Max**: `(x - min) / (max - min)` - escala 0 a 1

### Suavizado (MF-7b)

Media móvil simétrica: promedio de valores ± ventana temporal.

### Clasificación Tapio (MF-7c)

Basado en:
- **rateFlow**: Tasa de cambio del indicador material
- **rateDriver**: Tasa de cambio de la variable driver
- **Elasticidad**: `e = rateFlow / rateDriver`

Clasificación según rangos de elasticidad y signos.

---

## 🐛 Troubleshooting

### Problema: "No hay datos para mostrar"

**Solución**: Verifica que el archivo `mfa_data.csv` esté en la misma carpeta que `index.html`.

### Problema: Gráficos no se muestran

**Solución**: Asegúrate de tener conexión a internet (Plotly.js se carga desde CDN).

### Problema: Navegación entre notebooks no funciona

**Solución**: Ajusta las rutas relativas en `index.html` según tu estructura de carpetas.

---

## 🔄 Mejoras Futuras Sugeridas

- [ ] Exportar gráficos como PNG/SVG
- [ ] Descargar datos filtrados como CSV
- [ ] Comparación lado a lado de múltiples indicadores
- [ ] Análisis de correlación entre indicadores
- [ ] Predicciones con modelos ARIMA/LSTM
- [ ] Versión offline completa (incluir Plotly.js local)
- [ ] Temas claro/oscuro

---

## 📚 Referencias

- **Tapio, P. (2005)**. "Towards a theory of decoupling: degrees of decoupling in the EU and the case of road traffic in Finland between 1970 and 2001." Transport Policy, 12(2), 137-151.
- **Material Flow Analysis (MFA)**: Metodología para cuantificar flujos y stocks de materiales
- **EUROSTAT**: Fuente de datos de la Unión Europea
- **CEPAL**: Datos de Mercosur

---

## 👥 Contribuciones

Este proyecto está abierto a mejoras. Sugerencias de mejora:

1. Fork el repositorio
2. Crea una rama con tu mejora
3. Envía un Pull Request

---

## 📄 Licencia

MIT License - Uso libre para investigación y educación.

---

## ✉️ Contacto

Para preguntas, sugerencias o reportar bugs, abre un Issue en GitHub.

---

**Última actualización**: Octubre 2024
**Versión**: 1.0.0
**Estado**: ✅ Producción

---

## 🎓 Créditos

Desarrollado con ❤️ para el análisis de Material Flow Analysis (MFA) de Unión Europea y Mercosur.

**Tecnologías**: HTML5, CSS3, JavaScript ES6+, Plotly.js
**Generado con**: Claude Code by Anthropic

---

¡Disfruta explorando los datos de MFA! 🚀📊
