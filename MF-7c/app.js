// MF-7c: Análisis Tapio - JavaScript (Professional Edition)
// Ridge plots y visualizaciones sofisticadas, SIN gráfico de torta

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

const TAPIO_CATEGORIES = {
    "Strong Decoupling": { color: "#27ae60", order: 1 },
    "Weak Decoupling": { color: "#2ecc71", order: 2 },
    "Expansive Coupling": { color: "#f39c12", order: 3 },
    "Expansive Negative": { color: "#e67e22", order: 4 },
    "Strong Negative": { color: "#e74c3c", order: 5 },
    "Weak Negative": { color: "#c0392b", order: 6 },
    "Recessive Coupling": { color: "#7f8c8d", order: 7 },
    "Recessive Decoupling": { color: "#34495e", order: 8 }
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

const PLOTLY_THEME = {
    plot_bgcolor: '#1a1a1a',
    paper_bgcolor: '#1a1a1a',
    font: { color: '#e0e0e0', family: 'Inter, sans-serif', size: 11 },
    xaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a3a' },
    yaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a3a' }
};

const PLOTLY_CONFIG = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
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

    [elements.regionSelect, elements.flowSelect, elements.driverSelect].forEach(el => {
        el.addEventListener('change', () => {
            if (el === elements.regionSelect) updateCountries();
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
        const flowData = getCountrySeries(country, flow, yearMin, yearMax);
        const driverData = getCountrySeries(country, driver, yearMin, yearMax);

        if (!flowData || !driverData) return;

        for (let i = 1; i < flowData.years.length; i++) {
            const year = flowData.years[i];
            const yearPrev = flowData.years[i - 1];

            const valFlow = flowData.values[i];
            const valFlowPrev = flowData.values[i - 1];
            const valDriver = driverData.values[i];
            const valDriverPrev = driverData.values[i - 1];

            if (valFlowPrev === 0 || valDriverPrev === 0) continue;

            const rateFlow = (valFlow - valFlowPrev) / valFlowPrev;
            const rateDriver = (valDriver - valDriverPrev) / valDriverPrev;
            const elasticity = rateDriver !== 0 ? rateFlow / rateDriver : Infinity;

            const category = classifyTapio(rateFlow, rateDriver, tol);

            tapioResults.push({
                country,
                yearStart: yearPrev,
                yearEnd: year,
                rateFlow,
                rateDriver,
                elasticity,
                category
            });
        }
    });

    renderScatterPlot();
    renderTapioTimeline();
    renderRidgePlot();
    renderTransitionMatrix();
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
    const elasticity = rateDriver !== 0 ? rateFlow / rateDriver : Infinity;

    if (rateDriver > 0) {
        if (rateFlow < 0) return "Strong Decoupling";
        else if (elasticity < 1 - tol) return "Weak Decoupling";
        else if (elasticity >= 1 - tol && elasticity <= 1 + tol) return "Expansive Coupling";
        else return "Expansive Negative";
    } else if (rateDriver < 0) {
        if (rateFlow > 0) return "Strong Negative";
        else if (Math.abs(elasticity) < 1 - tol) return "Recessive Decoupling";
        else if (Math.abs(elasticity) >= 1 - tol && Math.abs(elasticity) <= 1 + tol) return "Recessive Coupling";
        else return "Weak Negative";
    } else {
        return "Expansive Coupling";
    }
}

function renderScatterPlot() {
    if (tapioResults.length === 0) {
        document.getElementById('scatterPlot').innerHTML = '<p style="text-align:center;padding:40px;color:#666;">No hay datos</p>';
        return;
    }

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
                opacity: 0.7,
                line: { color: '#2a2a2a', width: 1 }
            },
            text: results.map(r => `${r.country} (${r.yearStart}-${r.yearEnd})`),
            hovertemplate: '<b>%{text}</b><br>Driver: %{x:.1f}%<br>Material: %{y:.1f}%<extra></extra>'
        };
    });

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Tasa de Cambio Driver (%)', font: { size: 12 } },
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: 'Tasa de Cambio Material (%)', font: { size: 12 } },
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        height: 600,
        hovermode: 'closest',
        showlegend: true,
        legend: { x: 1.02, y: 1 }
    };

    Plotly.newPlot('scatterPlot', traces, layout, PLOTLY_CONFIG);
}

function renderTapioTimeline() {
    if (tapioResults.length === 0) {
        document.getElementById('tapioTimeline').innerHTML = '<p style="text-align:center;padding:40px;color:#666;">No hay datos</p>';
        return;
    }

    const traces = [];
    const categories = Object.keys(TAPIO_CATEGORIES);

    categories.forEach(category => {
        const x = [];
        const y = [];

        selectedCountries.forEach(country => {
            const countryResults = tapioResults.filter(r => r.country === country && r.category === category);
            countryResults.forEach(r => {
                x.push(r.yearEnd);
                y.push(country);
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
                color: TAPIO_CATEGORIES[category].color,
                symbol: 'square'
            }
        });
    });

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Año', font: { size: 12 } }
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: 'País', font: { size: 12 } }
        },
        height: Math.max(400, selectedCountries.length * 40),
        hovermode: 'closest',
        showlegend: true,
        legend: { x: 1.02, y: 1 }
    };

    Plotly.newPlot('tapioTimeline', traces, layout, PLOTLY_CONFIG);
}

function renderRidgePlot() {
    if (tapioResults.length === 0) {
        document.getElementById('ridgePlot').innerHTML = '<p style="text-align:center;padding:40px;color:#666;">No hay datos</p>';
        return;
    }

    // Agrupar elasticidades por país
    const elasticitiesByCountry = {};
    selectedCountries.forEach(c => elasticitiesByCountry[c] = []);

    tapioResults.forEach(r => {
        if (Number.isFinite(r.elasticity) && Math.abs(r.elasticity) < 10) {
            elasticitiesByCountry[r.country].push(r.elasticity);
        }
    });

    // Ordenar países por mediana de elasticidad
    const sortedCountries = Object.keys(elasticitiesByCountry)
        .filter(c => elasticitiesByCountry[c].length > 0)
        .sort((a, b) => {
            const medianA = d3.median(elasticitiesByCountry[a]) || 0;
            const medianB = d3.median(elasticitiesByCountry[b]) || 0;
            return medianB - medianA;
        });

    const traces = sortedCountries.map((country, idx) => ({
        x: elasticitiesByCountry[country],
        type: 'violin',
        name: country,
        orientation: 'h',
        side: 'positive',
        width: 3,
        points: false,
        marker: {
            color: `hsl(${(idx * 360 / sortedCountries.length)}, 70%, 60%)`
        },
        line: { color: '#2a2a2a' },
        meanline: { visible: true }
    }));

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Elasticidad (Material / Driver)', font: { size: 12 } },
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2,
            range: [-3, 3]
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            showticklabels: false
        },
        height: Math.max(500, sortedCountries.length * 40),
        showlegend: true,
        legend: { x: 1.02, y: 1 }
    };

    Plotly.newPlot('ridgePlot', traces, layout, PLOTLY_CONFIG);
}

function renderTransitionMatrix() {
    if (tapioResults.length === 0) {
        document.getElementById('transitionMatrix').innerHTML = '<p style="text-align:center;padding:40px;color:#666;">No hay datos</p>';
        return;
    }

    // Agrupar por país y año para encontrar transiciones
    const byCountryYear = {};
    tapioResults.forEach(r => {
        const key = `${r.country}_${r.yearEnd}`;
        byCountryYear[key] = r.category;
    });

    // Calcular matriz de transición
    const categories = Object.keys(TAPIO_CATEGORIES);
    const transitions = {};
    categories.forEach(from => {
        transitions[from] = {};
        categories.forEach(to => {
            transitions[from][to] = 0;
        });
    });

    tapioResults.forEach(r => {
        const prevKey = `${r.country}_${r.yearStart}`;
        const currKey = `${r.country}_${r.yearEnd}`;
        const prevCat = byCountryYear[prevKey];
        const currCat = byCountryYear[currKey];

        if (prevCat && currCat) {
            transitions[prevCat][currCat]++;
        }
    });

    // Preparar datos para heatmap
    const z = categories.map(from =>
        categories.map(to => transitions[from][to])
    );

    const trace = {
        z,
        x: categories.map(c => c.replace(' ', '<br>')),
        y: categories.map(c => c.replace(' ', '<br>')),
        type: 'heatmap',
        colorscale: [
            [0, '#0f0f0f'],
            [0.5, '#4a9eff'],
            [1, '#ff4a4a']
        ],
        showscale: true,
        hovertemplate: 'De: %{y}<br>A: %{x}<br>Transiciones: %{z}<extra></extra>'
    };

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Estado Destino', font: { size: 11 } },
            tickangle: -45
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: 'Estado Origen', font: { size: 11 } }
        },
        height: 600,
        margin: { t: 20, r: 100, b: 120, l: 120 }
    };

    Plotly.newPlot('transitionMatrix', [trace], layout, PLOTLY_CONFIG);
}

loadData();
