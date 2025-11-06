// MF-7b: Paneles Apilados - JavaScript (Professional Edition)
// Small multiples con escala Y compartida estilo Observable

const BLOCS = {
    "UE": [
        "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
        "Denmark", "Estonia", "Finland", "France", "Germany", "Greece",
        "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
        "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
        "Slovenia", "Spain", "Sweden"
    ],
    "Mercosur": ["Argentina", "Brazil", "Uruguay", "Paraguay"]
};

let rawData = [];
let selectedCountries = [];
let currentUnit = '';

const elements = {
    regionSelect: document.getElementById('regionSelect'),
    flowSelect: document.getElementById('flowSelect'),
    normalizeMode: document.getElementById('normalizeMode'),
    smoothing: document.getElementById('smoothing'),
    yearStart: document.getElementById('yearStart'),
    yearEnd: document.getElementById('yearEnd'),
    maxPanels: document.getElementById('maxPanels'),
    sortMode: document.getElementById('sortMode'),
    smoothingValue: document.getElementById('smoothingValue'),
    yearStartValue: document.getElementById('yearStartValue'),
    yearEndValue: document.getElementById('yearEndValue'),
    maxPanelsValue: document.getElementById('maxPanelsValue'),
    chartsContainer: document.getElementById('chartsContainer')
};

// Theme profesional oscuro
const PLOTLY_THEME = {
    plot_bgcolor: '#1a1a1a',
    paper_bgcolor: '#1a1a1a',
    font: { color: '#e0e0e0', family: 'Inter, sans-serif', size: 11 },
    xaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a3a', showticklabels: true },
    yaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a3a' }
};

const PLOTLY_CONFIG = {
    responsive: true,
    displayModeBar: false,
    displaylogo: false
};

async function loadData() {
    try {
        const response = await fetch('mfa_data.csv');
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        const yearColumns = headers.filter(h => /^\d{4}$/.test(h));

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const country = values[0];
            const flowName = values[1];
            const flowCode = values[2];
            const flowUnit = values[3];

            yearColumns.forEach((year, idx) => {
                const value = parseFloat(values[4 + idx]);
                if (!isNaN(value) && value !== 0) {
                    data.push({
                        country, flowName, flowCode, flowUnit,
                        year: parseInt(year), value
                    });
                }
            });
        }

        rawData = data;
        initializeUI();
        updateData();
    } catch (error) {
        console.error('Error:', error);
        elements.chartsContainer.innerHTML = '<p style="color:#ff4444; text-align:center; padding:40px;">Error cargando datos</p>';
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(v => v.trim().replace(/^"|"$/g, ''));
}

function initializeUI() {
    const flows = [...new Set(rawData.map(d => d.flowCode))].sort();
    elements.flowSelect.innerHTML = flows.map(f =>
        `<option value="${f}"${f === 'MF' ? ' selected' : ''}>${f}</option>`
    ).join('');

    [elements.regionSelect, elements.flowSelect, elements.normalizeMode, elements.sortMode].forEach(el => {
        el.addEventListener('change', () => {
            if (el === elements.regionSelect) updateCountries();
            updateData();
        });
    });

    elements.smoothing.addEventListener('input', () => {
        elements.smoothingValue.textContent = elements.smoothing.value;
        updateData();
    });
    elements.yearStart.addEventListener('input', () => {
        elements.yearStartValue.textContent = elements.yearStart.value;
        updateData();
    });
    elements.yearEnd.addEventListener('input', () => {
        elements.yearEndValue.textContent = elements.yearEnd.value;
        updateData();
    });
    elements.maxPanels.addEventListener('input', () => {
        elements.maxPanelsValue.textContent = elements.maxPanels.value;
        updateData();
    });

    updateCountries();
}

function updateCountries() {
    const region = elements.regionSelect.value;
    if (region === 'UE') {
        selectedCountries = BLOCS.UE.filter(c => rawData.some(d => d.country === c));
    } else if (region === 'Mercosur') {
        selectedCountries = BLOCS.Mercosur.filter(c => rawData.some(d => d.country === c));
    } else {
        selectedCountries = [...BLOCS.UE, ...BLOCS.Mercosur].filter(c =>
            rawData.some(d => d.country === c)
        );
    }
}

function updateData() {
    const flow = elements.flowSelect.value;
    const yearMin = parseInt(elements.yearStart.value);
    const yearMax = parseInt(elements.yearEnd.value);

    // Agrupar por país
    const seriesByCountry = new Map();

    selectedCountries.forEach(country => {
        const countryData = rawData.filter(d =>
            d.country === country &&
            d.flowCode === flow &&
            d.year >= yearMin &&
            d.year <= yearMax
        ).sort((a, b) => a.year - b.year);

        if (countryData.length > 0) {
            currentUnit = countryData[0].flowUnit;
            const years = countryData.map(d => d.year);
            const values = countryData.map(d => d.value);

            seriesByCountry.set(country, {
                country,
                years,
                values: applySmoothing(values, parseInt(elements.smoothing.value))
            });
        }
    });

    // Normalizar
    const normalizeMode = elements.normalizeMode.value;
    seriesByCountry.forEach((series, country) => {
        series.values = normalize(series.values, normalizeMode);
    });

    // Ordenar países
    const sortedCountries = sortCountries(seriesByCountry);

    // Limitar paneles
    const maxPanels = parseInt(elements.maxPanels.value);
    const limitedCountries = sortedCountries.slice(0, maxPanels);

    // Renderizar con escala compartida
    renderStackedPanels(limitedCountries, normalizeMode);
}

function applySmoothing(values, window) {
    if (window === 0) return values;

    const smoothed = [];
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - window);
        const end = Math.min(values.length - 1, i + window);
        let sum = 0, count = 0;
        for (let j = start; j <= end; j++) {
            sum += values[j];
            count++;
        }
        smoothed.push(sum / count);
    }
    return smoothed;
}

function normalize(values, mode) {
    if (mode === 'none') return values;

    const finite = values.filter(v => Number.isFinite(v));
    if (finite.length === 0) return values;

    if (mode === 'index100') {
        const base = finite[0];
        return values.map(v => (v / base) * 100);
    } else if (mode === 'zscore') {
        const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
        const std = Math.sqrt(
            finite.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / finite.length
        ) || 1;
        return values.map(v => (v - mean) / std);
    } else if (mode === 'minmax') {
        const min = Math.min(...finite);
        const max = Math.max(...finite);
        const range = max - min || 1;
        return values.map(v => (v - min) / range);
    }

    return values;
}

function sortCountries(seriesByCountry) {
    const sortMode = elements.sortMode.value;
    const countries = Array.from(seriesByCountry.entries());

    if (sortMode === 'max') {
        return countries.sort((a, b) => {
            const maxA = Math.max(...a[1].values.filter(Number.isFinite));
            const maxB = Math.max(...b[1].values.filter(Number.isFinite));
            return maxB - maxA;
        });
    } else if (sortMode === 'last') {
        return countries.sort((a, b) => {
            const lastA = a[1].values.filter(Number.isFinite).pop() || 0;
            const lastB = b[1].values.filter(Number.isFinite).pop() || 0;
            return lastB - lastA;
        });
    } else if (sortMode === 'mean') {
        return countries.sort((a, b) => {
            const meanA = a[1].values.filter(Number.isFinite)
                .reduce((s, v) => s + v, 0) / a[1].values.length;
            const meanB = b[1].values.filter(Number.isFinite)
                .reduce((s, v) => s + v, 0) / b[1].values.length;
            return meanB - meanA;
        });
    } else {
        return countries.sort((a, b) => a[0].localeCompare(b[0]));
    }
}

// Calcular escala Y compartida (clave para small multiples)
function calculateSharedYRange(countriesData, normalizeMode) {
    let globalMin = Infinity;
    let globalMax = -Infinity;

    countriesData.forEach(([country, series]) => {
        const finite = series.values.filter(Number.isFinite);
        if (finite.length > 0) {
            const localMin = Math.min(...finite);
            const localMax = Math.max(...finite);
            if (localMin < globalMin) globalMin = localMin;
            if (localMax > globalMax) globalMax = localMax;
        }
    });

    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
        return null;
    }

    // Para z-score, usar rango simétrico
    if (normalizeMode === 'zscore') {
        const absMax = Math.max(Math.abs(globalMin), Math.abs(globalMax));
        return [-absMax * 1.1, absMax * 1.1];
    }

    // Para otros, agregar padding
    const padding = (globalMax - globalMin) * 0.05 || 1;
    return [globalMin - padding, globalMax + padding];
}

function renderStackedPanels(countriesData, normalizeMode) {
    if (countriesData.length === 0) {
        elements.chartsContainer.innerHTML = '<div class="loading">No hay datos para mostrar</div>';
        return;
    }

    elements.chartsContainer.innerHTML = '';

    // Calcular rango Y compartido
    const sharedYRange = calculateSharedYRange(countriesData, normalizeMode);

    // Determinar título del eje Y
    let yaxisTitle = currentUnit;
    if (normalizeMode === 'index100') yaxisTitle = 'Índice (base=100)';
    else if (normalizeMode === 'zscore') yaxisTitle = 'Z-score';
    else if (normalizeMode === 'minmax') yaxisTitle = 'Normalizado (0-1)';

    // Renderizar cada panel
    countriesData.forEach(([country, series], idx) => {
        const panel = document.createElement('div');
        panel.className = 'country-panel';

        const lastValue = series.values.filter(Number.isFinite).pop();
        const rank = `#${idx + 1} | Último: ${lastValue?.toFixed(1) || 'N/A'}`;

        panel.innerHTML = `
            <div class="country-title">
                <span>${country}</span>
                <span class="country-rank">${rank}</span>
            </div>
            <div id="chart-${idx}" class="chart-container"></div>
        `;
        elements.chartsContainer.appendChild(panel);

        const trace = {
            x: series.years,
            y: series.values,
            type: 'scatter',
            mode: 'lines',
            line: {
                width: 2,
                color: '#4a9eff'
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(74, 158, 255, 0.15)',
            hovertemplate: `<b>${country}</b><br>Año: %{x}<br>Valor: %{y:.2f}<extra></extra>`
        };

        const layout = {
            ...PLOTLY_THEME,
            xaxis: {
                ...PLOTLY_THEME.xaxis,
                showticklabels: idx === countriesData.length - 1, // Solo último
                fixedrange: false
            },
            yaxis: {
                ...PLOTLY_THEME.yaxis,
                title: idx === 0 ? { text: yaxisTitle, font: { size: 10 } } : undefined,
                range: sharedYRange,
                fixedrange: true
            },
            height: 220,
            margin: { t: 10, r: 30, b: idx === countriesData.length - 1 ? 40 : 20, l: 60 },
            showlegend: false
        };

        Plotly.newPlot(`chart-${idx}`, [trace], layout, PLOTLY_CONFIG);
    });
}

loadData();
