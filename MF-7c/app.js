// MF-7c: Análisis de Desacoplamiento Tapio - JavaScript

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

// Categorías Tapio con colores
const TAPIO_CATEGORIES = {
    "Strong Decoupling": { color: "#2ecc71", desc: "Material ↓, Driver ↑" },
    "Weak Decoupling": { color: "#27ae60", desc: "Ambos ↑, Material < Driver" },
    "Expansive Coupling": { color: "#f39c12", desc: "Ambos ↑, Material ≈ Driver" },
    "Expansive Negative": { color: "#e67e22", desc: "Ambos ↑, Material > Driver" },
    "Strong Negative": { color: "#e74c3c", desc: "Material ↑, Driver ↓" },
    "Weak Negative": { color: "#c0392b", desc: "Ambos ↓, Material > Driver" },
    "Recessive Coupling": { color: "#95a5a6", desc: "Ambos ↓, Material ≈ Driver" },
    "Recessive Decoupling": { color: "#34495e", desc: "Ambos ↓, Material < Driver" }
};

let rawData = [];
let selectedCountries = [];
let tapioResults = [];

const elements = {
    regionSelect: document.getElementById('regionSelect'),
    flowSelect: document.getElementById('flowSelect'),
    driverSelect: document.getElementById('driverSelect'),
    tolerance: document.getElementById('tolerance'),
    yearStart: document.getElementById('yearStart'),
    yearEnd: document.getElementById('yearEnd'),
    toleranceValue: document.getElementById('toleranceValue'),
    yearStartValue: document.getElementById('yearStartValue'),
    yearEndValue: document.getElementById('yearEndValue')
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
    elements.driverSelect.innerHTML = flows.map(f =>
        `<option value="${f}"${f === 'GDP' ? ' selected' : ''}>${f}</option>`
    ).join('');

    // Event listeners
    [elements.regionSelect, elements.flowSelect, elements.driverSelect].forEach(el => {
        el.addEventListener('change', () => {
            updateCountries();
            updateData();
        });
    });

    elements.tolerance.addEventListener('input', () => {
        elements.toleranceValue.textContent = parseFloat(elements.tolerance.value).toFixed(2);
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
    const driver = elements.driverSelect.value;
    const yearMin = parseInt(elements.yearStart.value);
    const yearMax = parseInt(elements.yearEnd.value);
    const tol = parseFloat(elements.tolerance.value);

    tapioResults = [];

    selectedCountries.forEach(country => {
        // Obtener series de datos
        const flowData = getCountrySeries(country, flow, yearMin, yearMax);
        const driverData = getCountrySeries(country, driver, yearMin, yearMax);

        if (!flowData || !driverData) return;

        // Calcular análisis Tapio año a año
        for (let i = 1; i < flowData.years.length; i++) {
            const year = flowData.years[i];
            const yearPrev = flowData.years[i - 1];

            const valFlow = flowData.values[i];
            const valFlowPrev = flowData.values[i - 1];
            const valDriver = driverData.values[i];
            const valDriverPrev = driverData.values[i - 1];

            if (valFlowPrev === 0 || valDriverPrev === 0) continue;

            // Tasas de cambio
            const rateFlow = (valFlow - valFlowPrev) / valFlowPrev;
            const rateDriver = (valDriver - valDriverPrev) / valDriverPrev;

            // Clasificación Tapio
            const category = classifyTapio(rateFlow, rateDriver, tol);

            tapioResults.push({
                country,
                yearStart: yearPrev,
                yearEnd: year,
                rateFlow,
                rateDriver,
                category
            });
        }
    });

    renderTapioDistribution();
    renderTapioTimeline();
    renderScatterPlot();
}

function getCountrySeries(country, flow, yearMin, yearMax) {
    const data = rawData.filter(d =>
        d.country === country &&
        d.flowCode === flow &&
        d.year >= yearMin &&
        d.year <= yearMax
    ).sort((a, b) => a.year - b.year);

    if (data.length === 0) return null;

    return {
        years: data.map(d => d.year),
        values: data.map(d => d.value)
    };
}

function classifyTapio(rateFlow, rateDriver, tol) {
    // Ratio de elasticidad
    const elasticity = rateDriver !== 0 ? rateFlow / rateDriver : Infinity;

    if (rateDriver > 0) {
        // Driver creciendo
        if (rateFlow < 0) {
            return "Strong Decoupling";
        } else if (elasticity < 1 - tol) {
            return "Weak Decoupling";
        } else if (elasticity >= 1 - tol && elasticity <= 1 + tol) {
            return "Expansive Coupling";
        } else {
            return "Expansive Negative";
        }
    } else if (rateDriver < 0) {
        // Driver decreciendo
        if (rateFlow > 0) {
            return "Strong Negative";
        } else if (Math.abs(elasticity) < 1 - tol) {
            return "Recessive Decoupling";
        } else if (Math.abs(elasticity) >= 1 - tol && Math.abs(elasticity) <= 1 + tol) {
            return "Recessive Coupling";
        } else {
            return "Weak Negative";
        }
    } else {
        return "Expansive Coupling"; // Default
    }
}

function renderTapioDistribution() {
    const counts = {};
    Object.keys(TAPIO_CATEGORIES).forEach(cat => counts[cat] = 0);

    tapioResults.forEach(r => {
        counts[r.category]++;
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const colors = labels.map(l => TAPIO_CATEGORIES[l].color);

    const trace = {
        labels,
        values,
        type: 'pie',
        marker: { colors },
        textinfo: 'label+percent',
        textposition: 'outside',
        automargin: true
    };

    const layout = {
        title: {
            text: 'Distribución de Estados de Desacoplamiento',
            font: { size: 18 }
        },
        height: 500,
        showlegend: true
    };

    const config = {
        responsive: true,
        displaylogo: false
    };

    Plotly.newPlot('tapioDistribution', [trace], layout, config);
}

function renderTapioTimeline() {
    const countriesData = {};

    selectedCountries.forEach(country => {
        countriesData[country] = {};
    });

    tapioResults.forEach(r => {
        if (!countriesData[r.country][r.yearEnd]) {
            countriesData[r.country][r.yearEnd] = [];
        }
        countriesData[r.country][r.yearEnd].push(r.category);
    });

    const traces = [];
    const categories = Object.keys(TAPIO_CATEGORIES);

    categories.forEach(category => {
        const x = [];
        const y = [];
        const colors = [];

        selectedCountries.forEach((country, idx) => {
            const years = Object.keys(countriesData[country]).map(Number).sort((a, b) => a - b);
            years.forEach(year => {
                const cats = countriesData[country][year];
                if (cats.includes(category)) {
                    x.push(year);
                    y.push(country);
                    colors.push(TAPIO_CATEGORIES[category].color);
                }
            });
        });

        traces.push({
            x,
            y,
            mode: 'markers',
            type: 'scatter',
            name: category,
            marker: {
                size: 10,
                color: TAPIO_CATEGORIES[category].color
            }
        });
    });

    const layout = {
        title: {
            text: 'Evolución Temporal de Estados Tapio por País',
            font: { size: 18 }
        },
        xaxis: {
            title: 'Año',
            gridcolor: '#e9ecef'
        },
        yaxis: {
            title: 'País',
            gridcolor: '#e9ecef'
        },
        height: Math.max(400, selectedCountries.length * 40),
        hovermode: 'closest',
        showlegend: true
    };

    const config = {
        responsive: true,
        displaylogo: false
    };

    Plotly.newPlot('tapioTimeline', traces, layout, config);
}

function renderScatterPlot() {
    const traces = Object.keys(TAPIO_CATEGORIES).map(category => {
        const results = tapioResults.filter(r => r.category === category);

        return {
            x: results.map(r => r.rateDriver * 100),
            y: results.map(r => r.rateFlow * 100),
            mode: 'markers',
            type: 'scatter',
            name: category,
            marker: {
                size: 8,
                color: TAPIO_CATEGORIES[category].color,
                opacity: 0.7
            },
            text: results.map(r => `${r.country} (${r.yearStart}-${r.yearEnd})`),
            hovertemplate: '<b>%{text}</b><br>Driver: %{x:.1f}%<br>Material: %{y:.1f}%<extra></extra>'
        };
    });

    const layout = {
        title: {
            text: 'Dispersión: Tasa de Cambio Material vs Driver',
            font: { size: 18 }
        },
        xaxis: {
            title: 'Tasa de Cambio Driver (%)',
            gridcolor: '#e9ecef',
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        yaxis: {
            title: 'Tasa de Cambio Material (%)',
            gridcolor: '#e9ecef',
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        height: 600,
        hovermode: 'closest',
        showlegend: true,
        plot_bgcolor: '#f8f9fa'
    };

    const config = {
        responsive: true,
        displaylogo: false
    };

    Plotly.newPlot('scatterPlot', traces, layout, config);
}

loadData();
