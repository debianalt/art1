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

    // Agregar por país para todo el período
    const countryAggregates = {};

    tapioResults.forEach(r => {
        if (!countryAggregates[r.country]) {
            countryAggregates[r.country] = {
                country: r.country,
                rateFlowSum: 0,
                rateDriverSum: 0,
                count: 0,
                categories: []
            };
        }
        countryAggregates[r.country].rateFlowSum += r.rateFlow;
        countryAggregates[r.country].rateDriverSum += r.rateDriver;
        countryAggregates[r.country].count += 1;
        countryAggregates[r.country].categories.push(r.category);
    });

    // Calcular promedios y categoría dominante
    const aggregatedData = Object.values(countryAggregates).map(agg => {
        const avgRateFlow = agg.rateFlowSum / agg.count;
        const avgRateDriver = agg.rateDriverSum / agg.count;

        // Categoría más frecuente
        const categoryCounts = {};
        agg.categories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        const dominantCategory = Object.keys(categoryCounts).reduce((a, b) =>
            categoryCounts[a] > categoryCounts[b] ? a : b
        );

        return {
            country: agg.country,
            avgRateFlow,
            avgRateDriver,
            count: agg.count,
            category: dominantCategory
        };
    });

    // Crear trazas por categoría
    const traces = Object.keys(TAPIO_CATEGORIES).map(category => {
        const data = aggregatedData.filter(d => d.category === category);

        return {
            x: data.map(d => d.avgRateDriver * 100),
            y: data.map(d => d.avgRateFlow * 100),
            mode: 'markers+text',
            type: 'scatter',
            name: category,
            marker: {
                size: data.map(d => Math.max(10, Math.min(30, d.count * 2))),
                color: TAPIO_CATEGORIES[category].color,
                opacity: 0.8,
                line: { color: '#fff', width: 2 }
            },
            text: data.map(d => d.country),
            textposition: 'top center',
            textfont: { size: 10, color: '#e0e0e0' },
            hovertemplate: '<b>%{text}</b><br>' +
                'Driver promedio: %{x:.1f}%<br>' +
                'Material promedio: %{y:.1f}%<br>' +
                'Períodos: %{marker.size}<extra></extra>',
            customdata: data.map(d => d.count)
        };
    });

    const layout = {
        ...PLOTLY_THEME,
        title: {
            text: 'Cada círculo = 1 país (promedio del período seleccionado)',
            font: { size: 13, color: '#888' },
            x: 0.5,
            xanchor: 'center'
        },
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Tasa Promedio Driver (%/año)', font: { size: 12 } },
            zeroline: true,
            zerolinecolor: '#666',
            zerolinewidth: 2
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: 'Tasa Promedio Material (%/año)', font: { size: 12 } },
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

    // Filtrar países con datos y calcular estadísticas
    const countryStats = Object.keys(elasticitiesByCountry)
        .filter(c => elasticitiesByCountry[c].length > 0)
        .map(country => {
            const values = elasticitiesByCountry[country].sort((a, b) => a - b);
            const median = d3.median(values) || 0;
            return { country, values, median, count: values.length };
        })
        .sort((a, b) => b.median - a.median);

    if (countryStats.length === 0) {
        document.getElementById('ridgePlot').innerHTML = '<p style="text-align:center;padding:40px;color:#666;">No hay datos suficientes</p>';
        return;
    }

    // Determinar color según mediana
    const getColor = (median) => {
        if (median < -0.5) return '#e74c3c';
        if (median < 0) return '#e67e22';
        if (median < 0.5) return '#f39c12';
        if (median < 1) return '#2ecc71';
        return '#27ae60';
    };

    // Crear violin plots (ridgeline style) para cada país
    const traces = countryStats.map((stat, idx) => ({
        type: 'violin',
        x: stat.values,
        y: Array(stat.values.length).fill(stat.country),
        name: stat.country,
        orientation: 'h',
        side: 'positive',
        width: 2,
        points: 'all',
        pointpos: 0,
        jitter: 0.3,
        scalemode: 'width',
        meanline: { visible: true, color: '#fff', width: 2 },
        line: { color: getColor(stat.median), width: 2 },
        fillcolor: getColor(stat.median),
        opacity: 0.6,
        marker: {
            size: 4,
            color: getColor(stat.median),
            opacity: 0.5,
            line: { color: '#fff', width: 0.5 }
        },
        spanmode: 'hard',
        showlegend: false,
        hovertemplate: `<b>${stat.country}</b><br>` +
            `Elasticidad: %{x:.2f}<br>` +
            `Mediana: ${stat.median.toFixed(2)}<br>` +
            `N = ${stat.count}<extra></extra>`
    }));

    // Crear línea vertical en x=1 para marcar desacoplamiento
    const shapes = [
        {
            type: 'line',
            x0: 1,
            x1: 1,
            y0: -0.5,
            y1: countryStats.length - 0.5,
            line: {
                color: '#4a9eff',
                width: 2,
                dash: 'dash'
            }
        },
        {
            type: 'line',
            x0: 0,
            x1: 0,
            y0: -0.5,
            y1: countryStats.length - 0.5,
            line: {
                color: '#888',
                width: 2,
                dash: 'dot'
            }
        }
    ];

    const layout = {
        ...PLOTLY_THEME,
        title: {
            text: 'Distribución de elasticidades | Línea azul = umbral desacoplamiento (1.0)',
            font: { size: 12, color: '#888' },
            x: 0.5,
            xanchor: 'center'
        },
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Elasticidad (ΔMaterial / ΔDriver)', font: { size: 12 } },
            zeroline: true,
            zerolinecolor: '#888',
            zerolinewidth: 1,
            range: [-3, 3],
            gridcolor: '#2a2a2a',
            tickfont: { size: 11 }
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: '', font: { size: 11 } },
            automargin: true,
            categoryorder: 'array',
            categoryarray: countryStats.map(s => s.country),
            tickfont: { size: 11, color: '#b0b0b0' }
        },
        height: Math.max(600, countryStats.length * 60),
        showlegend: false,
        margin: { l: 130, r: 60, t: 80, b: 80 },
        shapes: shapes,
        annotations: [
            {
                x: 1,
                y: 1.06,
                xref: 'paper',
                yref: 'paper',
                text: '🟢 Verde = desacoplamiento  |  🟡 Amarillo = acoplamiento débil  |  🔴 Rojo = negativo',
                showarrow: false,
                font: { size: 10, color: '#888' },
                xanchor: 'right'
            },
            {
                x: 1,
                y: -0.5,
                xref: 'x',
                yref: 'paper',
                text: 'Desacoplamiento<br>relativo',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 1,
                arrowcolor: '#4a9eff',
                ax: 30,
                ay: 20,
                font: { size: 10, color: '#4a9eff' }
            }
        ]
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
