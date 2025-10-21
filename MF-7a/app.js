// MF-7a: Exploración de Datos MFA - JavaScript
// Material Flow Analysis 1970-2024

// Configuración de bloques regionales
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

// Estado global
let rawData = [];
let processedData = [];
let selectedCountries = [];

// Elementos del DOM
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

// Cargar y procesar datos CSV
async function loadData() {
    try {
        const response = await fetch('mfa_data.csv');
        const text = await response.text();

        // Parsear CSV
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');

        // Identificar columnas de años
        const yearColumns = headers.filter(h => /^\d{4}$/.test(h));

        // Procesar cada fila
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const country = values[0];
            const flowName = values[1];
            const flowCode = values[2];
            const flowUnit = values[3];

            // Extraer valores por año
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
        elements.tableBody.innerHTML = '<tr><td colspan="5" style="color:red;">Error cargando datos. Verifica que mfa_data.csv existe.</td></tr>';
    }
}

// Parser CSV mejorado (maneja comas dentro de comillas)
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

// Inicializar UI
function initializeUI() {
    // Obtener flows únicos
    const flows = [...new Set(rawData.map(d => d.flowCode))].sort();
    elements.flowSelect.innerHTML = flows.map(f =>
        `<option value="${f}"${f === 'MF' ? ' selected' : ''}>${f}</option>`
    ).join('');

    // Event listeners
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

    // Inicializar países
    updateCountries();
}

// Actualizar países según región
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

// Actualizar datos y visualizaciones
function updateData() {
    const flow = elements.flowSelect.value;
    const yearMin = parseInt(elements.yearStart.value);
    const yearMax = parseInt(elements.yearEnd.value);

    // Filtrar datos
    processedData = rawData.filter(d =>
        selectedCountries.includes(d.country) &&
        d.flowCode === flow &&
        d.year >= yearMin &&
        d.year <= yearMax
    );

    // Actualizar estadísticas
    updateStats();

    // Actualizar tabla
    updateTable();

    // Actualizar gráfico
    updateHistogram();
}

// Actualizar estadísticas
function updateStats() {
    const uniqueCountries = [...new Set(processedData.map(d => d.country))];
    const uniqueYears = [...new Set(processedData.map(d => d.year))];
    const uniqueFlows = [...new Set(rawData.map(d => d.flowCode))];

    elements.statCountries.textContent = uniqueCountries.length;
    elements.statYears.textContent = uniqueYears.length;
    elements.statRecords.textContent = processedData.length.toLocaleString();
    elements.statFlows.textContent = uniqueFlows.length;
}

// Actualizar tabla
function updateTable() {
    if (processedData.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="5" class="loading">No hay datos para los filtros seleccionados</td></tr>';
        return;
    }

    // Mostrar primeros 100 registros
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
            <tr style="background: #fff3cd;">
                <td colspan="5" style="text-align: center; font-style: italic;">
                    Mostrando primeros 100 de ${processedData.length.toLocaleString()} registros
                </td>
            </tr>
        `;
    }
}

// Actualizar histograma
function updateHistogram() {
    if (processedData.length === 0) {
        document.getElementById('histogramChart').innerHTML = '<p style="text-align:center; padding:30px; color:#6c757d;">No hay datos para mostrar</p>';
        return;
    }

    const values = processedData.map(d => d.value);

    const trace = {
        x: values,
        type: 'histogram',
        marker: {
            color: 'rgba(102, 126, 234, 0.7)',
            line: {
                color: 'rgba(102, 126, 234, 1)',
                width: 1
            }
        },
        nbinsx: 30
    };

    const layout = {
        title: {
            text: 'Distribución de Valores',
            font: { size: 18, weight: 700 }
        },
        xaxis: {
            title: processedData[0]?.flowUnit || 'Valor',
            gridcolor: '#e9ecef'
        },
        yaxis: {
            title: 'Frecuencia',
            gridcolor: '#e9ecef'
        },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: 'white',
        height: 400,
        margin: { t: 50, r: 30, b: 50, l: 60 }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };

    Plotly.newPlot('histogramChart', [trace], layout, config);
}

// Inicializar aplicación
loadData();
