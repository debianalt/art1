// MF-7a: Exploración de Datos MFA - JavaScript (Professional Edition)

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
let processedData = [];
let selectedCountries = [];

const elements = {
    regionSelect: document.getElementById('regionSelect'),
    flowSelect: document.getElementById('flowSelect'),
    yearStart: document.getElementById('yearStart'),
    yearEnd: document.getElementById('yearEnd'),
    yearStartValue: document.getElementById('yearStartValue'),
    yearEndValue: document.getElementById('yearEndValue'),
    tableBody: document.getElementById('tableBody'),
    statCountries: document.getElementById('statCountries'),
    statYears: document.getElementById('statYears'),
    statRecords: document.getElementById('statRecords'),
    statFlows: document.getElementById('statFlows')
};

// Theme configuration for Plotly
const PLOTLY_THEME = {
    plot_bgcolor: '#1a1a1a',
    paper_bgcolor: '#1a1a1a',
    font: { color: '#e0e0e0', family: 'Inter, sans-serif' },
    xaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a3a' },
    yaxis: { gridcolor: '#2a2a2a', zerolinecolor: '#3a3a2a' }
};

const PLOTLY_CONFIG = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
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
                        country,
                        flowName,
                        flowCode,
                        flowUnit,
                        year: parseInt(year),
                        value
                    });
                }
            });
        }

        rawData = data;
        initializeUI();
        updateData();
    } catch (error) {
        console.error('Error cargando datos:', error);
        elements.tableBody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;">Error cargando datos. Verifica que mfa_data.csv existe.</td></tr>';
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

    elements.regionSelect.addEventListener('change', updateCountries);
    elements.flowSelect.addEventListener('change', updateData);
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
        selectedCountries = BLOCS.UE.filter(c =>
            rawData.some(d => d.country === c)
        );
    } else if (region === 'Mercosur') {
        selectedCountries = BLOCS.Mercosur.filter(c =>
            rawData.some(d => d.country === c)
        );
    } else if (region === 'Ambos') {
        selectedCountries = [...BLOCS.UE, ...BLOCS.Mercosur].filter(c =>
            rawData.some(d => d.country === c)
        );
    }

    updateData();
}

function updateData() {
    const flow = elements.flowSelect.value;
    const yearMin = parseInt(elements.yearStart.value);
    const yearMax = parseInt(elements.yearEnd.value);

    processedData = rawData.filter(d =>
        selectedCountries.includes(d.country) &&
        d.flowCode === flow &&
        d.year >= yearMin &&
        d.year <= yearMax
    );

    updateStats();
    updateTimeSeriesChart();
    updateBoxPlot();
    updateBarChart();
    updateTable();
}

function updateStats() {
    const uniqueCountries = [...new Set(processedData.map(d => d.country))];
    const uniqueYears = [...new Set(processedData.map(d => d.year))];
    const uniqueFlows = [...new Set(rawData.map(d => d.flowCode))];

    elements.statCountries.textContent = uniqueCountries.length;
    elements.statYears.textContent = uniqueYears.length;
    elements.statRecords.textContent = processedData.length.toLocaleString();
    elements.statFlows.textContent = uniqueFlows.length;
}

function updateTimeSeriesChart() {
    if (processedData.length === 0) {
        document.getElementById('timeSeriesChart').innerHTML = '<p style="text-align:center; padding:40px; color:#666;">No hay datos</p>';
        return;
    }

    // Agregar por año (suma de todos los países)
    const byYear = {};
    processedData.forEach(d => {
        if (!byYear[d.year]) byYear[d.year] = 0;
        byYear[d.year] += d.value;
    });

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const values = years.map(y => byYear[y]);

    const trace = {
        x: years,
        y: values,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#4a9eff',
            width: 3
        },
        marker: {
            size: 6,
            color: '#4a9eff',
            line: {
                color: '#6bb3ff',
                width: 1
            }
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(74, 158, 255, 0.1)'
    };

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            title: { text: 'Año', font: { size: 12 } }
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: processedData[0]?.flowUnit || 'Valor', font: { size: 12 } }
        },
        height: 400,
        margin: { t: 20, r: 30, b: 50, l: 70 },
        hovermode: 'x unified'
    };

    Plotly.newPlot('timeSeriesChart', [trace], layout, PLOTLY_CONFIG);
}

function updateBoxPlot() {
    if (processedData.length === 0) {
        document.getElementById('boxPlotChart').innerHTML = '<p style="text-align:center; padding:40px; color:#666;">No hay datos</p>';
        return;
    }

    const countries = [...new Set(processedData.map(d => d.country))].sort();

    const traces = countries.map((country, idx) => {
        const countryData = processedData.filter(d => d.country === country);
        const values = countryData.map(d => d.value);

        return {
            y: values,
            type: 'box',
            name: country,
            marker: {
                color: `hsl(${(idx * 360 / countries.length)}, 70%, 60%)`
            },
            boxmean: 'sd'
        };
    });

    const layout = {
        ...PLOTLY_THEME,
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: processedData[0]?.flowUnit || 'Valor', font: { size: 12 } }
        },
        height: 500,
        margin: { t: 20, r: 30, b: 100, l: 70 },
        showlegend: false
    };

    Plotly.newPlot('boxPlotChart', traces, layout, PLOTLY_CONFIG);
}

function updateBarChart() {
    if (processedData.length === 0) {
        document.getElementById('barChart').innerHTML = '<p style="text-align:center; padding:40px; color:#666;">No hay datos</p>';
        return;
    }

    // Calcular promedio por país
    const byCountry = {};
    processedData.forEach(d => {
        if (!byCountry[d.country]) {
            byCountry[d.country] = { sum: 0, count: 0 };
        }
        byCountry[d.country].sum += d.value;
        byCountry[d.country].count++;
    });

    const countries = Object.keys(byCountry).map(country => ({
        country,
        avg: byCountry[country].sum / byCountry[country].count
    })).sort((a, b) => b.avg - a.avg).slice(0, 10);

    const trace = {
        x: countries.map(c => c.country),
        y: countries.map(c => c.avg),
        type: 'bar',
        marker: {
            color: countries.map((_, idx) => `hsl(${200 + idx * 10}, 70%, 60%)`),
            line: {
                color: '#2a2a2a',
                width: 1
            }
        }
    };

    const layout = {
        ...PLOTLY_THEME,
        xaxis: {
            ...PLOTLY_THEME.xaxis,
            tickangle: -45
        },
        yaxis: {
            ...PLOTLY_THEME.yaxis,
            title: { text: `Promedio ${processedData[0]?.flowUnit || ''}`, font: { size: 12 } }
        },
        height: 450,
        margin: { t: 20, r: 30, b: 120, l: 70 }
    };

    Plotly.newPlot('barChart', [trace], layout, PLOTLY_CONFIG);
}

function updateTable() {
    if (processedData.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="5" class="loading">No hay datos para los filtros seleccionados</td></tr>';
        return;
    }

    const displayData = processedData.slice(0, 100);

    elements.tableBody.innerHTML = displayData.map(d => `
        <tr>
            <td>${d.country}</td>
            <td>${d.year}</td>
            <td>${d.flowName || d.flowCode}</td>
            <td style="text-align: right; font-weight: 600;">${d.value.toLocaleString('es-ES', {maximumFractionDigits: 2})}</td>
            <td>${d.flowUnit}</td>
        </tr>
    `).join('');

    if (processedData.length > 100) {
        elements.tableBody.innerHTML += `
            <tr style="background: #1f1f1f; border-top: 2px solid #2a2a2a;">
                <td colspan="5" style="text-align: center; font-style: italic; color: #888;">
                    Mostrando primeros 100 de ${processedData.length.toLocaleString()} registros
                </td>
            </tr>
        `;
    }
}

loadData();
