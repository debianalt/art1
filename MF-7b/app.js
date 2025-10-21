// MF-7b: Visualizaciones de Series Temporales - JavaScript

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

const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84', '#6C5B7B', '#355C7D',
    '#99B898', '#FECEAB', '#FF847C', '#E84A5F', '#2A363B', '#A8E6CF'
];

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

// Cargar datos
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
        elements.chartsContainer.innerHTML = '<p style="color:red;">Error cargando datos</p>';
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

    // Event listeners
    elements.regionSelect.addEventListener('change', () => {
        updateCountries();
        updateData();
    });
    elements.flowSelect.addEventListener('change', updateData);
    elements.normalizeMode.addEventListener('change', updateData);
    elements.sortMode.addEventListener('change', updateData);

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
    } else if (region === 'Ambos') {
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

    // Renderizar
    renderGlobalChart(limitedCountries);
    renderCountryPanels(limitedCountries);
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

function renderGlobalChart(countriesData) {
    const traces = countriesData.map(([country, series], idx) => ({
        x: series.years,
        y: series.values,
        type: 'scatter',
        mode: 'lines+markers',
        name: country,
        line: {
            width: 2,
            color: COLORS[idx % COLORS.length]
        },
        marker: {
            size: 4
        }
    }));

    const normalizeMode = elements.normalizeMode.value;
    let yaxisTitle = currentUnit;
    if (normalizeMode === 'index100') yaxisTitle = 'Índice (base=100)';
    else if (normalizeMode === 'zscore') yaxisTitle = 'Z-score';
    else if (normalizeMode === 'minmax') yaxisTitle = 'Valor normalizado (0-1)';

    const layout = {
        title: {
            text: 'Comparación de todos los países',
            font: { size: 20, weight: 700 }
        },
        xaxis: {
            title: 'Año',
            gridcolor: '#e9ecef'
        },
        yaxis: {
            title: yaxisTitle,
            gridcolor: '#e9ecef'
        },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        height: 500,
        legend: {
            orientation: 'v',
            x: 1.02,
            y: 1
        },
        hovermode: 'x unified'
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    Plotly.newPlot('globalChart', traces, layout, config);
}

function renderCountryPanels(countriesData) {
    const normalizeMode = elements.normalizeMode.value;
    let yaxisTitle = currentUnit;
    if (normalizeMode === 'index100') yaxisTitle = 'Índice (base=100)';
    else if (normalizeMode === 'zscore') yaxisTitle = 'Z-score';
    else if (normalizeMode === 'minmax') yaxisTitle = 'Normalizado (0-1)';

    elements.chartsContainer.innerHTML = '';

    countriesData.forEach(([country, series], idx) => {
        const panel = document.createElement('div');
        panel.className = 'country-panel';
        panel.innerHTML = `
            <div class="country-title">${country}</div>
            <div id="chart-${idx}"></div>
        `;
        elements.chartsContainer.appendChild(panel);

        const trace = {
            x: series.years,
            y: series.values,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                width: 3,
                color: COLORS[idx % COLORS.length]
            },
            marker: {
                size: 6,
                color: COLORS[idx % COLORS.length]
            },
            fill: 'tozeroy',
            fillcolor: COLORS[idx % COLORS.length] + '30'
        };

        const layout = {
            xaxis: {
                title: 'Año',
                gridcolor: '#e9ecef'
            },
            yaxis: {
                title: yaxisTitle,
                gridcolor: '#e9ecef'
            },
            plot_bgcolor: '#f8f9fa',
            paper_bgcolor: 'white',
            height: 300,
            margin: { t: 20, r: 30, b: 50, l: 60 },
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        Plotly.newPlot(`chart-${idx}`, [trace], layout, config);
    });
}

loadData();
