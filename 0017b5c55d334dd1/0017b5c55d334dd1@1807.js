function _1(md){return(
md`# MF-7
`
)}

function _mfa_filled(__query,FileAttachment,invalidation){return(
__query(FileAttachment("mfa_filled.csv"),{from:{table:"mfa_filled"},sort:[],slice:{to:null,from:null},filter:[],select:{columns:null}},invalidation)
)}

function _longData(mfa_filled){return(
mfa_filled.flatMap((d) =>
  Object.entries(d)
    .filter(([k, v]) => /^\d{4}$/.test(k)) // columnas que son años
    .map(([year, value]) => ({
      country: d.Country,
      flow: d["Flow code"],
      flow_name: d["Flow name"],
      unit: d["Flow unit"],
      year: +year,
      value: +value
    }))
)
)}

function _blocsResolved(){return(
{
  "European Union": [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden"
  ],
  Mercosur: ["Argentina", "Brazil", "Uruguay", "Paraguay"]
}
)}

function _countriesInData(longData){return(
[...new Set(longData.map(d => d.country))].filter(Boolean).sort()
)}

function _countriesUE(blocsResolved,countriesInData){return(
blocsResolved["European Union"].filter(c => countriesInData.includes(c))
)}

function _countriesMCS(blocsResolved,countriesInData){return(
blocsResolved["Mercosur"].filter(c => countriesInData.includes(c))
)}

function _regionMode(Inputs){return(
Inputs.radio(["UE","Mercosur","Ambos","Países"], {label:"Ámbito", value:"UE"})
)}

function _countryPicker(Inputs,countriesUE,countriesMCS){return(
Inputs.select(
  [...new Set([...countriesUE, ...countriesMCS])].sort(),
  {
    label: "Países (UE o Mercosur)",
    multiple: true,
    value: countriesMCS.slice(0, 6)
  }
)
)}

function _selectedCountries(regionMode,countriesUE,countriesMCS,countryPicker)
{
  if (regionMode === "UE")       return countriesUE
  if (regionMode === "Mercosur") return countriesMCS
  if (regionMode === "Ambos")    return [...new Set([...countriesUE, ...countriesMCS])]
  return [...new Set(countryPicker ?? [])]
}


function _flowOptions(longData){return(
[...new Set(longData.map(d => d.flow).filter(Boolean))].sort()
)}

function _defaultFlow(flowOptions){return(
flowOptions.includes("MF") ? "MF" : (flowOptions.includes("MF/cap") ? "MF/cap" : flowOptions[0])
)}

function _flow(Inputs,flowOptions,defaultFlow){return(
Inputs.select(flowOptions, {label:"Indicador (flow)", value: defaultFlow})
)}

function _unitOfFlow(longData,flow)
{
  const u = [...new Set(longData.filter(d=>d.flow===flow).map(d=>d.unit).filter(Boolean))]
  return u.length === 1 ? u[0] : (u.length>1 ? "multiple units" : "")
}


function _yearsAll(longData){return(
[...new Set(longData.map(d=>d.year))].sort((a,b)=>a-b)
)}

function _yearStart(Inputs,yearsAll){return(
Inputs.range([yearsAll[0], yearsAll.at(-1)-1], {label:"Año inicio", value: yearsAll[0], step:1})
)}

function _yearEnd(Inputs,yearStart,yearsAll){return(
Inputs.range([() => yearStart+1, yearsAll.at(-1)], {label:"Año fin", value: yearsAll.at(-1), step:1})
)}

function _normalizeMode(Inputs){return(
Inputs.select(["index (base=100)", "z-score", "min-max", "none"], {label:"Normalización", value:"index (base=100)"})
)}

function _smoothWin(Inputs){return(
Inputs.range([0,5], {label:"Suavizado (ventana móvil, años)", value:1, step:1})
)}

function _maxPanels(Inputs){return(
Inputs.range([1, 40], {label:"Cantidad de paneles a mostrar", value: 12, step:1})
)}

function _seriesPerCountry(yearStart,yearEnd,longData,flow,selectedCountries,smoothWin,normalizeMode,sortMode)
{
  // filtra por años y flow
  const span = (d) => d.year>=yearStart && d.year<=yearEnd
  const subset = longData.filter(d => d.flow===flow && span(d))

  // agrupa por país
  const byC = new Map()
  for (const d of subset) {
    if (!selectedCountries.includes(d.country)) continue
    if (!byC.has(d.country)) byC.set(d.country, [])
    byC.get(d.country).push({year:d.year, v:d.value})
  }

  // suavizado simple (media móvil simétrica)
  const movavg = (rows, k) => {
    if (!k || k<1) return rows.map(d=>d.v)
    const win = Math.max(1, Math.floor(k))
    const vals = rows.map(d=>d.v)
    return vals.map((_, i) => {
      const a = Math.max(0, i-win), b = Math.min(vals.length-1, i+win)
      let s=0, n=0; for (let j=a;j<=b;j++){ s+=vals[j]; n++ }
      return s/n
    })
  }

  // normalizaciones
  const idx100 = vals => {
    const base = vals.find(v => Number.isFinite(v))
    return Number.isFinite(base) ? vals.map(v => 100*(v/base)) : vals.map(()=>NaN)
  }
  const zscore = vals => {
    const f = vals.filter(Number.isFinite)
    const m = f.reduce((a,b)=>a+b,0)/(f.length||1)
    const sd = Math.sqrt(f.reduce((a,b)=>a+(b-m)*(b-m),0)/(f.length||1)) || 1
    return vals.map(v => (v-m)/sd)
  }
  const minmax = vals => {
    const f = vals.filter(Number.isFinite)
    const mi = Math.min(...f), ma = Math.max(...f), den = (ma-mi)||1
    return vals.map(v => (v-mi)/den)
  }

  const out = []
  for (const [country, rows] of byC) {
    rows.sort((a,b)=>a.year-b.year)
    let vals = movavg(rows, smoothWin)
    if (normalizeMode==="index (base=100)") vals = idx100(vals)
    else if (normalizeMode==="z-score")     vals = zscore(vals)
    else if (normalizeMode==="min-max")     vals = minmax(vals)

    out.push({ country, years: rows.map(r=>r.year), vals })
  }

  // orden de países para apilar paneles
  const score = s => {
    const f = s.vals.filter(Number.isFinite)
    if (!f.length) return -Infinity
    if (sortMode==="máximo") return Math.max(...f)
    if (sortMode==="último") return f.at(-1)
    if (sortMode==="media")  return f.reduce((a,b)=>a+b,0)/f.length
    return s.country.toLowerCase().charCodeAt(0)
  }
  if (sortMode==="alfabético") out.sort((a,b)=>a.country.localeCompare(b.country))
  else out.sort((a,b)=>score(b)-score(a))

  return out
}


function _seriesForRidge(yearStart,yearEnd,selectedCountries,longData,flow,smoothWin)
{
  const span = (d) => d.year>=yearStart && d.year<=yearEnd
  const byC = new Map(selectedCountries.map(c => [c, []]))
  for (const d of longData) {
    if (d.flow!==flow) continue
    if (!byC.has(d.country)) continue
    if (!span(d)) continue
    byC.get(d.country).push({year:d.year, v: d.value})
  }
  function movingAvg(rows, k){
    if (!k || k<1) return rows.map(d=>d.v)
    const win = Math.max(1, Math.floor(k))
    const vals = rows.map(d=>d.v)
    const out = []
    for (let i=0;i<vals.length;i++){
      const a = Math.max(0, i-win), b = Math.min(vals.length-1, i+win)
      let sum=0, n=0; for(let j=a;j<=b;j++){sum+=vals[j]; n++}
      out.push(sum/n)
    }
    return out
  }
  const out = []
  for (const [country, rows] of byC){
    rows.sort((a,b)=>a.year-b.year)
    out.push({country, years: rows.map(r=>r.year), vals: movingAvg(rows, smoothWin)})
  }
  return out
}


function _Plotly(require){return(
require("https://cdn.plot.ly/plotly-2.27.0.min.js")
)}

function _normalizeSeries(normalizeMode,seriesForRidge)
{
  const mode = (typeof normalizeMode === "undefined") ? "none" : normalizeMode;

  const idx100 = (vals) => {
    const base = vals.find(v => Number.isFinite(v));
    return Number.isFinite(base) ? vals.map(v => 100*(v/base)) : vals.map(() => NaN);
  };
  const zscore = (vals) => {
    const f = vals.filter(Number.isFinite);
    const m = f.reduce((a,b)=>a+b,0)/(f.length||1);
    const sd = Math.sqrt(f.reduce((a,b)=>a+(b-m)*(b-m),0)/(f.length||1)) || 1;
    return vals.map(v => (v - m) / sd);
  };
  const minmax = (vals) => {
    const f = vals.filter(Number.isFinite);
    const mi = Math.min(...f), ma = Math.max(...f), den = (ma-mi)||1;
    return vals.map(v => (v - mi) / den);
  };

  return seriesForRidge.map(s => {
    let n = s.vals.slice();
    if (mode === "index (base=100)") n = idx100(n);
    else if (mode === "z-score")     n = zscore(n);
    else if (mode === "min-max")     n = minmax(n);
    // "none" => sin cambios
    return {...s, vals: n};
  });
}


function _sortMode(Inputs){return(
Inputs.select(
  ["alfabético","máximo","último","media"],
  { label: "Orden de países", value: "máximo" }
)
)}

function _rankedSeries(normalizeSeries,seriesForRidge,normalizeMode,sortMode)
{
  // Normalizaciones de respaldo (por si no existe 'normalizeSeries')
  const idx100 = (vals) => {
    const base = vals.find(v => Number.isFinite(v));
    return Number.isFinite(base) ? vals.map(v => 100*(v/base)) : vals.map(() => NaN);
  };
  const zscore = (vals) => {
    const f = vals.filter(Number.isFinite);
    const m = f.reduce((a,b)=>a+b,0)/(f.length||1);
    const sd = Math.sqrt(f.reduce((a,b)=>a+(b-m)*(b-m),0)/(f.length||1)) || 1;
    return vals.map(v => (v - m) / sd);
  };
  const minmax = (vals) => {
    const f = vals.filter(Number.isFinite);
    const mi = Math.min(...f), ma = Math.max(...f), den = (ma-mi)||1;
    return vals.map(v => (v - mi) / den);
  };

  // Usa 'normalizeSeries' si ya existe; si no, normaliza aquí
  const list = (typeof normalizeSeries !== "undefined" && normalizeSeries)
    ? normalizeSeries.map(s => ({...s}))
    : seriesForRidge.map(s => {
        let vals = s.vals.slice();
        if (normalizeMode === "index (base=100)") vals = idx100(vals);
        else if (normalizeMode === "z-score")      vals = zscore(vals);
        else if (normalizeMode === "min-max")      vals = minmax(vals);
        // "none" => sin cambios
        return {...s, vals};
      });

  // Orden según 'sortMode' (con fallback seguro)
  const mode = (typeof sortMode !== "undefined" && sortMode) ? sortMode : "máximo";
  const score = (s) => {
    const f = s.vals.filter(Number.isFinite);
    if (!f.length) return -Infinity;
    if (mode === "máximo") return Math.max(...f);
    if (mode === "último") return f.at(-1);
    if (mode === "media")  return f.reduce((a,b)=>a+b,0)/f.length;
    return 0; // para alfabético
  };

  if (mode === "alfabético") list.sort((a,b)=>a.country.localeCompare(b.country));
  else list.sort((a,b)=>score(b)-score(a));

  return list;
}


function _fullBleedStyle(html){return(
html`<style>
  .fullbleed {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    box-sizing: border-box;
    padding: 8px 16px;
  }
  .fullbleed .chart {
    width: 100%;
    height: var(--panel-height, 200px);
    margin: 0 0 12px 0;
  }
</style>`
)}

async function _stackedCountryCharts(html,rankedSeries,normalizeMode,unitOfFlow,Plotly,ResizeObserver,invalidation)
{
  // Contenedor full-bleed reutilizable
  const container =
    this ?? html`<div class="fullbleed" style="--panel-height: 220px;"></div>`;
  container.replaceChildren();

  const charts = [];
  const list = rankedSeries;
  if (!list.length) {
    container.append(html`<div style="padding:12px;color:#900;">
      No hay países con datos para el período/flow seleccionado.
    </div>`);
    return container;
  }

  const HEIGHT = 220;
  const config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };

  // Ticks de años legibles
  function niceYearTicks(years) {
    const uniq = [...new Set(years)].sort((a, b) => a - b);
    const n = uniq.length;
    if (n <= 10) return uniq;
    const step = Math.ceil(n / 10);
    const ticks = [];
    for (let i = 0; i < n; i += step) ticks.push(uniq[i]);
    if (ticks.at(-1) !== uniq.at(-1)) ticks.push(uniq.at(-1));
    return ticks;
  }

  // === Escala Y compartida ===
  function globalYRange(seriesList) {
    let mi = +Infinity,
      ma = -Infinity;
    for (const s of seriesList) {
      for (const v of s.vals)
        if (Number.isFinite(v)) {
          if (v < mi) mi = v;
          if (v > ma) ma = v;
        }
    }
    if (!Number.isFinite(mi) || !Number.isFinite(ma)) return null;
    // margen pequeño para que no “toque” el borde
    const pad = (ma - mi) * 0.05 || 1;
    return [mi - pad, ma + pad];
  }
  function zScoreSymRange(seriesList) {
    let M = 0;
    for (const s of seriesList) {
      for (const v of s.vals)
        if (Number.isFinite(v)) M = Math.max(M, Math.abs(v));
    }
    // redondeo agradable
    M = Math.max(1, Math.ceil(M * 10) / 10);
    return [-M, M];
  }

  const sharedRange =
    normalizeMode === "z-score" ? zScoreSymRange(list) : globalYRange(list);

  const ySuffix =
    normalizeMode === "none"
      ? unitOfFlow
        ? ` (${unitOfFlow})`
        : ""
      : ` — ${normalizeMode}`;

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const el = document.createElement("div");
    el.className = "chart";
    el.style.setProperty("--panel-height", HEIGHT + "px");
    container.append(el);

    const ticks = niceYearTicks(s.years);

    const trace = {
      x: s.years,
      y: s.vals,
      mode: "lines",
      line: { width: 2 },
      fill: "tozeroy",
      name: s.country,
      hovertemplate:
        `<b>${s.country}</b><br>` +
        `Año: %{x}<br>` +
        (normalizeMode === "none"
          ? `Valor: %{y:.2f}${
              unitOfFlow ? " " + unitOfFlow : ""
            }<extra></extra>`
          : normalizeMode === "z-score"
          ? `z: %{y:.2f}<extra></extra>`
          : `Valor normalizado: %{y:.2f}<extra></extra>`)
    };

    const layout = {
      template: "plotly_white",
      title: { text: s.country, font: { size: 14 }, y: 0.96 },
      hovermode: "x unified",
      xaxis: {
        title: "",
        showgrid: true,
        gridcolor: "#eee",
        zeroline: false,
        tickmode: "array",
        tickvals: ticks,
        ticktext: ticks.map(String),
        tickangle: -90,
        automargin: true
      },
      yaxis: {
        title: i === 0 ? `Valor${ySuffix}` : "",
        showgrid: true,
        gridcolor: "#f4f4f4",
        zeroline: false,
        automargin: true,
        autorange: false,
        range: sharedRange // <<< aquí la escala compartida
      },
      margin: { t: 28, r: 16, b: 42, l: 56 },
      height: HEIGHT,
      showlegend: false
    };

    // Línea de referencia en 0 cuando z-score
    if (normalizeMode === "z-score") {
      layout.shapes = [
        {
          type: "line",
          xref: "paper",
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          line: { color: "#999", width: 1, dash: "dot" }
        }
      ];
    }

    await Plotly.newPlot(el, [trace], layout, config);
    charts.push(el);
  }

  // Redimensiona los charts cuando cambia el ancho del contenedor
  const ro = new ResizeObserver(() => {
    for (const el of charts) {
      try {
        Plotly.Plots.resize(el);
      } catch {}
    }
  });
  ro.observe(container);

  // Limpieza al invalidar
  invalidation.then(() => {
    ro.disconnect();
    for (const el of charts) {
      try {
        Plotly.purge(el);
      } catch {}
    }
  });

  return container;
}


function _driverOptions(longData)
{
  const flows = [
    ...new Set(longData.map((d) => d.flow).filter(Boolean))
  ].sort();
  const exactGDP = flows.includes("GDP") ? ["GDP"] : [];
  const likeGDP = flows.filter((f) => f.toUpperCase().includes("GDP"));
  const uniq = [...new Set([...exactGDP, ...likeGDP])];
  return uniq.length ? uniq : flows; // si no hay GDP, permite elegir cualquier flow
}


function _driverFlow(Inputs,driverOptions){return(
Inputs.select(driverOptions, { label: "Driver (Tapio)", value: (driverOptions.includes("GDP") ? "GDP" : driverOptions[0]) })
)}

function _tapioTol(Inputs){return(
Inputs.range([0, 0.5], { label: "Tolerancia coupling (±)", value: 0.2, step: 0.01 })
)}

function _tapioPalette(){return(
{
  SD:  "#2ca02c",   // Strong decoupling      (gY>0, gI<0)
  WD:  "#98df8a",   // Weak decoupling        (gY>0, gI>0, e<1-tol)
  EC:  "#c7c7c7",   // Expansive coupling     (gY>0, gI>0, |e-1|<=tol)
  END: "#ff7f0e",   // Expansive neg. decoup. (gY>0, gI>0, e>1+tol)
  RD:  "#17becf",   // Recessive decoupling   (gY<0, gI<0, e<1-tol)
  RC:  "#7f7f7f",   // Recessive coupling     (gY<0, gI<0, |e-1|<=tol)
  RND: "#9467bd",   // Recessive neg. decoup. (gY<0, gI<0, e>1+tol)
  SND: "#d62728"    // Strong neg. decoupling (gY<0, gI>0)
}
)}

function _tapioStateName(){return(
{
  SD:  "Strong decoupling",
  WD:  "Weak decoupling",
  EC:  "Expansive coupling",
  END: "Expansive negative decoupling",
  RD:  "Recessive decoupling",
  RC:  "Recessive coupling",
  RND: "Recessive negative decoupling",
  SND: "Strong negative decoupling",
  NA:  "Sin clasificación"
}
)}

function _tapioClassify(){return(
(gI, gY, tol) => {
  if (!Number.isFinite(gI) || !Number.isFinite(gY)) return "NA"
  if (gY === 0) {
    if (gI === 0) return "RC" // ambos 0 ≈ coupling recesivo por conveniencia
    // si gY==0 y gI>0/<0 no hay e definido; tratamos por signos
    return (gI > 0) ? "END" : "RD"
  }
  const e = gI / gY
  if (gY > 0) {
    if (gI < 0) return "SD"
    if (e < 1 - tol) return "WD"
    if (Math.abs(e - 1) <= tol) return "EC"
    return "END"
  } else { // gY < 0
    if (gI > 0) return "SND"
    // gI < 0
    if (e < 1 - tol) return "RD"
    if (Math.abs(e - 1) <= tol) return "RC"
    return "RND"
  }
}
)}

function _tapioByCountry(tapioTol,yearStart,yearEnd,selectedCountries,longData,flow,driverFlow,tapioClassify,tapioPalette)
{
  const tol = +tapioTol;
  const span = (y) => y >= yearStart && y <= yearEnd;

  // Índices por país y año para impacto (flow) y driver
  const byC_I = new Map(),
    byC_Y = new Map();
  for (const c of selectedCountries) {
    byC_I.set(c, new Map());
    byC_Y.set(c, new Map());
  }
  for (const d of longData) {
    if (!byC_I.has(d.country)) continue;
    if (!span(d.year)) continue;
    if (d.flow === flow) byC_I.get(d.country).set(d.year, d.value);
    if (d.flow === driverFlow) byC_Y.get(d.country).set(d.year, d.value);
  }

  const out = new Map();
  for (const c of selectedCountries) {
    const seriesI = byC_I.get(c),
      seriesY = byC_Y.get(c);
    if (!seriesI || !seriesY) {
      out.set(c, []);
      continue;
    }

    const years = [...new Set([...seriesI.keys(), ...seriesY.keys()])].sort(
      (a, b) => a - b
    );
    const rows = [];
    for (let i = 1; i < years.length; i++) {
      const t = years[i],
        t1 = years[i - 1];
      if (!span(t) || !span(t1)) continue;
      const I1 = seriesI.get(t1),
        I = seriesI.get(t);
      const Y1 = seriesY.get(t1),
        Y = seriesY.get(t);
      if (
        !Number.isFinite(I1) ||
        !Number.isFinite(I) ||
        !Number.isFinite(Y1) ||
        !Number.isFinite(Y)
      )
        continue;
      if (I1 === 0 || Y1 === 0) continue;

      const gI = (I - I1) / I1;
      const gY = (Y - Y1) / Y1;
      const state = tapioClassify(gI, gY, tol);
      const DE =
        gY !== 0 && Number.isFinite(gI) && Number.isFinite(gY) ? gI / gY : NaN;

      rows.push({
        year: t,
        state,
        color: tapioPalette[state] || "#ccc",
        DE,
        gI,
        gY
      });
    }
    out.set(c, rows);
  }
  return out; // Map(country -> [{year,state,color,DE,gI,gY}])
}


function _tapioCatalog(){return(
{
  labels: new Map([
    ["SD", "Strong decoupling (−MF, +GDP)"],
    ["WD", "Weak decoupling (+MF, +GDP, DE<1)"],
    ["EC", "Expansive coupling (+MF, +GDP, ≈1)"],
    ["END", "Expansive negative decoupling (+MF >> +GDP)"],
    ["RD", "Recessive decoupling (−MF << −GDP, DE<1)"],
    ["RC", "Recessive coupling (−MF ≈ −GDP)"],
    ["RND", "Recessive negative decoupling (−MF >> −GDP)"],
    ["SND", "Strong negative decoupling (+MF, −GDP)"]
  ]),
  // ΔMF < 0 o condiciones favorables al ambiente; y ΔGDP > 0 para desarrollo
  groups: new Map([
    ["+ environment", ["SD", "RD", "RC", "RND"]],
    ["+ development", ["SD", "WD", "EC", "END"]]
  ]),
  // Paleta consistente (alineada con tu 'tapioPalette' existente para RND/SND)
  colors: new Map([
    ["SD", "#2E7D32"],
    ["WD", "#66BB6A"],
    ["EC", "#9E9E9E"],
    ["END", "#D32F2F"],
    ["RD", "#1565C0"],
    ["RC", "#42A5F5"],
    ["RND", "#9467bd"],
    ["SND", "#6D4C41"]
  ])
}
)}

function _tapioSelector(tapioCatalog,Inputs)
{
  const opts = [
    "+ environment",
    "+ development",
    "SD",
    "WD",
    "EC",
    "END",
    "RD",
    "RC",
    "RND",
    "SND"
  ];
  const fmt = (v) =>
    tapioCatalog.groups.has(v)
      ? v
      : `${v} — ${tapioCatalog.labels.get(v) || v}`;
  return Inputs.checkbox(opts, {
    label: "Tapio — estados y atajos por grupo",
    value: opts.slice(), // todo seleccionado por defecto
    format: fmt
  });
}


function _selectedTapioStates(tapioSelector,tapioCatalog)
{
  const sel = new Set(tapioSelector);
  const out = new Set([...sel].filter((v) => !v.startsWith("+")));
  if (sel.has("+ environment"))
    for (const s of tapioCatalog.groups.get("+ environment")) out.add(s);
  if (sel.has("+ development"))
    for (const s of tapioCatalog.groups.get("+ development")) out.add(s);
  return [...out];
}


function _tapioColor(tapioCatalog){return(
(state) => tapioCatalog.colors.get(state) ?? "#555"
)}

function _tapioHover(){return(
(d) => {
  // d.year, d.country (o d.bloc), d.state (SD/WD/...), d.DE (elasticidad)
  // Campos opcionales: d.mf_pct, d.gdp_pct (variaciones % año-a-año si las tienes)
  const line1 = `<b>${d.country ?? d.bloc ?? ""}</b> — ${d.year}`;
  const line2 = `${d.state} · DE: <b>${(d.DE ?? d.de ?? d.tapio ?? 0).toFixed(
    2
  )}</b>`;
  const mf = d.mf_pct ?? d.mf_change ?? d.mf ?? null;
  const gdp = d.gdp_pct ?? d.gdp_change ?? d.gdp ?? null;
  const extra =
    mf != null || gdp != null
      ? `<br>ΔMF: ${mf != null ? `${(+mf).toFixed(2)}%` : "—"} · ΔGDP: ${
          gdp != null ? `${(+gdp).toFixed(2)}%` : "—"
        }`
      : "";
  return `${line1}<br>${line2}${extra}<extra></extra>`;
}
)}

async function _stackedCountryChartsTapio(html,rankedSeries,normalizeMode,unitOfFlow,tapioByCountry,selectedTapioStates,Plotly,ResizeObserver,invalidation)
{
  const container =
    this ?? html`<div class="fullbleed" style="--panel-height: 220px;"></div>`;
  container.replaceChildren();

  const charts = [];
  const list = rankedSeries;
  if (!list.length) {
    container.append(
      html`<div style="padding:12px;color:#900;">No hay países con datos visibles.</div>`
    );
    return container;
  }

  const HEIGHT = 220;
  const config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };

  const niceYearTicks = (years) => {
    const uniq = [...new Set(years)].sort((a, b) => a - b);
    if (uniq.length <= 10) return uniq;
    const step = Math.ceil(uniq.length / 10);
    const ticks = [];
    for (let i = 0; i < uniq.length; i += step) ticks.push(uniq[i]);
    if (ticks.at(-1) !== uniq.at(-1)) ticks.push(uniq.at(-1));
    return ticks;
  };

  const globalYRange = (seriesList) => {
    let mi = +Infinity,
      ma = -Infinity;
    for (const s of seriesList)
      for (const v of s.vals)
        if (Number.isFinite(v)) {
          mi = Math.min(mi, v);
          ma = Math.max(ma, v);
        }
    if (!Number.isFinite(mi) || !Number.isFinite(ma)) return null;
    const pad = (ma - mi) * 0.05 || 1;
    return [mi - pad, ma + pad];
  };

  const zScoreSymRange = (seriesList) => {
    let M = 0;
    for (const s of seriesList)
      for (const v of s.vals)
        if (Number.isFinite(v)) M = Math.max(M, Math.abs(v));
    M = Math.max(1, Math.ceil(M * 10) / 10);
    return [-M, M];
  };

  const sharedRange =
    normalizeMode === "z-score" ? zScoreSymRange(list) : globalYRange(list);

  const ySuffix =
    normalizeMode === "none"
      ? unitOfFlow
        ? ` (${unitOfFlow})`
        : ""
      : ` — ${normalizeMode}`;

  const yAtYear = (s, y) => {
    let k = s.years.indexOf(y);
    if (k >= 0 && Number.isFinite(s.vals[k])) return s.vals[k];
    // buscar año más cercano si no hay match exacto
    let best = -1,
      bestDiff = Infinity;
    for (let i = 0; i < s.years.length; i++) {
      const diff = Math.abs(s.years[i] - y);
      if (diff < bestDiff && Number.isFinite(s.vals[i])) {
        best = i;
        bestDiff = diff;
      }
    }
    return best >= 0 ? s.vals[best] : sharedRange ? sharedRange[0] : 0;
  };
  // Agregar esto antes del loop for (let i = 0; i < list.length; i++)
  console.log("Debug - Tapio years available:");
  for (const [country, states] of tapioByCountry) {
    const years = states.map((s) => s.year).sort();
    console.log(`${country}: ${years[0]} to ${years[years.length - 1]}`);
  }
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const el = document.createElement("div");
    el.className = "chart";
    el.style.setProperty("--panel-height", HEIGHT + "px");
    container.append(el);

    const ticks = niceYearTicks(s.years);

    // --- Estados filtrados por selector ---
    const allStates = tapioByCountry.get(s.country) || [];
    const filterSet = new Set(selectedTapioStates ?? []);
    const states = filterSet.size
      ? allStates.filter((r) => filterSet.has(r.state))
      : allStates;

    // --- Fondo coloreado por estado (solo los seleccionados) ---
    const shapes = [];
    for (const row of states) {
      const x0 = row.year - 0.5,
        x1 = row.year + 0.5;
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "y",
        x0,
        x1,
        y0: sharedRange
          ? sharedRange[0]
          : Math.min(...s.vals.filter(Number.isFinite)),
        y1: sharedRange
          ? sharedRange[1]
          : Math.max(...s.vals.filter(Number.isFinite)),
        fillcolor: (row.color || "#ccc") + "CC",
        line: { width: 0 },
        layer: "below"
      });
    }

    // --- Texto de hover para incluir Tapio (DE) sin usar marcadores ---
    const statesByYear = new Map(states.map((r) => [r.year, r]));
    const hoverText = s.years.map((yr, idx) => {
      const r = statesByYear.get(yr);
      if (!r) {
        // sin estado seleccionado en ese año: no añadimos línea de Tapio
        return "";
      }
      const de = Number.isFinite(r.DE) ? r.DE.toFixed(2) : "—";
      const gI = Number.isFinite(r.gI) ? (r.gI * 100).toFixed(2) + "%" : "—";
      const gY = Number.isFinite(r.gY) ? (r.gY * 100).toFixed(2) + "%" : "—";
      return `<br>${r.state} · DE: <b>${de}</b><br>ΔMF: ${gI} · ΔGDP: ${gY}`;
    });

    // --- Serie principal del país (solo líneas, SIN puntos) ---
    const seriesBaseHover =
      normalizeMode === "none"
        ? `Valor: %{y:.2f}${unitOfFlow ? " " + unitOfFlow : ""}`
        : normalizeMode === "z-score"
        ? `z: %{y:.2f}`
        : `Valor normalizado: %{y:.2f}`;

    const traceSeries = {
      x: s.years,
      y: s.vals,
      mode: "lines", // <- solo líneas (sin markers)
      line: { width: 2, color: "#111" },
      fill: "tozeroy",
      fillcolor: "rgba(0,0,0,0.06)",
      name: s.country,
      text: hoverText, // <- añadimos el bloque Tapio por año
      hovertemplate:
        `<b>${s.country}</b><br>` +
        `Año: %{x}<br>` +
        `${seriesBaseHover}` +
        `%{text}<extra></extra>` // <- inserta Tapio si existe
    };

    const layout = {
      template: "plotly_white",
      title: { text: s.country, font: { size: 14 }, y: 0.96 },
      hovermode: "x unified",
      xaxis: {
        title: "",
        showgrid: true,
        gridcolor: "#eee",
        zeroline: false,
        tickmode: "array",
        tickvals: ticks,
        ticktext: ticks.map(String),
        tickangle: -90,
        automargin: true
      },
      yaxis: {
        title: i === 0 ? `Valor${ySuffix}` : "",
        showgrid: true,
        gridcolor: "#f4f4f4",
        zeroline: false,
        automargin: true,
        autorange: false,
        range: sharedRange
      },
      margin: { t: 28, r: 16, b: 42, l: 56 },
      height: HEIGHT,
      showlegend: false,
      shapes
    };

    // Línea 0 cuando z-score
    if (normalizeMode === "z-score") {
      (layout.shapes ??= []).push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        y0: 0,
        y1: 0,
        line: { color: "#666", width: 1, dash: "dot" }
      });
    }

    // <- Plot sólo con la serie (sin el trace de marcadores)
    await Plotly.newPlot(el, [traceSeries], layout, config);
    charts.push(el);
  }

  const ro = new ResizeObserver(() => {
    for (const el of charts) {
      try {
        Plotly.Plots.resize(el);
      } catch {}
    }
  });
  ro.observe(container);
  invalidation.then(() => {
    ro.disconnect();
    for (const el of charts) {
      try {
        Plotly.purge(el);
      } catch {}
    }
  });
  return container;
}


function _extMode(Inputs){return(
Inputs.radio(["MF − DMC", "MF/cap − DMC/cap"], {
  label: "Externalización (definición)",
  value: "MF − DMC"
})
)}

function _43(extMode){return(
extMode
)}

function _unitFor(longData){return(
(flowName) => {
  const u = [
    ...new Set(
      longData
        .filter((d) => d.flow === flowName)
        .map((d) => d.unit)
        .filter(Boolean)
    )
  ];
  return u.length ? u[0] : "";
}
)}

function _flowMap(longData){return(
(flowName) => {
  const byC = new Map();
  for (const d of longData) {
    if (d.flow !== flowName) continue;
    if (!byC.has(d.country)) byC.set(d.country, new Map());
    byC.get(d.country).set(d.year, d.value);
  }
  return byC;
}
)}

function _seriesExternalization(extMode,flowMap,yearStart,yearEnd,selectedCountries,smoothWin)
{
  const useCap = (extMode ?? "MF − DMC").includes("/cap");
  const MFflow = useCap ? "MF/cap" : "MF";
  const DMCflow = useCap ? "DMC/cap" : "DMC";

  const mMF = flowMap(MFflow);
  const mDMC = flowMap(DMCflow);

  const span = (y) => y >= yearStart && y <= yearEnd;

  const movavg = (vals, win) => {
    if (!win || win < 1) return vals;
    const W = Math.max(1, Math.floor(win));
    const out = [];
    for (let i = 0; i < vals.length; i++) {
      const a = Math.max(0, i - W),
        b = Math.min(vals.length - 1, i + W);
      let s = 0,
        n = 0;
      for (let j = a; j <= b; j++) {
        s += vals[j];
        n++;
      }
      out.push(s / n);
    }
    return out;
  };

  const out = [];
  for (const c of selectedCountries) {
    const mmf = mMF.get(c) ?? new Map();
    const mdmc = mDMC.get(c) ?? new Map();
    const years = [...new Set([...mmf.keys(), ...mdmc.keys()])]
      .filter(span)
      .sort((a, b) => a - b);

    if (!years.length) {
      out.push({ country: c, years: [], vals: [], raw: [] });
      continue;
    }

    const raw = years.map((y) => {
      const a = mmf.get(y);
      const b = mdmc.get(y);
      return Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
    });

    const vals = movavg(raw, smoothWin);
    out.push({ country: c, years, vals, raw });
  }
  return out;
}


function _rankedExternalization(seriesExternalization,sortMode,maxPanels)
{
  const list = seriesExternalization.map((s) => ({ ...s }));
  const score = (s) => {
    const f = s.vals.filter(Number.isFinite);
    if (!f.length) return -Infinity;
    if (sortMode === "máximo") return Math.max(...f);
    if (sortMode === "último") return f.at(-1);
    if (sortMode === "media") return f.reduce((a, b) => a + b, 0) / f.length;
    return 0; // alfabético
  };
  if (sortMode === "alfabético")
    list.sort((a, b) => a.country.localeCompare(b.country));
  else list.sort((a, b) => score(b) - score(a));
  // límite opcional por rendimiento
  return list.slice(0, maxPanels ?? list.length);
}


function _unitExternalization(extMode,unitFor)
{
  const useCap = (extMode ?? "MF − DMC").includes("/cap");
  return unitFor(useCap ? "MF/cap" : "MF") || "";
}


function _tapioByCountryForImpact(tapioTol,extMode,selectedCountries,longData,yearStart,yearEnd,driverFlow,tapioClassify,tapioPalette)
{
  // Reutiliza tu clasificador y paletas
  const tol = +tapioTol;
  const useCap = (extMode ?? "MF − DMC").includes("/cap");
  const impactFlow = useCap ? "MF/cap" : "MF";

  // Índices por país para impacto y driver
  const byC_I = new Map(),
    byC_Y = new Map();
  for (const c of selectedCountries) {
    byC_I.set(c, new Map());
    byC_Y.set(c, new Map());
  }

  for (const d of longData) {
    if (!byC_I.has(d.country)) continue;
    if (d.year < yearStart || d.year > yearEnd) continue;
    if (d.flow === impactFlow) byC_I.get(d.country).set(d.year, d.value);
    if (d.flow === driverFlow) byC_Y.get(d.country).set(d.year, d.value);
  }

  const out = new Map();
  for (const c of selectedCountries) {
    const I = byC_I.get(c),
      Y = byC_Y.get(c);
    if (!I || !Y) {
      out.set(c, []);
      continue;
    }
    const years = [...new Set([...I.keys(), ...Y.keys()])].sort(
      (a, b) => a - b
    );
    const rows = [];
    for (let i = 1; i < years.length; i++) {
      const t = years[i],
        t1 = years[i - 1];
      if (t1 < yearStart || t > yearEnd) continue;
      const I1 = I.get(t1),
        Iv = I.get(t),
        Y1 = Y.get(t1),
        Yv = Y.get(t);
      if (![I1, Iv, Y1, Yv].every(Number.isFinite)) continue;
      if (I1 === 0 || Y1 === 0) continue;
      const gI = (Iv - I1) / I1;
      const gY = (Yv - Y1) / Y1;
      const state = tapioClassify(gI, gY, tol);
      const DE =
        gY !== 0 && Number.isFinite(gI) && Number.isFinite(gY) ? gI / gY : NaN;
      rows.push({
        year: t,
        state,
        color: tapioPalette[state] || "#ccc",
        DE,
        gI,
        gY
      });
    }
    out.set(c, rows);
  }
  return out; // Map(country -> rows)
}


async function _ridgeExternalizationTapio(d3,html,rankedExternalization,normalizeMode,unitExternalization,selectedTapioStates,sortMode,tapioByCountryForImpact,Plotly,ResizeObserver,invalidation)
{
  // ---- helpers (idénticos al gráfico 2) ----
  const niceYearTicks = (years) => {
    const uniq = [...new Set(years)]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (!uniq.length) return [];
    if (uniq.length <= 10) return uniq;
    const step = Math.ceil(uniq.length / 10);
    const ticks = [];
    for (let i = 0; i < uniq.length; i += step) ticks.push(uniq[i]);
    if (ticks.at(-1) !== uniq.at(-1)) ticks.push(uniq.at(-1));
    return ticks;
  };

  const globalYRange = (seriesList) => {
    let mi = +Infinity,
      ma = -Infinity;
    for (const s of seriesList)
      for (const v of s.vals)
        if (Number.isFinite(v)) {
          mi = Math.min(mi, v);
          ma = Math.max(ma, v);
        }
    if (!Number.isFinite(mi) || !Number.isFinite(ma)) return null;
    const pad = (ma - mi) * 0.05 || 1;
    return [mi - pad, ma + pad];
  };

  const zScoreSymRange = (seriesList) => {
    let M = 0;
    for (const s of seriesList)
      for (const v of s.vals)
        if (Number.isFinite(v)) M = Math.max(M, Math.abs(v));
    M = Math.max(1, Math.ceil(M * 10) / 10);
    return [-M, M];
  };

  const normalizeOne = (vals, mode) => {
    const f = vals.map((v) => (Number.isFinite(v) ? v : NaN));
    const finite = f.filter(Number.isFinite);
    if (!finite.length) return f.map(() => NaN);

    if (mode === "none") return f;

    if (mode === "index (base=100)") {
      const bIdx = f.findIndex(Number.isFinite);
      const base = f[bIdx];
      return f.map((v) =>
        Number.isFinite(v) && Number.isFinite(base) && base !== 0
          ? (v / base) * 100
          : NaN
      );
    }

    if (mode === "z-score") {
      const mean = d3.mean(finite);
      const sd = d3.deviation(finite) || 1;
      return f.map((v) => (Number.isFinite(v) ? (v - mean) / sd : NaN));
    }

    const mi = Math.min(...finite),
      ma = Math.max(...finite);
    const den = ma - mi || 1;
    return f.map((v) => (Number.isFinite(v) ? (v - mi) / den : NaN));
  };

  // ---- UI y datos ----
  const container =
    this ?? html`<div class="fullbleed" style="--panel-height: 220px;"></div>`;
  container.replaceChildren();

  const srcList = rankedExternalization ?? [];
  if (!srcList.length) {
    container.append(
      html`<div style="padding:12px;color:#900;">Sin datos para el período/selección.</div>`
    );
    return container;
  }

  const HEIGHT = 220;
  const config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"]
  };
  const mode = normalizeMode ?? "none";
  const unit = unitExternalization ? ` ${unitExternalization}` : "";
  const filterSet = new Set(selectedTapioStates ?? []);

  // ---- aplicar ordenamiento según sortMode ----
  const orderKey = (s) => {
    if (sortMode === "alfabético") return s.country;
    if (sortMode === "máximo") return -d3.max(s.vals.filter(Number.isFinite));
    if (sortMode === "último") return -(s.vals.at(-1) ?? -Infinity);
    if (sortMode === "media") {
      const f = s.vals.filter(Number.isFinite);
      return -(d3.mean(f) ?? -Infinity);
    }
    return s.country;
  };

  // normalizar + ordenar
  const list = srcList
    .map((s) => ({
      ...s,
      vals: normalizeOne(s.vals ?? [], mode)
    }))
    .sort((a, b) => d3.ascending(orderKey(a), orderKey(b)));

  const sharedRange =
    mode === "z-score" ? zScoreSymRange(list) : globalYRange(list);
  const ySuffix =
    mode === "none"
      ? unitExternalization
        ? ` (${unitExternalization})`
        : ""
      : ` — ${mode}`;

  // ---- render por país ----
  const charts = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const el = document.createElement("div");
    el.className = "chart";
    el.style.setProperty("--panel-height", HEIGHT + "px");
    container.append(el);

    const ticks = niceYearTicks(s.years);

    const allStates = tapioByCountryForImpact.get(s.country) || [];
    const states = filterSet.size
      ? allStates.filter((r) => filterSet.has(r.state))
      : allStates;

    const shapes = [];
    for (const row of states) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "y",
        x0: row.year - 0.5,
        x1: row.year + 0.5,
        y0: sharedRange
          ? sharedRange[0]
          : Math.min(...s.vals.filter(Number.isFinite)),
        y1: sharedRange
          ? sharedRange[1]
          : Math.max(...s.vals.filter(Number.isFinite)),
        fillcolor: (row.color || "#ccc") + "CC",
        line: { width: 0 },
        layer: "below"
      });
    }

    const statesByYear = new Map(states.map((r) => [r.year, r]));
    const seriesBaseHover =
      mode === "none"
        ? `Valor: %{y:.2f}${unit}`
        : mode === "z-score"
        ? `z: %{y:.2f}`
        : `Valor normalizado: %{y:.2f}`;

    const hoverText = s.years.map((yr) => {
      const r = statesByYear.get(yr);
      if (!r) return "";
      const de = Number.isFinite(r.DE) ? r.DE.toFixed(2) : "—";
      const gI = Number.isFinite(r.gI) ? (r.gI * 100).toFixed(2) + "%" : "—";
      const gY = Number.isFinite(r.gY) ? (r.gY * 100).toFixed(2) + "%" : "—";
      return `<br>${r.state} · DE: <b>${de}</b><br>ΔMF: ${gI} · ΔGDP: ${gY}`;
    });

    const base = {
      x: s.years,
      y: new Array(s.years.length).fill(sharedRange ? sharedRange[0] : 0),
      mode: "lines",
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false
    };

    const crest = {
      x: s.years,
      y: s.vals,
      mode: "lines",
      line: { width: 2, color: "#111" },
      fill: "tonexty",
      fillcolor: "rgba(0,0,0,0.06)",
      name: s.country,
      text: hoverText,
      hovertemplate: `<b>${s.country}</b><br>Año: %{x}<br>${seriesBaseHover}%{text}<extra></extra>`,
      showlegend: false
    };

    const layout = {
      template: "plotly_white",
      title: { text: s.country, font: { size: 14 }, y: 0.96 },
      hovermode: "x unified",
      xaxis: {
        tickmode: "array",
        tickvals: ticks,
        ticktext: ticks.map(String),
        tickangle: -90,
        automargin: true,
        showgrid: true,
        gridcolor: "#eee",
        zeroline: false
      },
      yaxis: {
        title: i === 0 ? `Valor${ySuffix}` : "",
        range: sharedRange,
        showgrid: true,
        gridcolor: "#f4f4f4",
        zeroline: mode === "z-score"
      },
      margin: { t: 28, r: 16, b: 42, l: 56 },
      height: HEIGHT,
      showlegend: false,
      shapes
    };

    if (mode === "z-score") {
      (layout.shapes ??= []).push({
        type: "line",
        xref: "paper",
        x0: 0,
        x1: 1,
        yref: "y",
        y0: 0,
        y1: 0,
        line: { color: "#666", width: 1, dash: "dot" }
      });
    }

    await Plotly.newPlot(el, [base, crest], layout, config);
    charts.push(el);
  }

  const ro = new ResizeObserver(() => {
    for (const el of charts) Plotly.Plots.resize(el);
  });
  ro.observe(container);
  invalidation.then(() => {
    ro.disconnect();
    for (const el of charts) Plotly.purge(el);
  });

  return container;
}


function _ts_flows(flowOptions,longData,Inputs)
{
  const base =
    typeof flowOptions !== "undefined" &&
    Array.isArray(flowOptions) &&
    flowOptions.length
      ? flowOptions.slice()
      : [...new Set(longData.map((d) => d.flow).filter(Boolean))].sort();

  const have = new Set(base);
  const extras = [];
  if (have.has("MF") && have.has("DMC")) extras.push("MF - DMC");
  if (have.has("MF/cap") && have.has("DMC/cap"))
    extras.push("MF/cap − DMC/cap");

  const options = [...extras, ...base].sort((a, b) => a.localeCompare(b));
  const def = extras.length ? [extras[0]] : options.length ? [options[0]] : [];

  return Inputs.select(options, {
    label: "Indicators (multi-select)",
    multiple: true,
    value: def
  });
}


function _timeSeries_multiIndicator_Tapio(Plotly,html,longData,normalizeMode,smoothWin,yearStart,yearEnd,selectedCountries,ts_flows,rankedSeries,unitOfFlow,unitFor,extMode,driverFlow,tapioTol,tapioPalette,selectedTapioStates,tapioClassify,ResizeObserver,invalidation)
{
  // ---- minimal checks
  if (typeof Plotly === "undefined")
    return html`<div style="color:#900;padding:12px;">Plotly is not available.</div>`;
  if (!Array.isArray(longData) || !longData.length)
    return html`<div style="color:#900;padding:12px;">No longData.</div>`;

  // ---- notebook context (reuse your existing selectors)
  const mode = typeof normalizeMode !== "undefined" ? normalizeMode : "none";
  const k = typeof smoothWin !== "undefined" ? +smoothWin : 0;
  const y0 =
    typeof yearStart !== "undefined"
      ? +yearStart
      : Math.min(...longData.map((d) => d.year));
  const y1 =
    typeof yearEnd !== "undefined"
      ? +yearEnd
      : Math.max(...longData.map((d) => d.year));

  const ctries =
    Array.isArray(selectedCountries) && selectedCountries.length
      ? selectedCountries.slice()
      : [...new Set(longData.map((d) => d.country))].sort();

  // indicators chosen
  const indicators =
    Array.isArray(ts_flows) && ts_flows.length ? ts_flows.slice() : [];
  if (!indicators.length)
    return html`<div style="color:#900;padding:12px;">Pick at least one indicator.</div>`;

  // order countries as in rankedSeries if available
  let orderedCountries = ctries.slice();
  if (Array.isArray(rankedSeries) && rankedSeries.length) {
    const ord = rankedSeries.map((s) => s.country);
    orderedCountries.sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
  }

  // ---- helpers (aligned with your existing logic)
  const years = [
    ...new Set(longData.map((d) => d.year).filter((y) => y >= y0 && y <= y1))
  ].sort((a, b) => a - b);
  const niceYearTicks = (ys) => {
    const u = [...new Set(ys)].filter(Number.isFinite).sort((a, b) => a - b);
    if (u.length <= 10) return u;
    const step = Math.ceil(u.length / 10),
      t = [];
    for (let i = 0; i < u.length; i += step) t.push(u[i]);
    if (t[t.length - 1] !== u[u.length - 1]) t.push(u[u.length - 1]);
    return t;
  };
  const xticks = niceYearTicks(years);

  function movingAvg(vals, win) {
    if (!win || win < 1) return vals.slice();
    const W = Math.max(1, Math.floor(win));
    return vals.map((_, i, arr) => {
      const a = Math.max(0, i - W),
        b = Math.min(arr.length - 1, i + W);
      let s = 0,
        n = 0;
      for (let j = a; j <= b; j++) {
        s += arr[j];
        n++;
      }
      return s / n;
    });
  }
  const idx100 = (vals) => {
    const base = vals.find((v) => Number.isFinite(v));
    return Number.isFinite(base)
      ? vals.map((v) => 100 * (v / base))
      : vals.map(() => NaN);
  };
  const zscore = (vals) => {
    const f = vals.filter(Number.isFinite);
    const mu = f.reduce((a, b) => a + b, 0) / (f.length || 1);
    const sd =
      Math.sqrt(
        f.reduce((s, x) => s + (x - mu) * (x - mu), 0) / (f.length || 1)
      ) || 1;
    return vals.map((v) => (Number.isFinite(v) ? (v - mu) / sd : NaN));
  };
  const minmax = (vals) => {
    const f = vals.filter(Number.isFinite);
    const lo = Math.min(...f),
      hi = Math.max(...f),
      den = hi - lo || 1;
    return vals.map((v) => (Number.isFinite(v) ? (v - lo) / den : NaN));
  };
  const applyNorm = (vals) => {
    if (mode === "index (base=100)") return idx100(vals);
    if (mode === "z-score") return zscore(vals);
    if (mode === "min-max") return minmax(vals);
    return vals.slice();
  };

  // unit for axis by indicator (reuse your unitOfFlow/unitFor if available)
  const unitForIndicator = (name) => {
    if (name === "MF - DMC") {
      const hasCap = new Set(longData.map((d) => d.flow)).has("MF/cap");
      return typeof unitOfFlow === "function"
        ? unitOfFlow(longData, hasCap ? "MF/cap" : "MF")
        : typeof unitFor === "function"
        ? unitFor(hasCap ? "MF/cap" : "MF")
        : "";
    }
    if (name === "MF/cap − DMC/cap") {
      return typeof unitOfFlow === "function"
        ? unitOfFlow(longData, "MF/cap")
        : typeof unitFor === "function"
        ? unitFor("MF/cap")
        : "";
    }
    return typeof unitOfFlow === "function"
      ? unitOfFlow(longData, name)
      : typeof unitFor === "function"
      ? unitFor(name)
      : "";
  };

  // Build (country -> flow -> Map(year -> value))
  const byCF = (() => {
    const m = new Map();
    for (const d of longData) {
      if (d.year < y0 || d.year > y1) continue;
      let mC = m.get(d.country);
      if (!mC) m.set(d.country, (mC = new Map()));
      let mF = mC.get(d.flow);
      if (!mF) mC.set(d.flow, (mF = new Map()));
      mF.set(d.year, +d.value);
    }
    return m;
  })();
  const have = new Set(longData.map((d) => d.flow));

  // series for a given (country, indicator)
  function seriesFor(country, indicator) {
    const m = byCF.get(country) ?? new Map();
    let getter;
    if (indicator === "MF - DMC" || indicator === "MF/cap − DMC/cap") {
      const useCap = indicator === "MF/cap − DMC/cap";
      const fMF = useCap ? "MF/cap" : "MF";
      const fDMC = useCap ? "DMC/cap" : "DMC";
      if (!have.has(fMF) || !have.has(fDMC)) return years.map((_) => NaN);
      const mmf = m.get(fMF) ?? new Map();
      const mdmc = m.get(fDMC) ?? new Map();
      getter = (y) => {
        const a = mmf.get(y),
          b = mdmc.get(y);
        return Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
      };
    } else {
      const mf = m.get(indicator);
      if (!mf) return years.map((_) => NaN);
      getter = (y) => {
        const v = mf.get(y);
        return Number.isFinite(v) ? v : NaN;
      };
    }
    const raw = years.map(getter);
    return applyNorm(movingAvg(raw, k));
  }

  // styling
  const dashes = ["solid", "dash", "dot", "longdash", "dashdot", "longdashdot"];
  const dashOf = (ind) => dashes[indicators.indexOf(ind) % dashes.length];

  const baseColors = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf"
  ];
  const colorOf = (c) =>
    baseColors[orderedCountries.indexOf(c) % baseColors.length];

  // traces: one per (country, indicator); legend grouped by indicator
  const traces = [];
  for (const ind of indicators) {
    const dash = dashOf(ind);
    let first = true;
    for (const c of orderedCountries) {
      const vals = seriesFor(c, ind);
      if (!vals.some(Number.isFinite)) continue;

      const unitSuf = unitForIndicator(ind);
      const hover =
        "<b>" +
        c +
        "</b> — <i>" +
        ind +
        "</i><br>" +
        "Year %{x}<br>" +
        "Value %{y:.2f}" +
        (unitSuf ? " " + unitSuf : "") +
        "<extra></extra>";

      traces.push({
        x: years,
        y: vals,
        type: "scatter",
        mode: "lines",
        line: { width: 2.5, dash, color: colorOf(c) },
        name: ind,
        legendgroup: ind,
        showlegend: first, // single legend entry per indicator
        hovertemplate: hover
      });
      first = false;
    }
  }

  // ---- Tapio strip (impact tied to extMode) -------------------------
  // Position params (tweak here to move the band up/down)
  const tapioBand = { bottom: 0.0, top: 0.05, label: 0.065 };

  const shapes = [];
  const annots = [];
  const focusCountry = orderedCountries[0];

  if (focusCountry) {
    // decide impact flow from extMode; fallback if missing
    let impactFlow = "MF";
    if (typeof extMode !== "undefined" && extMode === "MF/cap − DMC/cap") {
      impactFlow = have.has("MF/cap") ? "MF/cap" : have.has("MF") ? "MF" : null;
    } else {
      impactFlow = have.has("MF") ? "MF" : have.has("MF/cap") ? "MF/cap" : null;
    }

    const driver = typeof driverFlow !== "undefined" ? driverFlow : "GDP";
    const tol = typeof tapioTol !== "undefined" ? +tapioTol : 0.2;
    const palette =
      typeof tapioPalette !== "undefined"
        ? tapioPalette
        : {
            SD: "#2ca02c",
            WD: "#98df8a",
            EC: "#c7c7c7",
            END: "#ff7f0e",
            RD: "#17becf",
            RC: "#7f7f7f",
            RND: "#9467bd",
            SND: "#d62728",
            NA: "#ccc"
          };

    if (impactFlow && have.has(driver)) {
      const mCountry = byCF.get(focusCountry) ?? new Map();
      const I = mCountry.get(impactFlow) ?? new Map(); // Map(year->value)
      const Y = mCountry.get(driver) ?? new Map();

      const allowedStates = new Set(
        Array.isArray(selectedTapioStates) ? selectedTapioStates : []
      );

      for (let i = 1; i < years.length; i++) {
        const t0 = years[i - 1],
          t1 = years[i];
        const I0 = I.get(t0),
          I1 = I.get(t1);
        const Y0 = Y.get(t0),
          Y1 = Y.get(t1);
        if (![I0, I1, Y0, Y1].every(Number.isFinite)) continue;
        if (I0 === 0 || Y0 === 0) continue;

        const gI = (I1 - I0) / I0;
        const gY = (Y1 - Y0) / Y0;

        let state;
        if (typeof tapioClassify === "function")
          state = tapioClassify(gI, gY, tol);
        else {
          const e = gY !== 0 ? gI / gY : NaN;
          if (gY > 0)
            state =
              I1 < I0
                ? "SD"
                : e < 1 - tol
                ? "WD"
                : Math.abs(e - 1) <= tol
                ? "EC"
                : "END";
          else if (gY < 0)
            state =
              I1 > I0
                ? "SND"
                : e < 1 - tol
                ? "RD"
                : Math.abs(e - 1) <= tol
                ? "RC"
                : "RND";
          else state = I1 < I0 ? "SD" : I1 > I0 ? "RND" : "RC";
        }

        if (allowedStates.size && !allowedStates.has(state)) continue;

        shapes.push({
          type: "rect",
          xref: "x",
          yref: "paper",
          x0: t0,
          x1: t1,
          y0: tapioBand.bottom,
          y1: tapioBand.top,
          line: { width: 0 },
          fillcolor: palette[state] || "#ccc",
          opacity: 0.9
        });
      }

      annots.push({
        xref: "paper",
        yref: "paper",
        x: 1,
        y: tapioBand.label,
        xanchor: "top",
        yanchor: "bottom",
        text: "Tapio — impact: " + (impactFlow || "?") + ", driver: " + driver,
        showarrow: false,
        font: { size: 14, color: "#444" }
      });
    }
  }

  // ---- layout & render (EN) -----------------------------------------
  let yTitle = "Value";
  if (mode !== "none") yTitle += " — " + mode;
  else if (indicators.length === 1) {
    const u = unitForIndicator(indicators[0]);
    if (u) yTitle += " (" + u + ")";
  } else {
    yTitle += " — mixed units";
  }

  const title =
    indicators.length === 1
      ? indicators[0] === "MF - DMC"
        ? "MF − DMC (time series)"
        : indicators[0] + " (time series)"
      : "Time series — " + indicators.length + " indicators";

  const container =
    this ??
    html`<div class="fullbleed"><div style="width:100%;height:580px;"></div></div>`;
  const el = container.querySelector("div:last-child");

  const layout = {
    template: "plotly_white",
    title: {
      text: title,
      x: 0,
      xanchor: "left",
      y: 0.99,
      yanchor: "top",
      font: { size: 16 },
      pad: { t: 4, b: 4 }
    },
    margin: { t: 80, r: 20, b: 120, l: 64 },
    xaxis: {
      title: "Year",
      tickmode: "array",
      tickvals: xticks,
      tickangle: -90,
      automargin: true
    },
    yaxis: { title: yTitle, tickformat: ",.2~f", automargin: true },

    // ⬇️ Tooltip SOLO para la serie bajo el cursor
    hovermode: "closest",
    hoverdistance: 25, // tolerancia de captura (px)
    spikedistance: 25, // idem para spikes si los habilitas

    legend: { orientation: "h", y: -0.22, x: 0, xanchor: "left" }, // bottom outside plot
    shapes,
    annotations: annots
  };

  Plotly.react(el, traces, layout, {
    displaylogo: false,
    responsive: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d"]
  });

  const ro = new ResizeObserver(() => {
    try {
      Plotly.Plots.resize(el);
    } catch {}
  });
  ro.observe(el);
  invalidation.then(() => {
    try {
      ro.disconnect();
      Plotly.purge(el);
    } catch {}
  });

  return container;
}


function _hmm_Tapio_overlay(Plotly,html,longData,globalThis,yearStart,yearEnd,selectedCountries,driverFlow,extMode,tapioPalette,tapioClassify,tapioTol,invalidation)
{
  // ---- checks
  if (typeof Plotly === "undefined")
    return html`<div style="color:#900;padding:12px;">Plotly is not available.</div>`;
  if (!Array.isArray(longData) || !longData.length)
    return html`<div style="color:#900;padding:12px;">No longData.</div>`;

  // --- helper robusto para leer números de globalThis
  const G = typeof globalThis !== "undefined" ? globalThis : {};
  function numFromGlobal(
    key,
    def,
    { min = -Infinity, max = Infinity, int = false } = {}
  ) {
    const v = G[key];
    const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return def;
    let x = int ? Math.trunc(n) : n;
    if (x < min) x = min;
    if (x > max) x = max;
    return x;
  }

  // --- params (robustos a globals ausentes)
  const K = numFromGlobal("hmmK", 3, { min: 2, int: true });
  const MAX_ITERS = numFromGlobal("hmmMaxIters", 300, { min: 1, int: true });
  const TOL = numFromGlobal("hmmTol", 1e-6, { min: 1e-12, max: 1e-1 });
  const SEED = numFromGlobal("hmmSeed", 42, { int: true });

  const y0 =
    typeof yearStart !== "undefined"
      ? +yearStart
      : Math.min(...longData.map((d) => d.year));
  const y1 =
    typeof yearEnd !== "undefined"
      ? +yearEnd
      : Math.max(...longData.map((d) => d.year));

  const ctries =
    Array.isArray(selectedCountries) && selectedCountries.length
      ? selectedCountries.slice()
      : [...new Set(longData.map((d) => d.country))].sort();

  const driver = typeof driverFlow !== "undefined" ? driverFlow : "GDP";
  const flowsSet = new Set(longData.map((d) => d.flow));
  let impactFlow = "MF";
  if (typeof extMode !== "undefined" && extMode === "MF/cap − DMC/cap")
    impactFlow = flowsSet.has("MF/cap")
      ? "MF/cap"
      : flowsSet.has("MF")
      ? "MF"
      : "MF";
  else
    impactFlow = flowsSet.has("MF")
      ? "MF"
      : flowsSet.has("MF/cap")
      ? "MF/cap"
      : "MF";

  // ---- utils
  const years = [
    ...new Set(longData.map((d) => d.year).filter((y) => y >= y0 && y <= y1))
  ].sort((a, b) => a - b);

  const byCF = (() => {
    const m = new Map();
    for (const d of longData) {
      if (d.year < y0 || d.year > y1) continue;
      let mC = m.get(d.country);
      if (!mC) m.set(d.country, (mC = new Map()));
      let mF = mC.get(d.flow);
      if (!mF) mC.set(d.flow, (mF = new Map()));
      mF.set(d.year, +d.value);
    }
    return m;
  })();

  const safeGet = (c, f, y) => {
    const mC = byCF.get(c);
    if (!mC) return NaN;
    const mF = mC.get(f);
    if (!mF) return NaN;
    const v = mF.get(y);
    return Number.isFinite(v) ? v : NaN;
  };

  // ---- Tapio observed states
  const TAPIO_LABELS = ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];
  const TAPIO_TO_INT = new Map(TAPIO_LABELS.map((s, i) => [s, i]));
  const palette =
    typeof tapioPalette !== "undefined"
      ? tapioPalette
      : {
          SD: "#2ca02c",
          WD: "#98df8a",
          EC: "#c7c7c7",
          END: "#ff7f0e",
          RD: "#17becf",
          RC: "#7f7f7f",
          RND: "#9467bd",
          SND: "#d62728",
          NA: "#ccc"
        };

  const tapioFallback = (gI, gY, tol = 0.2) => {
    const e = gY !== 0 ? gI / gY : NaN;
    if (gY > 0)
      return gI < 0
        ? "SD"
        : e < 1 - tol
        ? "WD"
        : Math.abs(e - 1) <= tol
        ? "EC"
        : "END";
    if (gY < 0)
      return gI > 0
        ? "SND"
        : e < 1 - tol
        ? "RD"
        : Math.abs(e - 1) <= tol
        ? "RC"
        : "RND";
    return gI < 0 ? "SD" : gI > 0 ? "RND" : "RC";
  };
  const tapioFn =
    typeof tapioClassify === "function" ? tapioClassify : tapioFallback;
  const tol = typeof tapioTol !== "undefined" ? +tapioTol : 0.2;

  function tapioSequenceFor(country) {
    const seq = [];
    for (let i = 1; i < years.length; i++) {
      const t0 = years[i - 1],
        t1 = years[i];
      const I0 = safeGet(country, impactFlow, t0),
        I1 = safeGet(country, impactFlow, t1);
      const Y0 = safeGet(country, driver, t0),
        Y1 = safeGet(country, driver, t1);
      if (![I0, I1, Y0, Y1].every(Number.isFinite) || I0 === 0 || Y0 === 0) {
        seq.push({ year: t1, label: "NA", obs: null });
        continue;
      }
      const gI = (I1 - I0) / I0,
        gY = (Y1 - Y0) / Y0;
      const lab = tapioFn(gI, gY, tol);
      seq.push({ year: t1, label: lab, obs: TAPIO_TO_INT.get(lab) ?? null });
    }
    return seq;
  }

  // ---- pool de secuencias
  const sequences = [];
  const perCountry = new Map();
  for (const c of ctries) {
    const s = tapioSequenceFor(c);
    const obs = s.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length >= 6) {
      sequences.push(obs);
      perCountry.set(c, { seq: s, obsClean: obs });
    }
  }
  const S = TAPIO_LABELS.length;
  if (!sequences.length)
    return html`<div style="color:#900;padding:12px;">No valid Tapio sequences to train HMM.</div>`;

  // ---- HMM discreto (Baum–Welch)
  function RNG(seed = 1234) {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  }
  const rand = RNG(SEED);
  function dirichlet(a) {
    const x = a.map((v) => -Math.log(rand()) / (v || 1));
    const sum = x.reduce((p, v) => p + v, 0) || 1;
    return x.map((v) => v / sum);
  }
  const normalizeRow = (v) => {
    const s = v.reduce((p, x) => p + x, 0);
    return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
  };

  function initModel(K, S) {
    const pi = dirichlet(Array(K).fill(1));
    const A = Array.from({ length: K }, () =>
      normalizeRow(dirichlet(Array(K).fill(1)))
    );
    const B = Array.from({ length: K }, () =>
      normalizeRow(dirichlet(Array(S).fill(1)))
    );
    return { K, S, pi, A, B };
  }

  function forwardScaled(model, obs) {
    const { K, B, A, pi } = model;
    const T = obs.length;
    const alpha = Array.from({ length: T }, () => Array(K).fill(0));
    const c = Array(T).fill(0);
    for (let i = 0; i < K; i++) {
      alpha[0][i] = pi[i] * B[i][obs[0]];
      c[0] += alpha[0][i];
    }
    if (c[0] === 0) c[0] = 1e-300;
    for (let i = 0; i < K; i++) alpha[0][i] /= c[0];
    for (let t = 1; t < T; t++) {
      let ct = 0;
      for (let j = 0; j < K; j++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * A[i][j];
        const val = sum * B[j][obs[t]];
        alpha[t][j] = val;
        ct += val;
      }
      if (ct === 0) ct = 1e-300;
      c[t] = ct;
      for (let j = 0; j < K; j++) alpha[t][j] /= ct;
    }
    const loglik = -c.map((v) => Math.log(v)).reduce((p, v) => p + v, 0);
    return { alpha, c, loglik };
  }

  function backwardScaled(model, obs, c) {
    const { K, B, A } = model;
    const T = obs.length;
    const beta = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) beta[T - 1][i] = 1 / c[T - 1];
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < K; i++) {
        let sum = 0;
        for (let j = 0; j < K; j++)
          sum += A[i][j] * B[j][obs[t + 1]] * beta[t + 1][j];
        beta[t][i] = sum / c[t];
      }
    }
    return beta;
  }

  function baumWelch(seqs, K, S, maxIters = 200, tol = 1e-6) {
    let model = initModel(K, S),
      prev = -Infinity;
    for (let it = 0; it < maxIters; it++) {
      const pi_acc = Array(K).fill(0);
      const A_acc = Array.from({ length: K }, () => Array(K).fill(0));
      const B_acc = Array.from({ length: K }, () => Array(S).fill(0));
      let total = 0;

      for (const obs of seqs) {
        const { alpha, c, loglik } = forwardScaled(model, obs);
        const beta = backwardScaled(model, obs, c);
        total += loglik;
        const T = obs.length;

        const gamma = Array.from({ length: T }, () => Array(K).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
          Array.from({ length: K }, () => Array(K).fill(0))
        );

        for (let t = 0; t < T; t++) {
          let denom = 0;
          for (let i = 0; i < K; i++) denom += alpha[t][i] * beta[t][i];
          if (denom === 0) denom = 1e-300;
          for (let i = 0; i < K; i++)
            gamma[t][i] = (alpha[t][i] * beta[t][i]) / denom;
        }
        for (let t = 0; t < T - 1; t++) {
          let denom = 0;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              denom +=
                alpha[t][i] *
                model.A[i][j] *
                model.B[j][obs[t + 1]] *
                beta[t + 1][j];
          if (denom === 0) denom = 1e-300;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              xi[t][i][j] =
                (alpha[t][i] *
                  model.A[i][j] *
                  model.B[j][obs[t + 1]] *
                  beta[t + 1][j]) /
                denom;
        }

        for (let i = 0; i < K; i++) pi_acc[i] += gamma[0][i];
        for (let i = 0; i < K; i++) {
          let denom = 0;
          for (let t = 0; t < T - 1; t++) denom += gamma[t][i];
          if (denom === 0) denom = 1e-300;
          for (let j = 0; j < K; j++) {
            let num = 0;
            for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
            A_acc[i][j] += num / denom;
          }
        }
        for (let i = 0; i < K; i++) {
          let denom = 0;
          for (let t = 0; t < T; t++) denom += gamma[t][i];
          if (denom === 0) denom = 1e-300;
          const btmp = Array(S).fill(0);
          for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
          for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / denom;
        }
      }

      model.pi = normalizeRow(pi_acc);
      for (let i = 0; i < K; i++) model.A[i] = normalizeRow(A_acc[i]);
      for (let i = 0; i < K; i++) model.B[i] = normalizeRow(B_acc[i]);

      if (it > 0 && Math.abs(total - prev) < tol * Math.max(1, Math.abs(prev)))
        break;
      prev = total;
    }
    return model;
  }

  function viterbi(model, obs) {
    const { K, A, B, pi } = model;
    const T = obs.length;
    const delta = Array.from({ length: T }, () => Array(K).fill(-Infinity));
    const psi = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) {
      delta[0][i] =
        Math.log(pi[i] || 1e-300) + Math.log(B[i][obs[0]] || 1e-300);
      psi[0][i] = 0;
    }
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < K; j++) {
        let best = -Infinity,
          arg = 0;
        for (let i = 0; i < K; i++) {
          const val =
            delta[t - 1][i] +
            Math.log(A[i][j] || 1e-300) +
            Math.log(B[j][obs[t]] || 1e-300);
          if (val > best) {
            best = val;
            arg = i;
          }
        }
        delta[t][j] = best;
        psi[t][j] = arg;
      }
    }
    let bestLast = -Infinity,
      qT = 0;
    for (let i = 0; i < K; i++) {
      if (delta[T - 1][i] > bestLast) {
        bestLast = delta[T - 1][i];
        qT = i;
      }
    }
    const path = Array(T).fill(0);
    path[T - 1] = qT;
    for (let t = T - 2; t >= 0; t--) path[t] = psi[t + 1][path[t + 1]];
    return path;
  }

  const model = baumWelch(sequences, K, S, MAX_ITERS, TOL);

  // ---- decodificación y co-ocurrencias
  const HMM_COLORS = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf"
  ].slice(0, K);
  const cooc = Array.from({ length: S }, () => Array(K).fill(0));
  const decoded = new Map();
  for (const [c, info] of perCountry.entries()) {
    const seq = info.seq;
    const obs = seq.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length < 2) continue;
    const path = viterbi(model, obs);
    const yearsT1 = [],
      tapioAligned = [],
      hmmAligned = [];
    let k = 0;
    for (const d of seq) {
      if (d.obs === null) continue;
      yearsT1.push(d.year);
      tapioAligned.push(d.label);
      const h = path[k++];
      hmmAligned.push(h);
      cooc[d.obs][h] += 1;
    }
    decoded.set(c, { yearsT1, tapioAligned, hmmAligned });
  }

  // ---- semántica de regímenes a partir del heatmap (top-2 estados por régimen)
  function regimeAliases() {
    const top2 = [];
    for (let h = 0; h < K; h++) {
      const col = cooc.map((row) => row[h]);
      const order = col
        .map((v, i) => [i, v])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      top2.push(order.map(([i, _]) => TAPIO_LABELS[i]));
    }
    return top2; // p.ej., [["SD","WD"],["END","EC"],["RD","EC"]]
  }
  const aliases = regimeAliases();

  // ---- FULL-WIDTH container
  const container =
    this ??
    html`<div style="width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);"></div>`;

  const bar = document.createElement("div");
  const legend = document.createElement("div");
  const ovWrap = document.createElement("div");
  const postWrap = document.createElement("div");
  const heatWrap = document.createElement("div");
  container.replaceChildren(bar, legend, ovWrap, postWrap, heatWrap);
  for (const wrap of [bar, legend, ovWrap, postWrap, heatWrap]) {
    wrap.style.width = "100vw";
    wrap.style.maxWidth = "100vw";
    wrap.style.marginLeft = "calc(50% - 50vw)";
    wrap.style.marginRight = "calc(50% - 50vw)";
  }

  // ---- controles
  const focusDefault =
    ctries.find((c) => decoded.has(c)) || [...decoded.keys()][0];
  if (!focusDefault)
    return html`<div style="color:#900;padding:12px;">No decoded sequences available.</div>`;

  const sel = document.createElement("select");
  for (const c of ctries)
    if (decoded.has(c)) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      if (c === focusDefault) o.selected = true;
      sel.appendChild(o);
    }
  const kInfo = document.createElement("span");
  kInfo.textContent = `  |  HMM K=${K}, iters≤${MAX_ITERS}, tol=${TOL}`;
  kInfo.style.color = "#555";
  bar.style.display = "flex";
  bar.style.gap = "12px";
  bar.style.alignItems = "center";
  bar.style.padding = "8px 16px";
  bar.append("Focus country: ", sel, kInfo);

  // ---- leyenda semántica de regímenes
  (function renderSemanticLegend() {
    legend.style.padding = "6px 16px";
    const chips = aliases.map(
      (arr, i) =>
        `<span style="display:inline-block;border-radius:12px;padding:4px 10px;margin:2px;background:${
          HMM_COLORS[i]
        };color:#fff;">Regime ${i + 1}: ${arr.join(" / ")}</span>`
    );
    legend.innerHTML = `<div style="font-size:13px;color:#333;">Regime semantics (top Tapio states by co-occurrence): ${chips.join(
      " "
    )}</div>`;
  })();

  // ---- plots
  function renderOverlay(country) {
    const d = decoded.get(country);
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "420px";
    if (!d) {
      el.textContent = `No decoded sequence for ${country}.`;
      el.style.color = "#900";
      return el;
    }

    // shapes
    const shapes = [],
      anns = [];
    const yTap = { bottom: 0.66, top: 0.86, label: 0.88 };
    const yHmm = { bottom: 0.1, top: 0.3, label: 0.32 };

    for (let i = 0; i < d.yearsT1.length; i++) {
      const t1 = d.yearsT1[i],
        t0 = i > 0 ? d.yearsT1[i - 1] : t1 - 1;
      const lab = d.tapioAligned[i];
      const col = palette[lab] || "#ccc";
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: t0,
        x1: t1,
        y0: yTap.bottom,
        y1: yTap.top,
        line: { width: 0 },
        fillcolor: col,
        opacity: 0.95
      });
      const h = d.hmmAligned[i],
        hc = HMM_COLORS[h % HMM_COLORS.length];
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: t0,
        x1: t1,
        y0: yHmm.bottom,
        y1: yHmm.top,
        line: { width: 0 },
        fillcolor: hc,
        opacity: 0.95
      });
    }

    anns.push(
      {
        xref: "paper",
        yref: "paper",
        x: 0,
        y: yTap.label,
        xanchor: "left",
        yanchor: "bottom",
        text: `Tapio (${country}) — impact: ${impactFlow}, driver: ${driver}`,
        showarrow: false,
        font: { size: 12, color: "#444" }
      },
      {
        xref: "paper",
        yref: "paper",
        x: 0,
        y: yHmm.label,
        xanchor: "left",
        yanchor: "bottom",
        text: `HMM regimes (K=${K}) — pooled training`,
        showarrow: false,
        font: { size: 12, color: "#444" }
      }
    );

    const xticks = (() => {
      const u = [...new Set(d.yearsT1)].sort((a, b) => a - b);
      if (u.length <= 12) return u;
      const step = Math.ceil(u.length / 12),
        t = [];
      for (let i = 0; i < u.length; i += step) t.push(u[i]);
      if (t[t.length - 1] !== u[u.length - 1]) t.push(u[u.length - 1]);
      return t;
    })();

    // *** clave: traza invisible para fijar ejes ***
    const axisTrace = {
      x: d.yearsT1,
      y: d.yearsT1.map(() => 0),
      type: "scatter",
      mode: "lines",
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false,
      opacity: 0
    };

    const layout = {
      template: "plotly_white",
      title: { text: `Tapio vs HMM — ${country}`, x: 0, xanchor: "left" },
      margin: { t: 60, r: 16, b: 80, l: 48 },
      xaxis: {
        title: "Year (t1)",
        tickmode: "array",
        tickvals: xticks,
        tickangle: -90,
        automargin: true,
        range: [d.yearsT1[0] - 0.5, d.yearsT1[d.yearsT1.length - 1] + 0.5]
      },
      yaxis: {
        tickvals: [],
        showgrid: false,
        zeroline: false,
        fixedrange: true
      },
      showlegend: false,
      shapes,
      annotations: anns
    };

    Plotly.react(el, [axisTrace], layout, {
      displaylogo: false,
      responsive: true
    });
    return el;
  }

  function renderPosteriors(country) {
    const fullSeq = perCountry.get(country)?.seq;
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "360px";
    if (!fullSeq) return el;

    // Observaciones válidas (sin NA) para el HMM
    const obs = fullSeq.map((x) => x.obs).filter((x) => x !== null);
    if (obs.length < 2) return el;

    // Posteriors gamma
    const { alpha, c } = forwardScaled(model, obs);
    const beta = backwardScaled(model, obs, c);
    const T = obs.length;
    const gamma = Array.from({ length: T }, () => Array(K).fill(0));
    for (let t = 0; t < T; t++) {
      let denom = 0;
      for (let i = 0; i < K; i++) denom += alpha[t][i] * beta[t][i];
      if (denom === 0) denom = 1e-300;
      for (let i = 0; i < K; i++)
        gamma[t][i] = (alpha[t][i] * beta[t][i]) / denom;
    }

    // Años reales asociados a esas T observaciones (t1) y grid completo para romper en faltantes
    const d = decoded.get(country);
    const xObs = d?.yearsT1.slice(0, T) ?? [];
    if (!xObs.length) return el;

    const xmin = xObs[0],
      xmax = xObs[xObs.length - 1];
    const xGrid = [];
    for (let y = xmin; y <= xmax; y++) xGrid.push(y);

    // Mapear gamma a grid anual e insertar NaN cuando falte ese año
    const traces = [];
    for (let k = 0; k < K; k++) {
      const yk = [];
      for (const y of xGrid) {
        const idx = xObs.indexOf(y);
        yk.push(idx === -1 ? NaN : gamma[idx][k]);
      }
      traces.push({
        x: xGrid,
        y: yk,
        type: "scatter",
        mode: "lines",
        stackgroup: "one",
        line: { width: 1.5, shape: "hv", color: HMM_COLORS[k] }, // <-- escalón
        connectgaps: false, // <-- no unir huecos
        name: `Regime ${k + 1} (${aliases[k].join("/")})`,
        hovertemplate: "<b>Year %{x}</b><br>P(z_t)=" + "%{y:.3f}<extra></extra>"
      });
    }

    const layout = {
      template: "plotly_white",
      title: { text: `HMM posteriors — ${country}`, x: 0, xanchor: "left" },
      margin: { t: 60, r: 16, b: 110, l: 48 },
      xaxis: {
        title: "Year (t1)",
        tickangle: -90,
        automargin: true,
        range: [xmin - 0.5, xmax + 0.5]
      },
      yaxis: { title: "Probability", range: [0, 1], tickformat: ".0%" },
      line: { shape: "hv", width: 0 }, // bloques sin borde
      opacity: 0.9,
      hovermode: "x unified",
      showlegend: true,
      legend: { orientation: "h", x: 0, xanchor: "left", y: -0.18 } // leyenda debajo
    };

    Plotly.react(el, traces, layout, { displaylogo: false, responsive: true });
    return el;
  }

  function renderHeatmap(focusCountry) {
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "380px";

    // fallback si llega undefined o no existe en decoded
    if (!focusCountry || !decoded.has(focusCountry)) {
      const first = [...decoded.keys()][0];
      if (!first) {
        el.innerHTML =
          '<div style="color:#900;padding:12px;">No decoded sequences available.</div>';
        return el;
      }
      focusCountry = first;
    }

    // etiquetas Tapio y dimensiones
    const Slabels =
      Array.isArray(TAPIO_LABELS) && TAPIO_LABELS.length
        ? TAPIO_LABELS.slice()
        : ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];
    const S = Slabels.length;
    const Kloc =
      typeof K === "number" && K > 0
        ? K
        : Array.isArray(cooc?.[0])
        ? cooc[0].length
        : 3;

    // matriz SxK sólo para el país foco
    const coocFocus = Array.from({ length: S }, () => Array(Kloc).fill(0));
    const d = decoded.get(focusCountry);
    const tapioIndex = new Map(Slabels.map((s, i) => [s, i]));
    for (let i = 0; i < d.yearsT1.length; i++) {
      const r = tapioIndex.get(d.tapioAligned[i]);
      const h = d.hmmAligned[i];
      if (r != null && h != null && h < Kloc) coocFocus[r][h] += 1;
    }

    // modo counts / col%
    const mode =
      typeof globalThis.hmmHeatmapMode === "string"
        ? globalThis.hmmHeatmapMode
        : "counts";
    const colSums = Array.from({ length: Kloc }, (_, j) =>
      coocFocus.reduce((s, row) => s + (row[j] || 0), 0)
    );
    const grandTotal = colSums.reduce((a, b) => a + b, 0);

    let z = coocFocus.map((r) => r.slice());
    let text = Array.from({ length: S }, () => Array(Kloc).fill(""));
    if (mode === "col%") {
      for (let j = 0; j < Kloc; j++) {
        const denom = colSums[j] || 1;
        for (let i = 0; i < S; i++) {
          const p = (100 * (z[i][j] || 0)) / denom;
          z[i][j] = p;
          text[i][j] = p ? `${p.toFixed(0)}%` : "";
        }
      }
    } else {
      for (let i = 0; i < S; i++)
        for (let j = 0; j < Kloc; j++)
          text[i][j] = z[i][j] ? String(z[i][j]) : "";
    }

    const x = Array.from(
      { length: Kloc },
      (_, j) => `Regime ${j + 1} (n=${colSums[j]})`
    );
    const y = Slabels;
    const titleSuffix =
      mode === "col%"
        ? "— column-normalised (%)"
        : `— counts (${focusCountry}, total N=${grandTotal})`;
    const colorscale = mode === "col%" ? "Greens" : "Blues";

    // anotaciones con alto contraste
    const flat = z.flat().filter(Number.isFinite);
    const zmin = flat.length ? Math.min(...flat) : 0;
    const zmax = flat.length ? Math.max(...flat) : 1;
    const den = zmax - zmin || 1;
    const annotations = [];
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < Kloc; j++) {
        const t = text[i][j];
        if (!t) continue;
        const frac = Number.isFinite(z[i][j]) ? (z[i][j] - zmin) / den : 0;
        const dark = frac >= 0.55;
        annotations.push({
          x: x[j],
          y: y[i],
          text: t,
          showarrow: false,
          font: { size: 11, color: dark ? "#fff" : "#111" },
          bgcolor: dark ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.60)",
          bordercolor: "rgba(0,0,0,0)",
          borderpad: 2
        });
      }
    }

    const data = [
      {
        z,
        x,
        y,
        type: "heatmap",
        colorscale,
        hovertemplate:
          mode === "col%"
            ? "Tapio %{y} × %{x}<br>% within regime: %{z:.1f}%<extra></extra>"
            : "Tapio %{y} × %{x}<br>count: %{z}<extra></extra>",
        showscale: true
      }
    ];

    const layout = {
      template: "plotly_white",
      title: {
        text: `Tapio vs HMM — co-occurrence ${titleSuffix}`,
        x: 0,
        xanchor: "left"
      },
      margin: { t: 60, r: 16, b: 40, l: 90 },
      xaxis: { side: "top" },
      yaxis: { automargin: true },
      annotations
    };

    Plotly.react(el, data, layout, { displaylogo: false, responsive: true });
    return el;
  }

  function rerender() {
    const country =
      (sel && sel.value) || focusDefault || [...decoded.keys()][0] || null;
    ovWrap.replaceChildren(renderOverlay(country));
    postWrap.replaceChildren(renderPosteriors(country));
    heatWrap.replaceChildren(renderHeatmap(country)); // <-- pasa el país
    onResize();
  }

  function onResize() {
    for (const wrap of [ovWrap, postWrap, heatWrap]) {
      const plotDiv = wrap.querySelector("div");
      if (plotDiv) {
        try {
          Plotly.Plots.resize(plotDiv);
        } catch {}
      }
    }
  }

  sel.addEventListener("change", rerender);
  rerender();
  window.addEventListener("resize", onResize, { passive: true });
  invalidation.then(() => {
    try {
      window.removeEventListener("resize", onResize);
    } catch {}
  });

  return container;
}


function _R_yearStart(){return(
1994
)}

function _R_yearEnd_infer(){return(
2024
)}

function _R_rollK(){return(
5
)}

function _R_helpers()
{
  // Estados Tapio válidos (orden estable)
  const STATES = ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];

  // Clasificar Tapio con años fijos (no toca los selectores del cuaderno)
  function tapioByCountryFixed(
    countries,
    startYear,
    endYear,
    longData,
    flow,
    driverFlow,
    tol,
    tapioClassify
  ) {
    const span = (y) => y >= startYear && y <= endYear;
    const byI = new Map(countries.map((c) => [c, new Map()])),
      byY = new Map(countries.map((c) => [c, new Map()]));
    for (const d of longData) {
      if (!byI.has(d.country)) continue;
      if (!span(d.year)) continue;
      if (d.flow === flow) byI.get(d.country).set(d.year, d.value);
      if (d.flow === driverFlow) byY.get(d.country).set(d.year, d.value);
    }
    const out = new Map();
    for (const c of countries) {
      const I = byI.get(c),
        Y = byY.get(c);
      const years = [...new Set([...I.keys(), ...Y.keys()])]
        .filter(span)
        .sort((a, b) => a - b);
      const rows = [];
      for (let i = 1; i < years.length; i++) {
        const t = years[i],
          t1 = years[i - 1];
        const I1 = I.get(t1),
          It = I.get(t),
          Y1 = Y.get(t1),
          Yt = Y.get(t);
        if (![I1, It, Y1, Yt].every(Number.isFinite)) continue;
        if (I1 === 0 || Y1 === 0) continue;
        const gI = (It - I1) / I1,
          gY = (Yt - Y1) / Y1;
        const st = tapioClassify(gI, gY, tol);
        const e = gY !== 0 && Number.isFinite(gI) ? gI / gY : NaN;
        rows.push({ year: t, state: st, DE: e, gI, gY });
      }
      out.set(c, rows);
    }
    return out; // Map(country -> rows)
  }

  // Conjunto balanceado: países con cobertura completa de transiciones (t= start+1..end)
  function balancedCountries(countries, tapioMap, startYear, endYear) {
    const need = endYear - startYear; // nº de transiciones
    return countries.filter((c) => {
      const rows = tapioMap.get(c) || [];
      if (rows.length !== need) return false;
      return rows.every(
        (r) => r && r.state && r.state !== "NA" && Number.isFinite(r.DE)
      );
    });
  }

  // Conteos por estado en lista de filas Tapio
  function countStates(rows) {
    const cts = Object.fromEntries(STATES.map((s) => [s, 0]));
    for (const r of rows) {
      if (STATES.includes(r.state)) cts[r.state]++;
    }
    cts._N = rows.length;
    return cts;
  }

  // Wilson CI 95% para proporciones
  function wilson(k, n, z = 1.96) {
    if (!n) return [NaN, NaN, NaN];
    const p = k / n,
      z2 = z * z,
      den = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / den;
    const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
    return [Math.max(0, center - half), center, Math.min(1, center + half)];
  }

  // χ² para tabla 2xK (UE vs MERCOSUR por estado)
  function chiSquare2xK(countsEU, countsMCS) {
    const keys = Object.keys(countsEU).filter((k) => k !== "_N");
    const row1 = keys.map((k) => countsEU[k]);
    const row2 = keys.map((k) => countsMCS[k]);
    const R = 2,
      C = keys.length;
    const n1 = row1.reduce((a, b) => a + b, 0),
      n2 = row2.reduce((a, b) => a + b, 0),
      N = n1 + n2;
    const colSums = keys.map((_, j) => row1[j] + row2[j]);
    let X2 = 0;
    for (let j = 0; j < C; j++) {
      const e1 = n1 * (colSums[j] / N);
      const e2 = n2 * (colSums[j] / N);
      if (e1 > 0) X2 += (row1[j] - e1) ** 2 / e1;
      if (e2 > 0) X2 += (row2[j] - e2) ** 2 / e2;
    }
    const df = (R - 1) * (C - 1);
    // p-valor por aproximación χ² (cola superior) — función gamma regularizada incompleta (aprox rápida)
    function gammaln(x) {
      // Lanczos
      const cof = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
      ];
      let ser = 1.000000000190015,
        y = x,
        tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
      return -tmp + Math.log((2.5066282746310005 * ser) / x);
    }
    function gser(a, x) {
      const ITMAX = 100,
        EPS = 1e-8;
      if (x <= 0) return 0;
      let ap = a,
        sum = 1 / a,
        del = sum;
      for (let n = 1; n <= ITMAX; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * EPS)
          return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
      }
      return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
    }
    function gcf(a, x) {
      const ITMAX = 100,
        EPS = 1e-8,
        FPMIN = 1e-30;
      let b = x + 1 - a,
        c = 1 / FPMIN,
        d = 1 / b,
        h = d;
      for (let i = 1; i <= ITMAX; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = b + an / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
      }
      return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
    }
    function gammq(a, x) {
      return x < a + 1 ? 1 - gser(a, x) : gcf(a, x);
    }
    const p = gammq(df / 2, X2 / 2);
    return { X2, df, p };
  }

  // Mann–Whitney U (dos colas, normal aprox con corrección)
  function mannWhitney(listEU, listMCS) {
    const a = listEU.filter(Number.isFinite),
      b = listMCS.filter(Number.isFinite);
    const n1 = a.length,
      n2 = b.length;
    const all = a
      .map((v) => ({ v, g: 0 }))
      .concat(b.map((v) => ({ v, g: 1 })))
      .sort((x, y) => x.v - y.v);
    // ranks promedio para empates
    let i = 0;
    const ranks = new Array(all.length);
    while (i < all.length) {
      let j = i + 1;
      while (j < all.length && all[j].v === all[i].v) j++;
      const r = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) ranks[k] = r;
      i = j;
    }
    let R1 = 0,
      R2 = 0;
    for (let k = 0; k < all.length; k++) {
      if (all[k].g === 0) R1 += ranks[k];
      else R2 += ranks[k];
    }
    const U1 = R1 - (n1 * (n1 + 1)) / 2;
    const U2 = R2 - (n2 * (n2 + 1)) / 2;
    const U = Math.min(U1, U2);
    const mu = (n1 * n2) / 2;
    // Var con ajuste por empates
    const ties = [];
    i = 0;
    while (i < all.length) {
      let j = i + 1;
      while (j < all.length && all[j].v === all[i].v) j++;
      ties.push(j - i);
      i = j;
    }
    const T = ties.reduce((s, t) => s + t * (t * t - 1), 0);
    const sigma = Math.sqrt(
      ((n1 * n2) / 12) * (n1 + n2 + 1 - T / ((n1 + n2) * (n1 + n2 - 1)))
    );
    const z = (U - mu + 0.5) / sigma; // corrección continuidad
    const p = 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)));
    function erf(x) {
      // Abramowitz & Stegun 7.1.26
      const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const t = 1 / (1 + p * x);
      const y =
        1 -
        ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    }
    return { U, U1, U2, z, p, n1, n2 };
  }

  return {
    STATES,
    tapioByCountryFixed,
    balancedCountries,
    countStates,
    wilson,
    chiSquare2xK,
    mannWhitney
  };
}


function _Fig_R1_TapioSharesByBloc(R_helpers,countriesUE,R_yearStart,R_yearEnd_infer,longData,flow,driverFlow,tapioTol,tapioClassify,countriesMCS,Plotly)
{
  const {
    STATES,
    tapioByCountryFixed,
    balancedCountries,
    countStates,
    wilson
  } = R_helpers;

  // 1) Tapio balanceado por bloque
  const mapEU = tapioByCountryFixed(
    countriesUE,
    R_yearStart,
    R_yearEnd_infer,
    longData,
    flow,
    driverFlow,
    +tapioTol,
    tapioClassify
  );
  const mapMCS = tapioByCountryFixed(
    countriesMCS,
    R_yearStart,
    R_yearEnd_infer,
    longData,
    flow,
    driverFlow,
    +tapioTol,
    tapioClassify
  );

  const balEU = R_helpers.balancedCountries(
    countriesUE,
    mapEU,
    R_yearStart,
    R_yearEnd_infer
  );
  const balMCS = R_helpers.balancedCountries(
    countriesMCS,
    mapMCS,
    R_yearStart,
    R_yearEnd_infer
  );

  const rowsEU = balEU.flatMap((c) => mapEU.get(c));
  const rowsMCS = balMCS.flatMap((c) => mapMCS.get(c));

  const cEU = countStates(rowsEU);
  const cMCS = countStates(rowsMCS);

  const N_EU = cEU._N,
    N_MCS = cMCS._N;

  const yEU = STATES.map((s) => (N_EU ? cEU[s] / N_EU : 0));
  const yMCS = STATES.map((s) => (N_MCS ? cMCS[s] / N_MCS : 0));
  const ciEU = STATES.map((s, i) => wilson(cEU[s], N_EU));
  const ciMCS = STATES.map((s, i) => wilson(cMCS[s], N_MCS));

  // Errores asimétricos
  const upEU = ciEU.map(([lo, ce, hi]) => Math.max(0, hi - ce));
  const dnEU = ciEU.map(([lo, ce, hi]) => Math.max(0, ce - lo));
  const upMCS = ciMCS.map(([lo, ce, hi]) => Math.max(0, hi - ce));
  const dnMCS = ciMCS.map(([lo, ce, hi]) => Math.max(0, ce - lo));

  const x = STATES.map((s) => s);

  const traceEU = {
    type: "bar",
    name: "European Union",
    x,
    y: yEU,
    error_y: { type: "data", array: upEU, arrayminus: dnEU, visible: true },
    opacity: 0.9
  };
  const traceMCS = {
    type: "bar",
    name: "MERCOSUR",
    x,
    y: yMCS,
    error_y: { type: "data", array: upMCS, arrayminus: dnMCS, visible: true },
    opacity: 0.9
  };

  const el = document.createElement("div");
  const layout = {
    template: "plotly_white",
    barmode: "group",
    title: {
      text: "Fig. R1 — Tapio state shares by bloc (balanced 1994–2024) with 95% CIs"
    },
    yaxis: {
      title: "Share of observations",
      rangemode: "tozero",
      tickformat: ".0%",
      automargin: true
    },
    xaxis: { title: "Tapio state", automargin: true },
    legend: { orientation: "h" },
    margin: { t: 60, r: 20, b: 60, l: 60 },
    height: 460
  };
  Plotly.newPlot(el, [traceEU, traceMCS], layout, {
    responsive: true,
    displaylogo: false
  });
  return el;
}


function _R2_bloc(Inputs){return(
Inputs.radio(["European Union", "Mercosur"], {
  label: "Bloc",
  value: "European Union"
})
)}

function _Fig_R2_TapioStrips_with_Rolling(R_helpers,R2_bloc,countriesUE,countriesMCS,R_yearStart,R_yearEnd_infer,longData,flow,driverFlow,tapioTol,tapioClassify,R_rollK,Plotly)
{
  const { STATES, tapioByCountryFixed, balancedCountries } = R_helpers;

  const blocName = R2_bloc;
  const countriesAll =
    blocName === "European Union" ? countriesUE : countriesMCS;

  // Tapio (balanceado) en 1995–2021
  const tapioMap = tapioByCountryFixed(
    countriesAll,
    R_yearStart,
    R_yearEnd_infer,
    longData,
    flow,
    driverFlow,
    +tapioTol,
    tapioClassify
  );
  const bal = balancedCountries(
    countriesAll,
    tapioMap,
    R_yearStart,
    R_yearEnd_infer
  );

  // Matriz estado→código para heatmap
  const code = new Map([
    ["SD", 0],
    ["WD", 1],
    ["EC", 2],
    ["END", 3],
    ["RD", 4],
    ["RC", 5],
    ["RND", 6],
    ["SND", 7]
  ]);
  const colors = [
    "#2ca02c",
    "#98df8a",
    "#c7c7c7",
    "#ff7f0e",
    "#17becf",
    "#7f7f7f",
    "#9467bd",
    "#d62728"
  ];
  const years = Array.from(
    { length: R_yearEnd_infer - R_yearStart },
    (_, i) => R_yearStart + 1 + i
  ); // 1996..2021

  // z: filas=país (orden alfabético), columnas=años (transiciones)
  const countries = [...bal].sort((a, b) => a.localeCompare(b));
  const z = countries.map((c) => {
    const rows = tapioMap.get(c) || [];
    const byY = new Map(rows.map((r) => [r.year, r.state]));
    return years.map((y) => code.get(byY.get(y)) ?? 0);
  });

  // Rolling share 5y (SD y END) a nivel bloque
  const allRows = countries.flatMap((c) => tapioMap.get(c) || []);
  function rollingShare(state) {
    const out = [];
    for (let i = 0; i < years.length; i++) {
      const y0 = years[i] - (R_rollK - 1),
        y1 = years[i]; // ventana cerrada
      const win = allRows.filter((r) => r.year >= y0 && r.year <= y1);
      const num = win.filter((r) => r.state === state).length;
      const den = win.length || 1;
      out.push(num / den);
    }
    return out;
  }
  const sdShare = rollingShare("SD");
  const endShare = rollingShare("END");

  const container = document.createElement("div");
  container.className = "fullbleed";
  const top = document.createElement("div");
  const bottom = document.createElement("div");
  container.append(top, bottom);

  // --------- Gráfico superior (líneas) con leyenda vertical a la derecha ---------
  Plotly.newPlot(
    top,
    [
      {
        x: years,
        y: sdShare,
        mode: "lines",
        name: "SD (5y share)",
        line: { width: 2 }
      },
      {
        x: years,
        y: endShare,
        mode: "lines",
        name: "END (5y share)",
        line: { width: 2, dash: "dot" }
      }
    ],
    {
      template: "plotly_white",
      title: {
        text: `Fig. R2 — ${blocName}: rolling 5-year share (SD vs END)`
      },
      yaxis: { title: "Share", tickformat: ".0%", rangemode: "tozero" },
      xaxis: { title: "Year", tickangle: -90, automargin: true },
      legend: {
        orientation: "h",
        x: 0.5, // fuera del área del plot, a la derecha
        xanchor: "center",
        y: -0.25,
        yanchor: "top",
        bgcolor: "rgba(255,255,255,0.8)"
      },
      height: 360,
      margin: { t: 60, r: 20, b: 100, l: 60 } // más margen a la derecha para la leyenda
    },
    { responsive: true, displaylogo: false }
  );

  // -------------------- Heatmap inferior (tiras Tapio por país) -------------------
  Plotly.newPlot(
    bottom,
    [
      {
        type: "heatmap",
        z,
        x: years.map(String),
        y: countries,
        colorscale: colors.map((c, i) => [i / 7, c]),
        showscale: false,
        zmin: 0,
        zmax: 7,
        hovertemplate: "Year: %{x}<br>Country: %{y}<extra></extra>"
      }
    ],
    {
      template: "plotly_white",
      title: {
        text: `Country Tapio-strips (${blocName}) · states over ${
          R_yearStart + 1
        }–${R_yearEnd_infer}`
      },
      xaxis: { title: "Year (transition t)", tickangle: -90, automargin: true },
      yaxis: { title: "Country", automargin: true },
      height: Math.max(320, 22 * countries.length + 120),
      margin: { t: 60, r: 20, b: 60, l: 100 }
    },
    { responsive: true, displaylogo: false }
  );

  return container;
}


function _Tab_R1_StateProps_Elasticity_Tests(R_helpers,countriesUE,R_yearStart,R_yearEnd_infer,longData,flow,driverFlow,tapioTol,tapioClassify,countriesMCS)
{
  const {
    STATES,
    tapioByCountryFixed,
    balancedCountries,
    countStates,
    chiSquare2xK,
    mannWhitney
  } = R_helpers;

  // Tapio balanceado 1995–2021
  const mapEU = tapioByCountryFixed(
    countriesUE,
    R_yearStart,
    R_yearEnd_infer,
    longData,
    flow,
    driverFlow,
    +tapioTol,
    tapioClassify
  );
  const mapMCS = tapioByCountryFixed(
    countriesMCS,
    R_yearStart,
    R_yearEnd_infer,
    longData,
    flow,
    driverFlow,
    +tapioTol,
    tapioClassify
  );
  const balEU = balancedCountries(
    countriesUE,
    mapEU,
    R_yearStart,
    R_yearEnd_infer
  );
  const balMCS = balancedCountries(
    countriesMCS,
    mapMCS,
    R_yearStart,
    R_yearEnd_infer
  );

  const rowsEU = balEU.flatMap((c) => mapEU.get(c));
  const rowsMCS = balMCS.flatMap((c) => mapMCS.get(c));

  const cEU = countStates(rowsEU);
  const cMCS = countStates(rowsMCS);

  const N_EU = cEU._N,
    N_MCS = cMCS._N;

  // Proporciones por estado
  const tableRows = STATES.map((s) => {
    const nEU = cEU[s] || 0,
      nMCS = cMCS[s] || 0;
    const pEU = N_EU ? nEU / N_EU : 0;
    const pMCS = N_MCS ? nMCS / N_MCS : 0;
    return {
      State: s,
      EU_count: nEU,
      EU_share: pEU,
      MCS_count: nMCS,
      MCS_share: pMCS
    };
  });

  // Mediana de elasticidad e (todas las obs. válidas)
  function median(a) {
    const v = a.filter(Number.isFinite).sort((x, y) => x - y);
    if (!v.length) return NaN;
    const m = (v.length - 1) / 2;
    return (v[Math.floor(m)] + v[Math.ceil(m)]) / 2;
  }
  const eEU = rowsEU.map((r) => r.DE);
  const eMCS = rowsMCS.map((r) => r.DE);
  const medEU = median(eEU);
  const medMCS = median(eMCS);

  // Tests
  const chi = chiSquare2xK(cEU, cMCS);
  const mw = mannWhitney(eEU, eMCS);

  // Render HTML
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3>Tab. R1 — State proportions, elasticity medians, and bloc tests (balanced 1994–2021)</h3>
    <style>
      table.rtab { border-collapse: collapse; font: 13px/1.45 system-ui, sans-serif; }
      .rtab th, .rtab td { border: 1px solid #ddd; padding: 6px 10px; text-align: right; }
      .rtab th { background: #f7f7f7; }
      .rtab td:first-child, .rtab th:first-child { text-align: left; }
      .subtle { color: #555; }
    </style>
    <table class="rtab">
      <thead>
        <tr><th>Tapio state</th><th>EU count</th><th>EU share</th><th>MERCOSUR count</th><th>MERCOSUR share</th></tr>
      </thead>
      <tbody>
        ${tableRows
          .map(
            (r) => `
          <tr>
            <td>${r.State}</td>
            <td>${r.EU_count}</td>
            <td>${(r.EU_share * 100).toFixed(1)}%</td>
            <td>${r.MCS_count}</td>
            <td>${(r.MCS_share * 100).toFixed(1)}%</td>
          </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr><td><b>Total N (obs.)</b></td><td colspan="2">${N_EU}</td><td colspan="2">${N_MCS}</td></tr>
      </tfoot>
    </table>
    <p class="subtle">Elasticity e = g<sub>I</sub>/g<sub>Y</sub> (solo años con datos válidos).</p>
    <table class="rtab" style="margin-top:8px;">
      <thead><tr><th></th><th>EU</th><th>MERCOSUR</th></tr></thead>
      <tbody>
        <tr><td>Median e</td><td>${
          Number.isFinite(medEU) ? medEU.toFixed(3) : "—"
        }</td><td>${Number.isFinite(medMCS) ? medMCS.toFixed(3) : "—"}</td></tr>
      </tbody>
    </table>
    <table class="rtab" style="margin-top:8px;">
      <thead><tr><th>Test</th><th>Statistic</th><th>df / n</th><th>p-value</th></tr></thead>
      <tbody>
        <tr><td>χ² proportions (8 states)</td><td>${chi.X2.toFixed(
          3
        )}</td><td>df=${chi.df}</td><td>${chi.p.toExponential(3)}</td></tr>
        <tr><td>Mann–Whitney (e)</td><td>U=${mw.U.toFixed(1)}; z=${mw.z.toFixed(
    2
  )}</td><td>n1=${mw.n1}, n2=${mw.n2}</td><td>${mw.p.toExponential(3)}</td></tr>
      </tbody>
    </table>
    <p class="subtle">Nota: panel balanceado por país (transiciones anuales completas en 1994–2021)</p>
  `;
  return wrap;
}


function _HMM_posteriors_by_bloc(Plotly,html,longData,globalThis,yearStart,yearEnd,driverFlow,extMode,tapioTol,tapioClassify,selectedCountries)
{
  // ---- chequeos
  if (typeof Plotly === "undefined")
    return html`<div style="color:#900;padding:12px;">Plotly no está disponible.</div>`;
  if (!Array.isArray(longData) || !longData.length)
    return html`<div style="color:#900;padding:12px;">No hay longData.</div>`;

  // ---- helper: intentar leer celdas previas sin crear dependencia estática
  const maybeCell = (name) => {
    try {
      return Function(
        `try { return (typeof ${name} !== "undefined") ? ${name} : null } catch(e){ return null }`
      )();
    } catch (e) {
      return null;
    }
  };

  // ---- parámetros (reusa globals si existen)
  const G = globalThis;
  const numFromGlobal = (
    k,
    def,
    { min = -Infinity, max = Infinity, int = false } = {}
  ) => {
    const v = G[k];
    const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return def;
    let x = int ? Math.trunc(n) : n;
    if (x < min) x = min;
    if (x > max) x = max;
    return x;
  };
  const K = numFromGlobal("hmmK", 3, { min: 2, int: true });
  const MAX_ITERS = numFromGlobal("hmmMaxIters", 300, { min: 1, int: true });
  const TOL = numFromGlobal("hmmTol", 1e-6, { min: 1e-12, max: 1e-1 });
  const SEED = numFromGlobal("hmmSeed", 42, { int: true });

  const y0 =
    typeof yearStart !== "undefined"
      ? +yearStart
      : Math.min(...longData.map((d) => d.year));
  const y1 =
    typeof yearEnd !== "undefined"
      ? +yearEnd
      : Math.max(...longData.map((d) => d.year));
  const years = [
    ...new Set(longData.map((d) => d.year).filter((y) => y >= y0 && y <= y1))
  ].sort((a, b) => a - b);

  // ---- impacto/driver coherentes con el cuaderno
  const flowsSet = new Set(longData.map((d) => d.flow));
  const driver = typeof driverFlow !== "undefined" ? driverFlow : "GDP";
  let impactFlow = "MF";
  if (typeof extMode !== "undefined" && extMode === "MF/cap − DMC/cap")
    impactFlow = flowsSet.has("MF/cap")
      ? "MF/cap"
      : flowsSet.has("MF")
      ? "MF"
      : "MF";
  else
    impactFlow = flowsSet.has("MF")
      ? "MF"
      : flowsSet.has("MF/cap")
      ? "MF/cap"
      : "MF";

  // ---- países por bloque: usa definiciones previas si existen; si no, listas estáticas limpias
  const blocsObj = maybeCell("blocsResolved") || maybeCell("blocs");
  const countriesUE_prev = maybeCell("countriesUE");
  const countriesMCS_prev = maybeCell("countriesMCS");

  const EU_STATIC = [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czechia",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden"
  ];
  const MCS_STATIC = ["Argentina", "Brazil", "Paraguay", "Uruguay"];

  const fromBlocs = (obj, keys) => {
    if (!obj) return null;
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v) && v.length) return v.slice();
    }
    return null;
  };

  const EU27_raw =
    countriesUE_prev ||
    fromBlocs(blocsObj, ["EU-27", "EU27", "European Union", "EU"]) ||
    EU_STATIC;

  const MCS4_raw =
    countriesMCS_prev ||
    fromBlocs(blocsObj, ["Mercosur", "MERCOSUR"]) ||
    MCS_STATIC;

  const dataCountries = new Set(longData.map((d) => d.country));
  const filterByData = (arr) => arr.filter((c) => dataCountries.has(c));
  const EU27 = filterByData(EU27_raw);
  const MCS4 = filterByData(MCS4_raw);

  // ---- index country→flow→year
  const byCF = (() => {
    const m = new Map();
    for (const d of longData) {
      if (d.year < y0 || d.year > y1) continue;
      let mC = m.get(d.country);
      if (!mC) m.set(d.country, (mC = new Map()));
      let mF = mC.get(d.flow);
      if (!mF) mC.set(d.flow, (mF = new Map()));
      mF.set(d.year, +d.value);
    }
    return m;
  })();
  const safeGet = (c, f, y) => {
    const mC = byCF.get(c);
    if (!mC) return NaN;
    const mF = mC.get(f);
    if (!mF) return NaN;
    const v = mF.get(y);
    return Number.isFinite(v) ? v : NaN;
  };

  // ---- Tapio (8 estados) → entero 0..7 (usa tapioClassify si existe)
  const TAPIO_LABELS = ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];
  const TAPIO_TO_INT = new Map(TAPIO_LABELS.map((s, i) => [s, i]));
  const tapioFallback = (
    gI,
    gY,
    tol = typeof tapioTol !== "undefined" ? +tapioTol : 0.2
  ) => {
    const e = gY !== 0 ? gI / gY : NaN;
    if (gY > 0)
      return gI < 0
        ? "SD"
        : e < 1 - tol
        ? "WD"
        : Math.abs(e - 1) <= tol
        ? "EC"
        : "END";
    if (gY < 0)
      return gI > 0
        ? "SND"
        : e < 1 - tol
        ? "RD"
        : Math.abs(e - 1) <= tol
        ? "RC"
        : "RND";
    return gI < 0 ? "SD" : gI > 0 ? "RND" : "RC";
  };
  const tapioFn =
    typeof tapioClassify === "function" ? tapioClassify : tapioFallback;

  function tapioSequenceFor(country) {
    const seq = [];
    for (let i = 1; i < years.length; i++) {
      const t0 = years[i - 1],
        t1 = years[i];
      const I0 = safeGet(country, impactFlow, t0),
        I1 = safeGet(country, impactFlow, t1);
      const Y0 = safeGet(country, driver, t0),
        Y1 = safeGet(country, driver, t1);
      if (![I0, I1, Y0, Y1].every(Number.isFinite) || I0 === 0 || Y0 === 0) {
        seq.push({ year: t1, label: "NA", obs: null });
        continue;
      }
      const gI = (I1 - I0) / I0,
        gY = (Y1 - Y0) / Y0;
      const lab = tapioFn(
        gI,
        gY,
        typeof tapioTol !== "undefined" ? +tapioTol : 0.2
      );
      seq.push({ year: t1, label: lab, obs: TAPIO_TO_INT.get(lab) ?? null });
    }
    return seq;
  }

  // ---- pool de entrenamiento (UE + Mercosur; fallback a selectedCountries o todos)
  const trainingPool = [...new Set([...EU27, ...MCS4])];
  const ctries = trainingPool.length
    ? trainingPool
    : Array.isArray(selectedCountries) && selectedCountries.length
    ? selectedCountries.slice()
    : [...new Set(longData.map((d) => d.country))];

  // ---- construir secuencias discretas (mínimo 6 observaciones válidas)
  const S = TAPIO_LABELS.length;
  const sequences = [];
  const perCountry = new Map();
  for (const c of ctries) {
    const s = tapioSequenceFor(c);
    const obs = s.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length >= 6) {
      sequences.push(obs);
      perCountry.set(c, { seq: s, obsClean: obs });
    }
  }
  if (!sequences.length)
    return html`<div style="color:#900;padding:12px;">No hay secuencias Tapio válidas para entrenar el HMM.</div>`;

  // ---- HMM discreto (escalado) + Baum–Welch
  function RNG(seed = 1234) {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  }
  const rand = RNG(SEED);
  const dirichlet = (a) => {
    const x = a.map((v) => -Math.log(rand()) / (v || 1));
    const sum = x.reduce((p, v) => p + v, 0) || 1;
    return x.map((v) => v / sum);
  };
  const normalizeRow = (v) => {
    const s = v.reduce((p, x) => p + x, 0);
    return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
  };

  function initModel(K, S) {
    const pi = dirichlet(Array(K).fill(1));
    const A = Array.from({ length: K }, () =>
      normalizeRow(dirichlet(Array(K).fill(1)))
    );
    const B = Array.from({ length: K }, () =>
      normalizeRow(dirichlet(Array(S).fill(1)))
    );
    return { K, S, pi, A, B };
  }
  function forwardScaled(model, obs) {
    const { K, B, A, pi } = model;
    const T = obs.length;
    const alpha = Array.from({ length: T }, () => Array(K).fill(0));
    const c = Array(T).fill(0);
    for (let i = 0; i < K; i++) {
      alpha[0][i] = pi[i] * B[i][obs[0]];
      c[0] += alpha[0][i];
    }
    if (c[0] === 0) c[0] = 1e-300;
    for (let i = 0; i < K; i++) alpha[0][i] /= c[0];
    for (let t = 1; t < T; t++) {
      let ct = 0;
      for (let j = 0; j < K; j++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * A[i][j];
        const val = sum * B[j][obs[t]];
        alpha[t][j] = val;
        ct += val;
      }
      if (ct === 0) ct = 1e-300;
      c[t] = ct;
      for (let j = 0; j < K; j++) alpha[t][j] /= ct;
    }
    const loglik = -c.map((v) => Math.log(v)).reduce((p, v) => p + v, 0);
    return { alpha, c, loglik };
  }
  function backwardScaled(model, obs, c) {
    const { K, B, A } = model;
    const T = obs.length;
    const beta = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) beta[T - 1][i] = 1 / c[T - 1];
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < K; i++) {
        let sum = 0;
        for (let j = 0; j < K; j++)
          sum += A[i][j] * B[j][obs[t + 1]] * beta[t + 1][j];
        beta[t][i] = sum / c[t];
      }
    }
    return beta;
  }
  function baumWelch(seqs, K, S, maxIters = 200, tol = 1e-6) {
    let model = initModel(K, S),
      prev = -Infinity;
    for (let it = 0; it < maxIters; it++) {
      const pi_acc = Array(K).fill(0);
      const A_acc = Array.from({ length: K }, () => Array(K).fill(0));
      const B_acc = Array.from({ length: K }, () => Array(S).fill(0));
      let total = 0;
      for (const obs of seqs) {
        const { alpha, c, loglik } = forwardScaled(model, obs);
        const beta = backwardScaled(model, obs, c);
        total += loglik;
        const T = obs.length;

        const gamma = Array.from({ length: T }, () => Array(K).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
          Array.from({ length: K }, () => Array(K).fill(0))
        );

        for (let t = 0; t < T; t++) {
          let denom = 0;
          for (let i = 0; i < K; i++) denom += alpha[t][i] * beta[t][i];
          if (denom === 0) denom = 1e-300;
          for (let i = 0; i < K; i++)
            gamma[t][i] = (alpha[t][i] * beta[t][i]) / denom;
        }
        for (let t = 0; t < T - 1; t++) {
          let denom = 0;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              denom +=
                alpha[t][i] *
                model.A[i][j] *
                model.B[j][obs[t + 1]] *
                beta[t + 1][j];
          if (denom === 0) denom = 1e-300;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              xi[t][i][j] =
                (alpha[t][i] *
                  model.A[i][j] *
                  model.B[j][obs[t + 1]] *
                  beta[t + 1][j]) /
                denom;
        }

        for (let i = 0; i < K; i++) pi_acc[i] += gamma[0][i];
        for (let i = 0; i < K; i++) {
          let denom = 0;
          for (let t = 0; t < T - 1; t++) denom += gamma[t][i];
          if (denom === 0) denom = 1e-300;
          for (let j = 0; j < K; j++) {
            let num = 0;
            for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
            A_acc[i][j] += num / denom;
          }
        }
        for (let i = 0; i < K; i++) {
          let denom = 0;
          for (let t = 0; t < T; t++) denom += gamma[t][i];
          if (denom === 0) denom = 1e-300;
          const btmp = Array(S).fill(0);
          for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
          for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / denom;
        }
      }
      const normalize = (row) => {
        const s = row.reduce((p, x) => p + x, 0);
        return s > 0 ? row.map((x) => x / s) : row.map(() => 1 / row.length);
      };
      model.pi = normalize(pi_acc);
      for (let i = 0; i < K; i++) model.A[i] = normalize(A_acc[i]);
      for (let i = 0; i < K; i++) model.B[i] = normalize(B_acc[i]);

      if (it > 0 && Math.abs(total - prev) < tol * Math.max(1, Math.abs(prev)))
        break;
      prev = total;
    }
    return model;
  }

  // ---- entrenar
  const model = baumWelch(sequences, K, S, MAX_ITERS, TOL);

  // ---- decodificación (para alinear años t1 y co-ocurrencias Tapio↔regímenes)
  const decoded = new Map();
  const cooc = Array.from({ length: S }, () => Array(K).fill(0));
  for (const [c, info] of perCountry.entries()) {
    const seq = info.seq;
    const obs = seq.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length < 2) continue;
    // Viterbi abreviado
    const T = obs.length;
    const delta = Array.from({ length: T }, () => Array(K).fill(-Infinity));
    const psi = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) {
      delta[0][i] =
        Math.log(model.pi[i] || 1e-300) +
        Math.log(model.B[i][obs[0]] || 1e-300);
      psi[0][i] = 0;
    }
    for (let t = 1; t < T; t++)
      for (let j = 0; j < K; j++) {
        let best = -Infinity,
          arg = 0;
        for (let i = 0; i < K; i++) {
          const val =
            delta[t - 1][i] +
            Math.log(model.A[i][j] || 1e-300) +
            Math.log(model.B[j][obs[t]] || 1e-300);
          if (val > best) {
            best = val;
            arg = i;
          }
        }
        delta[t][j] = best;
        psi[t][j] = arg;
      }
    let bestLast = -Infinity,
      qT = 0;
    for (let i = 0; i < K; i++)
      if (delta[T - 1][i] > bestLast) {
        bestLast = delta[T - 1][i];
        qT = i;
      }
    const path = Array(T).fill(0);
    path[T - 1] = qT;
    for (let t = T - 2; t >= 0; t--) path[t] = psi[t + 1][path[t + 1]];

    const yearsT1 = [];
    let kIdx = 0;
    for (const d of seq) {
      if (d.obs === null) continue;
      yearsT1.push(d.year);
      cooc[d.obs][path[kIdx]] += 1;
      kIdx++;
    }
    decoded.set(c, { yearsT1 });
  }
  const regimeLabels = (() => {
    const out = [];
    for (let h = 0; h < K; h++) {
      const col = cooc.map((row) => row[h]);
      const order = col
        .map((v, i) => [i, v])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      out.push(order.map(([i, _]) => TAPIO_LABELS[i]));
    }
    return out;
  })();

  // ---- γ promedio por año dentro de un bloque
  function averagedBlocGamma(blocCountries) {
    const yearAgg = new Map(); // y -> { sum[K], n }
    for (const c of blocCountries) {
      const info = perCountry.get(c),
        dec = decoded.get(c);
      if (!info || !dec) continue;
      const fullSeq = info.seq;
      const obs = fullSeq.map((x) => x.obs).filter((x) => x !== null);
      if (obs.length < 2) continue;

      const { alpha, c: scale } = forwardScaled(model, obs);
      const beta = backwardScaled(model, obs, scale);
      const T = obs.length;
      for (let t = 0; t < T; t++) {
        let denom = 0;
        for (let i = 0; i < K; i++) denom += alpha[t][i] * beta[t][i];
        if (denom === 0) denom = 1e-300;
        const y = dec.yearsT1[t];
        if (!yearAgg.has(y)) yearAgg.set(y, { sum: Array(K).fill(0), n: 0 });
        const e = yearAgg.get(y);
        for (let k = 0; k < K; k++)
          e.sum[k] += (alpha[t][k] * beta[t][k]) / denom;
        e.n += 1;
      }
    }
    const xs = [...yearAgg.keys()].sort((a, b) => a - b);
    const ys = Array.from({ length: K }, () => Array(xs.length).fill(NaN));
    for (let ti = 0; ti < xs.length; ti++) {
      const e = yearAgg.get(xs[ti]);
      if (!e || !e.n) continue;
      for (let k = 0; k < K; k++) ys[k][ti] = e.sum[k] / e.n;
    }
    return { xs, ys };
  }

  // ---- trazar (formato newPlot: áreas apiladas 0..1)
  const HMM_COLORS = [
    "#2ca02c",
    "#ff7f0e",
    "#1f77b4",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf"
  ].slice(0, K);

  function renderBlocPlot(titleText, blocCountries) {
    const eligible = (blocCountries || []).filter((c) => decoded.has(c));
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "360px";
    if (!eligible.length) {
      el.innerHTML = `<div style="color:#900;padding:12px;">No hay países decodificados en ${titleText}.</div>`;
      return el;
    }
    const agg = averagedBlocGamma(eligible); // {xs, ys}
    if (!agg.xs.length) {
      el.innerHTML = `<div style="color:#900;padding:12px;">No hay años con posteriors para ${titleText}.</div>`;
      return el;
    }
    const traces = [];
    for (let k = 0; k < K; k++) {
      traces.push({
        x: agg.xs,
        y: agg.ys[k],
        type: "scatter",
        mode: "lines",
        stackgroup: "one",
        line: { width: 1.5, shape: "hv", color: HMM_COLORS[k] },
        connectgaps: false,
        name: `Regime ${k + 1} (${regimeLabels[k].join("/")})`,
        hovertemplate: "<b>Year %{x}</b><br>P(z_t)=%{y:.3f}<extra></extra>"
      });
    }
    const layout = {
      template: "plotly_white",
      title: { text: titleText, x: 0, xanchor: "left" },
      margin: { t: 60, r: 16, b: 110, l: 48 },
      xaxis: {
        title: "Year (t1)",
        tickangle: -90,
        automargin: true,
        range: [agg.xs[0] - 0.5, agg.xs[agg.xs.length - 1] + 0.5]
      },
      yaxis: { title: "Probability", range: [0, 1], tickformat: ".0%" },
      hovermode: "x unified",
      showlegend: true,
      legend: { orientation: "h", x: 0, xanchor: "left", y: -0.18 }
    };
    Plotly.newPlot(el, traces, layout, {
      displaylogo: false,
      responsive: true
    });
    return el;
  }

  // ---- salida: dos gráficos (UE y Mercosur)
  const container =
    this ??
    html`<div style="width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);display:grid;gap:24px;"></div>`;
  container.replaceChildren(
    renderBlocPlot(
      `HMM posteriors — European Union (average across countries; K=${K})`,
      EU27
    ),
    renderBlocPlot(
      `HMM posteriors — Mercosur (average across countries; K=${K})`,
      MCS4
    )
  );
  return container;
}


function _Tab_R2_regime_shares_and_IC(longData,html,globalThis,yearStart,yearEnd,driverFlow,extMode,tapioTol,tapioClassify)
{
  if (!Array.isArray(longData) || !longData.length)
    return html`<div style="color:#900;padding:12px;">No hay longData.</div>`;

  // ---------- utilidades robustas ----------
  const readMaybe = (name) => {
    try {
      return Function(`return (typeof ${name}!=="undefined")?${name}:null`)();
    } catch {
      return null;
    }
  };
  const G = globalThis;
  const numFromGlobal = (
    k,
    def,
    { min = -Infinity, max = Infinity, int = false } = {}
  ) => {
    const v = G[k],
      n = typeof v === "number" || typeof v === "string" ? +v : NaN;
    if (!Number.isFinite(n)) return def;
    let x = int ? Math.trunc(n) : n;
    return Math.max(min, Math.min(max, x));
  };

  // ---------- función para construir hmm_shared si falta ----------
  function buildSharedFallback() {
    const K = numFromGlobal("hmmK", 3, { min: 2, int: true });
    const MAX_ITERS = numFromGlobal("hmmMaxIters", 300, { min: 1, int: true });
    const TOL = numFromGlobal("hmmTol", 1e-6, { min: 1e-12, max: 1e-1 });
    const SEED = numFromGlobal("hmmSeed", 42, { int: true });

    const y0 =
      typeof yearStart !== "undefined"
        ? +yearStart
        : Math.min(...longData.map((d) => d.year));
    const y1 =
      typeof yearEnd !== "undefined"
        ? +yearEnd
        : Math.max(...longData.map((d) => d.year));
    const years = [
      ...new Set(longData.map((d) => d.year).filter((y) => y >= y0 && y <= y1))
    ].sort((a, b) => a - b);

    const flowsSet = new Set(longData.map((d) => d.flow));
    const driver = typeof driverFlow !== "undefined" ? driverFlow : "GDP";
    let impactFlow = "MF";
    if (typeof extMode !== "undefined" && extMode === "MF/cap − DMC/cap")
      impactFlow = flowsSet.has("MF/cap")
        ? "MF/cap"
        : flowsSet.has("MF")
        ? "MF"
        : "MF";
    else
      impactFlow = flowsSet.has("MF")
        ? "MF"
        : flowsSet.has("MF/cap")
        ? "MF/cap"
        : "MF";

    const blocsObj = readMaybe("blocsResolved") || readMaybe("blocs");
    const countriesUE_prev = readMaybe("countriesUE");
    const countriesMCS_prev = readMaybe("countriesMCS");
    const EU_STATIC = [
      "Austria",
      "Belgium",
      "Bulgaria",
      "Croatia",
      "Cyprus",
      "Czechia",
      "Denmark",
      "Estonia",
      "Finland",
      "France",
      "Germany",
      "Greece",
      "Hungary",
      "Ireland",
      "Italy",
      "Latvia",
      "Lithuania",
      "Luxembourg",
      "Malta",
      "Netherlands",
      "Poland",
      "Portugal",
      "Romania",
      "Slovakia",
      "Slovenia",
      "Spain",
      "Sweden"
    ];
    const MCS_STATIC = ["Argentina", "Brazil", "Paraguay", "Uruguay"];
    const fromBlocs = (obj, keys) => {
      if (!obj) return null;
      for (const k of keys) {
        const v = obj[k];
        if (Array.isArray(v) && v.length) return v.slice();
      }
      return null;
    };
    const EU27_raw =
      countriesUE_prev ||
      fromBlocs(blocsObj, ["EU-27", "EU27", "European Union", "EU"]) ||
      EU_STATIC;
    const MCS4_raw =
      countriesMCS_prev ||
      fromBlocs(blocsObj, ["Mercosur", "MERCOSUR"]) ||
      MCS_STATIC;
    const dataCountries = new Set(longData.map((d) => d.country));
    const EU27 = EU27_raw.filter((c) => dataCountries.has(c));
    const MCS4 = MCS4_raw.filter((c) => dataCountries.has(c));

    const byCF = (() => {
      const m = new Map();
      for (const d of longData) {
        if (d.year < y0 || d.year > y1) continue;
        let mC = m.get(d.country);
        if (!mC) m.set(d.country, (mC = new Map()));
        let mF = mC.get(d.flow);
        if (!mF) mC.set(d.flow, (mF = new Map()));
        mF.set(d.year, +d.value);
      }
      return m;
    })();
    const safeGet = (c, f, y) => {
      const mC = byCF.get(c);
      if (!mC) return NaN;
      const mF = mC.get(f);
      if (!mF) return NaN;
      const v = mF.get(y);
      return Number.isFinite(v) ? v : NaN;
    };

    const TAPIO_LABELS = ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];
    const TAPIO_TO_INT = new Map(TAPIO_LABELS.map((s, i) => [s, i]));
    const tapioFallback = (
      gI,
      gY,
      tol = typeof tapioTol !== "undefined" ? +tapioTol : 0.2
    ) => {
      const e = gY !== 0 ? gI / gY : NaN;
      if (gY > 0)
        return gI < 0
          ? "SD"
          : e < 1 - tol
          ? "WD"
          : Math.abs(e - 1) <= tol
          ? "EC"
          : "END";
      if (gY < 0)
        return gI > 0
          ? "SND"
          : e < 1 - tol
          ? "RD"
          : Math.abs(e - 1) <= tol
          ? "RC"
          : "RND";
      return gI < 0 ? "SD" : gI > 0 ? "RND" : "RC";
    };
    const tapioFn =
      typeof tapioClassify === "function" ? tapioClassify : tapioFallback;

    function tapioSequenceFor(country) {
      const seq = [];
      for (let i = 1; i < years.length; i++) {
        const t0 = years[i - 1],
          t1 = years[i];
        const I0 = safeGet(country, impactFlow, t0),
          I1 = safeGet(country, impactFlow, t1);
        const Y0 = safeGet(country, driver, t0),
          Y1 = safeGet(country, driver, t1);
        if (![I0, I1, Y0, Y1].every(Number.isFinite) || I0 === 0 || Y0 === 0) {
          seq.push({ year: t1, label: "NA", obs: null });
          continue;
        }
        const gI = (I1 - I0) / I0,
          gY = (Y1 - Y0) / Y0;
        const lab = tapioFn(
          gI,
          gY,
          typeof tapioTol !== "undefined" ? +tapioTol : 0.2
        );
        seq.push({ year: t1, label: lab, obs: TAPIO_TO_INT.get(lab) ?? null });
      }
      return seq;
    }

    const trainingPool = [...new Set([...EU27, ...MCS4])];
    const ctries = trainingPool.length
      ? trainingPool
      : [...new Set(longData.map((d) => d.country))];
    const S = TAPIO_LABELS.length;
    const sequences = [];
    const perCountry = new Map();
    for (const c of ctries) {
      const s = tapioSequenceFor(c);
      const obs = s.map((d) => d.obs).filter((v) => v !== null);
      if (obs.length >= 6) {
        sequences.push(obs);
        perCountry.set(c, { seq: s, obsClean: obs });
      }
    }
    if (!sequences.length) return { error: "No hay secuencias Tapio válidas." };

    function RNG(seed = 1234) {
      let s = seed >>> 0;
      return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
    }
    const rand = RNG(SEED);
    const dirichlet = (a) => {
      const x = a.map((v) => -Math.log(rand()) / (v || 1));
      const sum = x.reduce((p, v) => p + v, 0) || 1;
      return x.map((v) => v / sum);
    };
    const normRow = (v) => {
      const s = v.reduce((p, x) => p + x, 0);
      return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
    };

    function initModel(K, S) {
      const pi = dirichlet(Array(K).fill(1));
      const A = Array.from({ length: K }, () =>
        normRow(dirichlet(Array(K).fill(1)))
      );
      const B = Array.from({ length: K }, () =>
        normRow(dirichlet(Array(S).fill(1)))
      );
      return { K, S, pi, A, B };
    }
    function forwardScaled(m, obs) {
      const { K, B, A, pi } = m;
      const T = obs.length;
      const alpha = Array.from({ length: T }, () => Array(K).fill(0)),
        c = Array(T).fill(0);
      for (let i = 0; i < K; i++) {
        alpha[0][i] = pi[i] * B[i][obs[0]];
        c[0] += alpha[0][i];
      }
      if (c[0] === 0) c[0] = 1e-300;
      for (let i = 0; i < K; i++) alpha[0][i] /= c[0];
      for (let t = 1; t < T; t++) {
        let ct = 0;
        for (let j = 0; j < K; j++) {
          let sum = 0;
          for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * A[i][j];
          const val = sum * B[j][obs[t]];
          alpha[t][j] = val;
          ct += val;
        }
        if (ct === 0) ct = 1e-300;
        c[t] = ct;
        for (let j = 0; j < K; j++) alpha[t][j] /= ct;
      }
      const loglik = -c.map((v) => Math.log(v)).reduce((p, v) => p + v, 0);
      return { alpha, c, loglik };
    }
    function backwardScaled(m, obs, c) {
      const { K, B, A } = m;
      const T = obs.length;
      const beta = Array.from({ length: T }, () => Array(K).fill(0));
      for (let i = 0; i < K; i++) beta[T - 1][i] = 1 / c[T - 1];
      for (let t = T - 2; t >= 0; t--)
        for (let i = 0; i < K; i++) {
          let s = 0;
          for (let j = 0; j < K; j++)
            s += A[i][j] * B[j][obs[t + 1]] * beta[t + 1][j];
          beta[t][i] = s / c[t];
        }
      return beta;
    }
    function baumWelch(seqs, K, S, maxIters = 200, tol = 1e-6) {
      let m = initModel(K, S),
        prev = -Infinity;
      for (let it = 0; it < maxIters; it++) {
        const pi_acc = Array(K).fill(0),
          A_acc = Array.from({ length: K }, () => Array(K).fill(0)),
          B_acc = Array.from({ length: K }, () => Array(S).fill(0));
        let total = 0;
        for (const obs of seqs) {
          const { alpha, c, loglik } = forwardScaled(m, obs);
          const beta = backwardScaled(m, obs, c);
          total += loglik;
          const T = obs.length;
          const gamma = Array.from({ length: T }, () => Array(K).fill(0));
          const xi = Array.from({ length: T - 1 }, () =>
            Array.from({ length: K }, () => Array(K).fill(0))
          );
          for (let t = 0; t < T; t++) {
            let den = 0;
            for (let i = 0; i < K; i++) den += alpha[t][i] * beta[t][i];
            if (den === 0) den = 1e-300;
            for (let i = 0; i < K; i++)
              gamma[t][i] = (alpha[t][i] * beta[t][i]) / den;
          }
          for (let t = 0; t < T - 1; t++) {
            let den = 0;
            for (let i = 0; i < K; i++)
              for (let j = 0; j < K; j++)
                den +=
                  alpha[t][i] * m.A[i][j] * m.B[j][obs[t + 1]] * beta[t + 1][j];
            if (den === 0) den = 1e-300;
            for (let i = 0; i < K; i++)
              for (let j = 0; j < K; j++)
                xi[t][i][j] =
                  (alpha[t][i] *
                    m.A[i][j] *
                    m.B[j][obs[t + 1]] *
                    beta[t + 1][j]) /
                  den;
          }
          for (let i = 0; i < K; i++) pi_acc[i] += gamma[0][i];
          for (let i = 0; i < K; i++) {
            let den = 0;
            for (let t = 0; t < T - 1; t++) den += gamma[t][i];
            if (den === 0) den = 1e-300;
            for (let j = 0; j < K; j++) {
              let num = 0;
              for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
              A_acc[i][j] += num / den;
            }
          }
          for (let i = 0; i < K; i++) {
            let den = 0;
            for (let t = 0; t < T; t++) den += gamma[t][i];
            if (den === 0) den = 1e-300;
            const btmp = Array(S).fill(0);
            for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
            for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / den;
          }
        }
        const norm = (row) => {
          const s = row.reduce((p, x) => p + x, 0);
          return s > 0 ? row.map((x) => x / s) : row.map(() => 1 / row.length);
        };
        m.pi = norm(pi_acc);
        for (let i = 0; i < K; i++) m.A[i] = norm(A_acc[i]);
        for (let i = 0; i < K; i++) m.B[i] = norm(B_acc[i]);
        if (
          it > 0 &&
          Math.abs(total - prev) < tol * Math.max(1, Math.abs(prev))
        )
          break;
        prev = total;
      }
      return m;
    }

    const model = baumWelch(sequences, K, S, MAX_ITERS, TOL);

    // Viterbi + LL/nObs
    const decodedViterbi = new Map();
    const cooc = Array.from({ length: 8 }, () => Array(K).fill(0));
    let nObs = 0,
      totalLL = 0;
    for (const [c, info] of perCountry.entries()) {
      const seq = info.seq;
      const obs = seq.map((d) => d.obs).filter((v) => v !== null);
      if (obs.length < 2) continue;
      nObs += obs.length;
      totalLL += forwardScaled(model, obs).loglik;

      const T = obs.length;
      const delta = Array.from({ length: T }, () => Array(K).fill(-Infinity));
      const psi = Array.from({ length: T }, () => Array(K).fill(0));
      for (let i = 0; i < K; i++) {
        delta[0][i] =
          Math.log(model.pi[i] || 1e-300) +
          Math.log(model.B[i][obs[0]] || 1e-300);
        psi[0][i] = 0;
      }
      for (let t = 1; t < T; t++)
        for (let j = 0; j < K; j++) {
          let best = -Infinity,
            arg = 0;
          for (let i = 0; i < K; i++) {
            const val =
              delta[t - 1][i] +
              Math.log(model.A[i][j] || 1e-300) +
              Math.log(model.B[j][obs[t]] || 1e-300);
            if (val > best) {
              best = val;
              arg = i;
            }
          }
          delta[t][j] = best;
          psi[t][j] = arg;
        }
      let bestLast = -Infinity,
        qT = 0;
      for (let i = 0; i < K; i++)
        if (delta[T - 1][i] > bestLast) {
          bestLast = delta[T - 1][i];
          qT = i;
        }
      const path = Array(T).fill(0);
      path[T - 1] = qT;
      for (let t = T - 2; t >= 0; t--) path[t] = psi[t + 1][path[t + 1]];
      const yearsT1 = [];
      let k = 0;
      for (const d of seq) {
        if (d.obs === null) continue;
        yearsT1.push(d.year);
        cooc[d.obs][path[k]] += 1;
        k++;
      }
      decodedViterbi.set(c, { yearsT1, path });
    }
    const TAPIO_LABELS_LOCAL = [
      "SD",
      "WD",
      "EC",
      "END",
      "RD",
      "RC",
      "RND",
      "SND"
    ];
    const regimeLabels = (() => {
      const out = [];
      for (let r = 0; r < K; r++) {
        const col = cooc.map((row) => row[r]);
        const top = col
          .map((v, i) => [i, v])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2);
        out.push(top.map(([i]) => TAPIO_LABELS_LOCAL[i]));
      }
      return out;
    })();

    const colors = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ].slice(0, K);
    return {
      model,
      K,
      S,
      years,
      TAPIO_LABELS: TAPIO_LABELS_LOCAL,
      regimeLabels,
      perCountry,
      decodedViterbi,
      EU27,
      MCS4,
      sequences,
      loglik: totalLL,
      nObs,
      colors,
      helpers: { forwardScaled, backwardScaled }
    };
  }

  // ---------- usar hmm_shared si existe (lectura segura); si no, fallback ----------
  const baseCandidate = readMaybe("hmm_shared"); // << sin dependencia estática
  const base =
    baseCandidate && !baseCandidate.error
      ? baseCandidate
      : buildSharedFallback();
  if (!base || base.error)
    return html`<div style="color:#900;padding:12px;">${
      base?.error || "No se pudo construir el HMM."
    }</div>`;

  const {
    model,
    K,
    S,
    perCountry,
    decodedViterbi,
    EU27,
    MCS4,
    sequences,
    loglik,
    nObs,
    helpers,
    colors
  } = base;
  const { forwardScaled, backwardScaled } = helpers;

  // ---------- parámetro bootstrap B (lectura segura) ----------
  const bootCandidate = readMaybe("hmmBootB");
  const B = Number.isFinite(+bootCandidate)
    ? Math.max(100, +bootCandidate | 0)
    : 500;

  // ---------- shares por bloque usando posteriors γ ----------
  function gammaSharesByBloc(blocList) {
    const sum = Array(K).fill(0);
    let denom = 0;
    for (const c of blocList) {
      const info = perCountry.get(c),
        dec = decodedViterbi.get(c);
      if (!info || !dec) continue;
      const obs = info.seq.map((x) => x.obs).filter((x) => x !== null);
      if (obs.length < 2) continue;
      const { alpha, c: scale } = forwardScaled(model, obs);
      const beta = backwardScaled(model, obs, scale);
      for (let t = 0; t < obs.length; t++) {
        let d = 0;
        for (let i = 0; i < K; i++) d += alpha[t][i] * beta[t][i];
        if (d === 0) d = 1e-300;
        for (let k = 0; k < K; k++) sum[k] += (alpha[t][k] * beta[t][k]) / d;
        denom += 1;
      }
    }
    if (denom === 0) return Array(K).fill(0);
    return sum.map((v) => v / denom);
  }
  const shareEU = gammaSharesByBloc(EU27);
  const shareMCS = gammaSharesByBloc(MCS4);
  const gap = shareEU.map((v, i) => v - shareMCS[i]);

  // ---------- bootstrap por país (cluster) ----------
  function bootstrapBloc(blocList) {
    const list = blocList.filter((c) => perCountry.has(c));
    const draws = [];
    for (let b = 0; b < B; b++) {
      const sample = Array.from(
        { length: list.length },
        () => list[Math.floor(Math.random() * list.length)]
      );
      draws.push(gammaSharesByBloc(sample));
    }
    return draws; // [B][K]
  }
  function quantile(arr, q) {
    const a = arr.slice().sort((x, y) => x - y);
    const p = (a.length - 1) * q;
    const lo = Math.floor(p),
      hi = Math.ceil(p);
    if (lo === hi) return a[lo];
    const h = p - lo;
    return a[lo] * (1 - h) + a[hi] * h;
  }

  const bootEU = bootstrapBloc(EU27);
  const bootMCS = bootstrapBloc(MCS4);

  const ciEU = Array.from({ length: K }, (_, k) => [
    quantile(
      bootEU.map((v) => v[k]),
      0.025
    ),
    quantile(
      bootEU.map((v) => v[k]),
      0.975
    )
  ]);
  const ciMCS = Array.from({ length: K }, (_, k) => [
    quantile(
      bootMCS.map((v) => v[k]),
      0.025
    ),
    quantile(
      bootMCS.map((v) => v[k]),
      0.975
    )
  ]);
  const gapCI = Array.from({ length: K }, (_, k) => {
    const diff = bootEU.map((v, i) => v[k] - bootMCS[i % bootMCS.length][k]);
    return [quantile(diff, 0.025), quantile(diff, 0.975)];
  });

  // ---------- tabla de shares + IC ----------
  const tbl = html`<table style="border-collapse:collapse;font:13px system-ui;">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Regime</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ddd;">EU-27 Share</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ddd;">MERCOSUR Share</th>
        <th style="padding:6px 8px;border-bottom:1px solid #ddd;">Gap (EU−MERC)</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(
        { length: K },
        (_, k) => html`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;"><span style="display:inline-block;width:10px;height:10px;background:${
          colors[k]
        };margin-right:6px;"></span>R${k + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(
          shareEU[k] * 100
        ).toFixed(1)}% <span style="color:#666;">[${(ciEU[k][0] * 100).toFixed(
          1
        )}, ${(ciEU[k][1] * 100).toFixed(1)}]</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(
          shareMCS[k] * 100
        ).toFixed(1)}% <span style="color:#666;">[${(ciMCS[k][0] * 100).toFixed(
          1
        )}, ${(ciMCS[k][1] * 100).toFixed(1)}]</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${(
          gap[k] * 100
        ).toFixed(1)}% <span style="color:#666;">[${(gapCI[k][0] * 100).toFixed(
          1
        )}, ${(gapCI[k][1] * 100).toFixed(1)}]</span></td>
      </tr>`
      )}
    </tbody>
  </table>`;

  // ---------- LL y criterios (K=2–4) con el mismo conjunto de secuencias ----------
  function fitForK(Kalt) {
    function initModelK(K, S) {
      function RNG(seed = 123) {
        let s = seed >>> 0;
        return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
      }
      const r = RNG(42);
      const dir = (a) => {
        const x = a.map((v) => -Math.log(r()) / (v || 1));
        const s = x.reduce((p, v) => p + v, 0) || 1;
        return x.map((v) => v / s);
      };
      const nr = (v) => {
        const s = v.reduce((p, x) => p + x, 0);
        return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
      };
      const pi = dir(Array(K).fill(1));
      const A = Array.from({ length: K }, () => nr(dir(Array(K).fill(1))));
      const B = Array.from({ length: K }, () => nr(dir(Array(S).fill(1))));
      return { K, S, pi, A, B };
    }
    let m = initModelK(Kalt, S),
      prev = -Infinity;
    for (let it = 0; it < 200; it++) {
      const pi_acc = Array(Kalt).fill(0),
        A_acc = Array.from({ length: Kalt }, () => Array(Kalt).fill(0)),
        B_acc = Array.from({ length: Kalt }, () => Array(S).fill(0));
      let total = 0;
      for (const obs of base.sequences) {
        const { alpha, c, loglik } = base.helpers.forwardScaled(m, obs);
        const beta = base.helpers.backwardScaled(m, obs, c);
        total += loglik;
        const T = obs.length;
        const gamma = Array.from({ length: T }, () => Array(Kalt).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
          Array.from({ length: Kalt }, () => Array(Kalt).fill(0))
        );
        for (let t = 0; t < T; t++) {
          let den = 0;
          for (let i = 0; i < Kalt; i++) den += alpha[t][i] * beta[t][i];
          if (den === 0) den = 1e-300;
          for (let i = 0; i < Kalt; i++)
            gamma[t][i] = (alpha[t][i] * beta[t][i]) / den;
        }
        for (let t = 0; t < T - 1; t++) {
          let den = 0;
          for (let i = 0; i < Kalt; i++)
            for (let j = 0; j < Kalt; j++)
              den +=
                alpha[t][i] * m.A[i][j] * m.B[j][obs[t + 1]] * beta[t + 1][j];
          if (den === 0) den = 1e-300;
          for (let i = 0; i < Kalt; i++)
            for (let j = 0; j < Kalt; j++)
              xi[t][i][j] =
                (alpha[t][i] *
                  m.A[i][j] *
                  m.B[j][obs[t + 1]] *
                  beta[t + 1][j]) /
                den;
        }
        for (let i = 0; i < Kalt; i++) pi_acc[i] += gamma[0][i];
        for (let i = 0; i < Kalt; i++) {
          let den = 0;
          for (let t = 0; t < T - 1; t++) den += gamma[t][i];
          if (den === 0) den = 1e-300;
          for (let j = 0; j < Kalt; j++) {
            let num = 0;
            for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
            A_acc[i][j] += num / den;
          }
        }
        for (let i = 0; i < Kalt; i++) {
          let den = 0;
          for (let t = 0; t < T; t++) den += gamma[t][i];
          if (den === 0) den = 1e-300;
          const btmp = Array(S).fill(0);
          for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
          for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / den;
        }
      }
      const norm = (row) => {
        const s = row.reduce((p, x) => p + x, 0);
        return s > 0 ? row.map((x) => x / s) : row.map(() => 1 / row.length);
      };
      m.pi = norm(pi_acc);
      for (let i = 0; i < Kalt; i++) m.A[i] = norm(A_acc[i]);
      for (let i = 0; i < Kalt; i++) m.B[i] = norm(B_acc[i]);
      if (it > 0 && Math.abs(total - prev) < 1e-6 * Math.max(1, Math.abs(prev)))
        break;
      prev = total;
    }
    let LL = 0;
    for (const obs of base.sequences)
      LL += base.helpers.forwardScaled(m, obs).loglik;
    const params = Kalt - 1 + Kalt * (Kalt - 1) + Kalt * (S - 1);
    const AIC = -2 * LL + 2 * params;
    const BIC = -2 * LL + Math.log(Math.max(1, base.nObs)) * params;
    return { K: Kalt, LL, params, AIC, BIC };
  }

  const icRows = [2, 3, 4].map(fitForK);

  const icTable = html`<table style="border-collapse:collapse;font:13px system-ui;margin-top:12px;">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">K</th>
      <th style="padding:6px 8px;border-bottom:1px solid #ddd;">Log-likelihood</th>
      <th style="padding:6px 8px;border-bottom:1px solid #ddd;">Params</th>
      <th style="padding:6px 8px;border-bottom:1px solid #ddd;">AIC</th>
      <th style="padding:6px 8px;border-bottom:1px solid #ddd;">BIC</th>
    </tr></thead>
    <tbody>
      ${icRows.map(
        (r) => html`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${r.K}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${r.LL.toFixed(
          1
        )}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${
          r.params
        }</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${r.AIC.toFixed(
          1
        )}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${r.BIC.toFixed(
          1
        )}</td>
      </tr>`
      )}
    </tbody>
  </table>`;

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.appendChild(
    html`<h3 style="margin:0 0 8px 0;">Tab. R2 — Regime shares by bloc (posterior-weighted) with 95% bootstrap CIs (B=${B})</h3>`
  );
  wrap.appendChild(tbl);
  wrap.appendChild(
    html`<h3 style="margin:18px 0 8px 0;">Model fit (K=2–4) — log-likelihood and information criteria</h3>`
  );
  wrap.appendChild(icTable);
  return wrap;
}


function _HMM_shared(globalThis,longData,yearStart,yearEnd,driverFlow,extMode,tapioTol,tapioClassify)
{
  // -------- utilidades seguras para leer globals --------
  const readMaybe = (n, def = null) => {
    try {
      return typeof globalThis[n] !== "undefined" ? globalThis[n] : def;
    } catch {
      return def;
    }
  };
  const numFromGlobal = (
    k,
    def,
    { min = -Infinity, max = Infinity, int = false } = {}
  ) => {
    const v = readMaybe(k, def);
    const n = typeof v === "number" || typeof v === "string" ? +v : def;
    if (!Number.isFinite(n)) return def;
    let x = int ? Math.trunc(n) : n;
    return Math.max(min, Math.min(max, x));
  };

  if (!Array.isArray(longData) || !longData.length)
    return { error: "No hay longData." };

  // -------- parámetros del modelo --------
  const K = numFromGlobal("hmmK", 3, { min: 2, int: true });
  const MAX_ITERS = numFromGlobal("hmmMaxIters", 300, { min: 1, int: true });
  const TOL = numFromGlobal("hmmTol", 1e-6, { min: 1e-12, max: 1e-1 });
  const SEED = numFromGlobal("hmmSeed", 42, { int: true });
  const BBOOT = Number.isFinite(+readMaybe("hmmBootB"))
    ? Math.max(100, +readMaybe("hmmBootB") | 0)
    : 300;

  const y0 =
    typeof yearStart !== "undefined"
      ? +yearStart
      : Math.min(...longData.map((d) => d.year));
  const y1 =
    typeof yearEnd !== "undefined"
      ? +yearEnd
      : Math.max(...longData.map((d) => d.year));
  const yearsAll = [
    ...new Set(longData.map((d) => d.year).filter((y) => y >= y0 && y <= y1))
  ].sort((a, b) => a - b);

  // -------- flows (impacto y driver) --------
  const flowsSet = new Set(longData.map((d) => d.flow));
  const driver =
    typeof driverFlow !== "undefined"
      ? driverFlow
      : flowsSet.has("GDP")
      ? "GDP"
      : [...flowsSet][0];
  let impactFlow = "MF";
  if (typeof extMode !== "undefined" && extMode === "MF/cap − DMC/cap")
    impactFlow = flowsSet.has("MF/cap")
      ? "MF/cap"
      : flowsSet.has("MF")
      ? "MF"
      : "MF";
  else
    impactFlow = flowsSet.has("MF")
      ? "MF"
      : flowsSet.has("MF/cap")
      ? "MF/cap"
      : "MF";

  // -------- bloques (con fallback) --------
  const EU_STATIC = [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czechia",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden"
  ];
  const MCS_STATIC = ["Argentina", "Brazil", "Paraguay", "Uruguay"];
  const blocsObj = readMaybe("blocsResolved") || readMaybe("blocs");
  const fromBlocs = (obj, keys) => {
    if (!obj) return null;
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v) && v.length) return v.slice();
    }
    return null;
  };
  const dataCountries = new Set(longData.map((d) => d.country));
  const EU27 = (
    readMaybe("countriesUE") ||
    fromBlocs(blocsObj, ["EU-27", "EU27", "European Union", "EU"]) ||
    EU_STATIC
  ).filter((c) => dataCountries.has(c));
  const MCS4 = (
    readMaybe("countriesMCS") ||
    fromBlocs(blocsObj, ["Mercosur", "MERCOSUR"]) ||
    MCS_STATIC
  ).filter((c) => dataCountries.has(c));

  // -------- índice country→flow→year --------
  const byCF = (() => {
    const m = new Map();
    for (const d of longData) {
      if (d.year < y0 || d.year > y1) continue;
      let mC = m.get(d.country);
      if (!mC) {
        mC = new Map();
        m.set(d.country, mC);
      }
      let mF = mC.get(d.flow);
      if (!mF) {
        mF = new Map();
        mC.set(d.flow, mF);
      }
      mF.set(d.year, +d.value);
    }
    return m;
  })();
  const safeGet = (c, f, y) => {
    const mC = byCF.get(c);
    if (!mC) return NaN;
    const mF = mC.get(f);
    if (!mF) return NaN;
    const v = mF.get(y);
    return Number.isFinite(v) ? v : NaN;
  };

  // -------- Tapio (8 estados) --------
  const TAPIO_LABELS = ["SD", "WD", "EC", "END", "RD", "RC", "RND", "SND"];
  const TAPIO_TO_INT = new Map(TAPIO_LABELS.map((s, i) => [s, i]));
  const tapioTolVal = typeof tapioTol !== "undefined" ? +tapioTol : 0.2;
  const tapioClass =
    typeof tapioClassify === "function"
      ? tapioClassify
      : (gI, gY, tol = tapioTolVal) => {
          const e = gY !== 0 ? gI / gY : NaN;
          if (gY > 0)
            return gI < 0
              ? "SD"
              : e < 1 - tol
              ? "WD"
              : Math.abs(e - 1) <= tol
              ? "EC"
              : "END";
          if (gY < 0)
            return gI > 0
              ? "SND"
              : e < 1 - tol
              ? "RD"
              : Math.abs(e - 1) <= tol
              ? "RC"
              : "RND";
          return gI < 0 ? "SD" : gI > 0 ? "RND" : "RC";
        };

  function tapioSequenceFor(country) {
    const seq = [];
    for (let i = 1; i < yearsAll.length; i++) {
      const t0 = yearsAll[i - 1],
        t1 = yearsAll[i];
      const I0 = safeGet(country, impactFlow, t0),
        I1 = safeGet(country, impactFlow, t1);
      const Y0 = safeGet(country, driver, t0),
        Y1 = safeGet(country, driver, t1);
      if (![I0, I1, Y0, Y1].every(Number.isFinite) || I0 === 0 || Y0 === 0) {
        seq.push({ year: t1, label: "NA", obs: null });
        continue;
      }
      const gI = (I1 - I0) / I0,
        gY = (Y1 - Y0) / Y0;
      const lab = tapioClass(gI, gY, tapioTolVal);
      seq.push({ year: t1, label: lab, obs: TAPIO_TO_INT.get(lab) ?? null });
    }
    return seq;
  }

  // -------- secuencias y entrenamiento --------
  const trainingPool = [...new Set([...EU27, ...MCS4])];
  const ctries = trainingPool.length
    ? trainingPool
    : [...new Set(longData.map((d) => d.country))];
  const S = TAPIO_LABELS.length;
  const sequences = [],
    perCountry = new Map();
  for (const c of ctries) {
    const s = tapioSequenceFor(c);
    const obs = s.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length >= 6) {
      sequences.push(obs);
      perCountry.set(c, { seq: s, obsClean: obs });
    }
  }
  if (!sequences.length) return { error: "No hay secuencias Tapio válidas." };

  // RNG/Dirichlet
  function RNG(seed = 1234) {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  }
  const rand = RNG(SEED);
  const dirichlet = (a) => {
    const x = a.map((v) => -Math.log(rand()) / (v || 1));
    const sum = x.reduce((p, v) => p + v, 0) || 1;
    return x.map((v) => v / sum);
  };
  const normRow = (v) => {
    const s = v.reduce((p, x) => p + x, 0);
    return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
  };

  function initModel(K, S) {
    const pi = dirichlet(Array(K).fill(1));
    const A = Array.from({ length: K }, () =>
      normRow(dirichlet(Array(K).fill(1)))
    );
    const B = Array.from({ length: K }, () =>
      normRow(dirichlet(Array(S).fill(1)))
    );
    return { K, S, pi, A, B };
  }
  function forwardScaled(m, obs) {
    const { K, B, A, pi } = m,
      T = obs.length;
    const alpha = Array.from({ length: T }, () => Array(K).fill(0)),
      c = Array(T).fill(0);
    for (let i = 0; i < K; i++) {
      alpha[0][i] = pi[i] * B[i][obs[0]];
      c[0] += alpha[0][i];
    }
    if (c[0] === 0) c[0] = 1e-300;
    for (let i = 0; i < K; i++) alpha[0][i] /= c[0];
    for (let t = 1; t < T; t++) {
      let ct = 0;
      for (let j = 0; j < K; j++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * A[i][j];
        const val = sum * B[j][obs[t]];
        alpha[t][j] = val;
        ct += val;
      }
      if (ct === 0) ct = 1e-300;
      c[t] = ct;
      for (let j = 0; j < K; j++) alpha[t][j] /= ct;
    }
    const loglik = -c.map((v) => Math.log(v)).reduce((p, v) => p + v, 0);
    return { alpha, c, loglik };
  }
  function backwardScaled(m, obs, c) {
    const { K, B, A } = m,
      T = obs.length;
    const beta = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) beta[T - 1][i] = 1 / c[T - 1];
    for (let t = T - 2; t >= 0; t--)
      for (let i = 0; i < K; i++) {
        let s = 0;
        for (let j = 0; j < K; j++)
          s += A[i][j] * B[j][obs[t + 1]] * beta[t + 1][j];
        beta[t][i] = s / c[t];
      }
    return beta;
  }
  function baumWelch(seqs, K, S, maxIters = 200, tol = 1e-6) {
    let m = initModel(K, S),
      prev = -Infinity;
    for (let it = 0; it < maxIters; it++) {
      const pi_acc = Array(K).fill(0),
        A_acc = Array.from({ length: K }, () => Array(K).fill(0)),
        B_acc = Array.from({ length: K }, () => Array(S).fill(0));
      let total = 0;
      for (const obs of seqs) {
        const { alpha, c, loglik } = forwardScaled(m, obs);
        const beta = backwardScaled(m, obs, c);
        total += loglik;
        const T = obs.length;
        const gamma = Array.from({ length: T }, () => Array(K).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
          Array.from({ length: K }, () => Array(K).fill(0))
        );
        for (let t = 0; t < T; t++) {
          let den = 0;
          for (let i = 0; i < K; i++) den += alpha[t][i] * beta[t][i];
          if (den === 0) den = 1e-300;
          for (let i = 0; i < K; i++)
            gamma[t][i] = (alpha[t][i] * beta[t][i]) / den;
        }
        for (let t = 0; t < T - 1; t++) {
          let den = 0;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              den +=
                alpha[t][i] * m.A[i][j] * m.B[j][obs[t + 1]] * beta[t + 1][j];
          if (den === 0) den = 1e-300;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              xi[t][i][j] =
                (alpha[t][i] *
                  m.A[i][j] *
                  m.B[j][obs[t + 1]] *
                  beta[t + 1][j]) /
                den;
        }
        for (let i = 0; i < K; i++) pi_acc[i] += gamma[0][i];
        for (let i = 0; i < K; i++) {
          let den = 0;
          for (let t = 0; t < T - 1; t++) den += gamma[t][i];
          den = den || 1e-300;
          for (let j = 0; j < K; j++) {
            let num = 0;
            for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
            A_acc[i][j] += num / den;
          }
        }
        for (let i = 0; i < K; i++) {
          let den = 0;
          for (let t = 0; t < T; t++) den += gamma[t][i];
          den = den || 1e-300;
          const btmp = Array(S).fill(0);
          for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
          for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / den;
        }
      }
      const norm = (row) => {
        const s = row.reduce((p, x) => p + x, 0);
        return s > 0 ? row.map((x) => x / s) : row.map(() => 1 / row.length);
      };
      m.pi = norm(pi_acc);
      for (let i = 0; i < K; i++) m.A[i] = norm(A_acc[i]);
      for (let i = 0; i < K; i++) m.B[i] = norm(B_acc[i]);
      if (it > 0 && Math.abs(total - prev) < tol * Math.max(1, Math.abs(prev)))
        break;
      prev = total;
    }
    return m;
  }

  const model = baumWelch(sequences, K, S, MAX_ITERS, TOL);

  // -------- Viterbi, co-ocurrencias y rótulos --------
  const decodedViterbi = new Map(),
    cooc = Array.from({ length: S }, () => Array(K).fill(0));
  let nObs = 0; // para IC
  for (const [c, info] of perCountry.entries()) {
    const obs = info.seq.map((d) => d.obs).filter((v) => v !== null);
    if (obs.length < 2) continue;
    nObs += obs.length;
    // Viterbi
    const T = obs.length,
      delta = Array.from({ length: T }, () => Array(K).fill(-Infinity)),
      psi = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) {
      delta[0][i] =
        Math.log(model.pi[i] || 1e-300) +
        Math.log(model.B[i][obs[0]] || 1e-300);
      psi[0][i] = 0;
    }
    for (let t = 1; t < T; t++)
      for (let j = 0; j < K; j++) {
        let best = -Infinity,
          arg = 0;
        for (let i = 0; i < K; i++) {
          const val =
            delta[t - 1][i] +
            Math.log(model.A[i][j] || 1e-300) +
            Math.log(model.B[j][obs[t]] || 1e-300);
          if (val > best) {
            best = val;
            arg = i;
          }
        }
        delta[t][j] = best;
        psi[t][j] = arg;
      }
    let bestLast = -Infinity,
      qT = 0;
    for (let i = 0; i < K; i++)
      if (delta[T - 1][i] > bestLast) {
        bestLast = delta[T - 1][i];
        qT = i;
      }
    const path = Array(T).fill(0);
    path[T - 1] = qT;
    for (let t = T - 2; t >= 0; t--) path[t] = psi[t + 1][path[t + 1]];

    const yearsT1 = [],
      seq = info.seq;
    let kidx = 0;
    for (const d of seq) {
      if (d.obs === null) continue;
      yearsT1.push(d.year);
      cooc[d.obs][path[kidx]] += 1;
      kidx++;
    }
    decodedViterbi.set(c, { yearsT1, path });
  }
  const regimeLabels = (() => {
    const out = [];
    for (let r = 0; r < K; r++) {
      const col = cooc.map((row) => row[r]);
      const top = col
        .map((v, i) => [i, v])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      out.push(top.map(([i]) => TAPIO_LABELS[i]));
    }
    return out;
  })();

  const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"].slice(
    0,
    K
  );

  // -------- estacionaria y permanencias --------
  function stationaryLeft(A, tol = 1e-10, maxit = 10000) {
    let x = Array(A.length).fill(1 / A.length);
    for (let it = 0; it < maxit; it++) {
      const nx = Array(A.length).fill(0);
      for (let i = 0; i < A.length; i++)
        for (let j = 0; j < A.length; j++) nx[j] += x[i] * A[i][j];
      const diff = nx.reduce((p, v, i) => p + Math.abs(v - x[i]), 0);
      x = nx;
      if (diff < tol) break;
    }
    const s = x.reduce((p, v) => p + v, 0) || 1;
    return x.map((v) => v / s);
  }
  const piStar = stationaryLeft(model.A);
  const dwell = Array.from(
    { length: K },
    (_, i) => 1 / Math.max(1e-9, 1 - model.A[i][i])
  );

  // -------- γ por país (para Fig. R6 y Tab. R2) --------
  function gammasByCountry() {
    const out = new Map();
    for (const [c, inf] of perCountry.entries()) {
      const obs = inf.seq.map((x) => x.obs).filter((x) => x !== null);
      if (obs.length < 2 || !decodedViterbi.has(c)) continue;
      const { alpha, c: scale } = forwardScaled(model, obs);
      const beta = backwardScaled(model, obs, scale);
      const T = obs.length;
      const g = Array.from({ length: T }, () => Array(K).fill(0));
      for (let t = 0; t < T; t++) {
        let den = 0;
        for (let i = 0; i < K; i++) den += alpha[t][i] * beta[t][i];
        if (!den) den = 1e-300;
        for (let k = 0; k < K; k++) g[t][k] = (alpha[t][k] * beta[t][k]) / den;
      }
      out.set(c, {
        years: decodedViterbi.get(c).yearsT1.slice(0, T),
        gamma: g
      });
    }
    return out;
  }
  const GAM = gammasByCountry();

  return {
    K,
    S,
    model,
    EU27,
    MCS4,
    yearsAll,
    perCountry,
    decodedViterbi,
    regimeLabels,
    colors,
    piStar,
    dwell,
    GAM,
    TAPIO_LABELS,
    tapioTolVal,
    BBOOT,
    nObs,
    driver,
    impactFlow
  };
}


function _Fig_R3_emissions(HMM_shared,html,Plotly)
{
  if (HMM_shared.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;
  const { model, K, regimeLabels, TAPIO_LABELS } = HMM_shared;

  const z = Array.from({ length: TAPIO_LABELS.length }, (_, s) =>
    Array.from({ length: K }, (_, k) => model.B[k][s])
  );
  const x = Array.from(
    { length: K },
    (_, k) => `Regime ${k + 1} (${regimeLabels[k].join("/")})`
  );
  const y = TAPIO_LABELS;

  const el = document.createElement("div");
  el.style.width = "100%";
  el.style.height = "420px";
  Plotly.newPlot(
    el,
    [
      {
        type: "heatmap",
        z,
        x,
        y,
        colorscale: "Viridis",
        zmin: 0,
        zmax: 1,
        hovertemplate: "%{y} → %{x}<br>P=%{z:.3f}<extra></extra>"
      }
    ],
    {
      template: "plotly_white",
      margin: { t: 60, r: 16, b: 80, l: 56 },
      title: {
        text: "",
        x: 0,
        xanchor: "left"
      }
    },
    { displaylogo: false, responsive: true }
  );
  return el;
}


function _Fig_R4_transitions(HMM_shared,html,Plotly)
{
  if (HMM_shared.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;
  const { model, K, regimeLabels, dwell } = HMM_shared;

  const THR = 0.03;
  const nodes = Array.from(
    { length: K },
    (_, k) => `R${k + 1} (${regimeLabels[k].join("/")})`
  );
  const src = [],
    tgt = [],
    val = [],
    lab = [];
  for (let i = 0; i < K; i++)
    for (let j = 0; j < K; j++)
      if (model.A[i][j] >= THR) {
        src.push(i);
        tgt.push(j);
        val.push(model.A[i][j]);
        lab.push(`A[${i + 1}→${j + 1}] = ${model.A[i][j].toFixed(3)}`);
      }
  const nodeLabel = nodes.map(
    (n, i) => `${n} — dwell: ${dwell[i].toFixed(1)} yrs`
  );

  const el = document.createElement("div");
  el.style.width = "100%";
  el.style.height = "520px";
  Plotly.newPlot(
    el,
    [
      {
        type: "sankey",
        orientation: "h",
        node: { label: nodeLabel, pad: 18, thickness: 16 },
        link: { source: src, target: tgt, value: val, label: lab }
      }
    ],
    {
      template: "plotly_white",
      margin: { t: 60, r: 16, b: 80, l: 56 },
      title: {
        text: "Figure R4. Transition structure (A) and average dwell times (both blocs)",
        x: 0,
        xanchor: "left"
      }
    },
    { displaylogo: false, responsive: true }
  );
  return el;
}


function _Fig_R5_decoded_heatmaps(HMM_shared,html,Plotly)
{
  if (HMM_shared.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;

  const { EU27, MCS4, decodedViterbi, K, colors } = HMM_shared;

  // Función original para crear el mapeo de colores exacto
  const createColorScale = () => {
    const domain = Array.from({ length: K }, (_, i) => i / (K - 1));
    return domain.map((d, i) => [d, colors[i]]);
  };

  // Preparación de datos con numeración 1-based para los regímenes
  const createHeatmapData = (countryList) => {
    const countries = countryList.filter((c) => decodedViterbi.has(c));
    const years = [...decodedViterbi.get(countries[0]).yearsT1];

    const z = countries.map((c) => {
      const { path } = decodedViterbi.get(c);
      return path.map((k) => k + 1); // Convertir a R1, R2,...
    });

    return { countries, years, z };
  };

  // Función principal para crear cada heatmap
  const makeHeatmap = (title, data) => {
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginBottom = "40px";
    container.appendChild(
      html`<h3 style="margin:16px 0 10px 0;">${title}</h3>`
    );

    // Contenedor principal con flex para gráfico y leyenda
    const plotContainer = document.createElement("div");
    plotContainer.style.display = "flex";
    plotContainer.style.width = "100%";

    // Contenedor para el gráfico
    const chartWrapper = document.createElement("div");
    chartWrapper.style.flex = "1";
    chartWrapper.style.minWidth = "0"; // Evita desbordamiento

    // Altura dinámica basada en número de países
    const plotHeight = Math.max(300, data.countries.length * 30 + 100);

    const plotDiv = document.createElement("div");
    plotDiv.style.width = "100%";
    plotDiv.style.height = `${plotHeight}px`;

    // Configuración original del heatmap
    const trace = {
      x: data.years,
      y: data.countries,
      z: data.z,
      type: "heatmap",
      colorscale: createColorScale(),
      zmin: 1,
      zmax: K,
      showscale: false, // Deshabilitamos la leyenda de Plotly
      hoverinfo: "x+y+z",
      hovertemplate:
        "<b>%{y}</b><br>Year: %{x}<br>Regime: R%{z}<extra></extra>",
      xgap: 1,
      ygap: 1
    };

    const layout = {
      title: {
        text: "", // Quitamos título interno ya que lo tenemos externo
        x: 0.05,
        xanchor: "left",
        font: { size: 14 }
      },
      xaxis: {
        tickangle: -45,
        automargin: true,
        tickfont: { size: 10 },
        showgrid: false
      },
      yaxis: {
        automargin: true,
        tickfont: { size: 11 },
        showgrid: false,
        categoryorder: "array",
        categoryarray: data.countries
      },
      margin: { t: 30, r: 20, b: 60, l: 120 }
    };

    const config = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d"]
    };

    Plotly.newPlot(plotDiv, [trace], layout, config);
    chartWrapper.appendChild(plotDiv);
    plotContainer.appendChild(chartWrapper);

    // Leyenda vertical al costado (manteniendo colores originales)
    const legend = document.createElement("div");
    legend.style.display = "flex";
    legend.style.flexDirection = "column";
    legend.style.marginLeft = "15px";
    legend.style.justifyContent = "center";
    legend.style.alignItems = "flex-start";
    legend.style.minWidth = "80px";

    for (let k = 0; k < K; k++) {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.margin = "5px 0";

      item.appendChild(html`
        <div style="display:flex; align-items:center;">
          <div style="width:20px; height:20px; background:${
            colors[k]
          }; border:1px solid #ccc; margin-right:8px;"></div>
          <span style="font-size:13px;">R${k + 1}</span>
        </div>
      `);

      legend.appendChild(item);
    }

    plotContainer.appendChild(legend);
    container.appendChild(plotContainer);

    return container;
  };

  // Creación y visualización de ambos heatmaps
  const out = document.createElement("div");
  out.style.width = "100%";

  out.appendChild(
    makeHeatmap("Fig. R5 — EU-27: Decoded Regimes", createHeatmapData(EU27))
  );

  out.appendChild(
    makeHeatmap(
      "Fig. R5 — MERCOSUR-4: Decoded Regimes",
      createHeatmapData(MCS4)
    )
  );

  return out;
}


function _Fig_R6_bands_filled_fullbleed(HMM_shared,html,Plotly)
{
  if (HMM_shared?.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;

  // --- inyectar estilo full-bleed (una sola vez) ---
  if (!document.getElementById("fullbleed-style")) {
    const st = document.createElement("style");
    st.id = "fullbleed-style";
    st.textContent = `
      .fullbleed {
        width: 100vw;
        margin-left: calc(50% - 50vw);
        margin-right: calc(50% - 50vw);
      }
    `;
    document.head.appendChild(st);
  }

  const { GAM, EU27, MCS4, K, colors, BBOOT } = HMM_shared;

  // ---------- controles visuales (ajustables) ----------
  const BAND_ALPHA = 0.35; // 0.35–0.55 suele verse bien
  const BAND_OUTLINE = 0.6; // 0–0.8 para un borde sutil
  const MEAN_WIDTH = 2.2; // grosor de la línea media
  const PANEL_H = 460; // alto px por panel

  const withAlpha = (hex, a) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16),
      g = parseInt(m[2], 16),
      b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  // ---------- estadísticas por bloque (media + IC bootstrap 95%) ----------
  function bandsFor(bloc) {
    const elig = bloc.filter((c) => GAM.has(c));
    const xs = [...new Set(elig.flatMap((c) => GAM.get(c).years))].sort(
      (a, b) => a - b
    );

    const mean = Array.from({ length: K }, () => xs.map(() => NaN));
    const lo = Array.from({ length: K }, () => xs.map(() => NaN));
    const hi = Array.from({ length: K }, () => xs.map(() => NaN));

    const q = (arr, p) => {
      const a = arr.slice().sort((x, y) => x - y);
      const r = (a.length - 1) * p,
        i = Math.floor(r),
        j = Math.ceil(r);
      return i === j ? a[i] : a[i] * (1 - (r - i)) + a[j] * (r - i);
    };

    for (let ti = 0; ti < xs.length; ti++) {
      const y = xs[ti];
      const mats = elig
        .map((c) => {
          const { years, gamma } = GAM.get(c);
          const idx = years.indexOf(y);
          return idx >= 0 ? gamma[idx] : null;
        })
        .filter(Boolean);

      if (!mats.length) continue;

      for (let k = 0; k < K; k++) {
        const vals = mats.map((v) => v[k]);
        mean[k][ti] = vals.reduce((p, v) => p + v, 0) / vals.length;

        // bootstrap entre países (B = BBOOT)
        const draws = [];
        for (let b = 0; b < BBOOT; b++) {
          const sample = Array.from(
            { length: mats.length },
            () => mats[Math.floor(Math.random() * mats.length)]
          );
          draws.push(sample.reduce((p, g) => p + g[k], 0) / sample.length);
        }
        lo[k][ti] = q(draws, 0.025);
        hi[k][ti] = q(draws, 0.975);
      }
    }
    return { xs, mean, lo, hi };
  }

  // ---------- renderer (bandas rellenas + línea media) ----------
  function render(title, bloc) {
    const { xs, mean, lo, hi } = bandsFor(bloc);

    const el = document.createElement("div");
    el.className = "fullbleed"; // ¡ancho completo!
    el.style.width = "100vw";
    el.style.height = `${PANEL_H}px`;
    el.style.margin = "0 0 56px 0";

    const traces = [];
    for (let k = 0; k < K; k++) {
      // Banda 95% (polígono relleno con alfa)
      traces.push({
        x: xs.concat([...xs].reverse()),
        y: hi[k].concat([...lo[k]].reverse()),
        type: "scatter",
        fill: "toself",
        fillcolor: withAlpha(colors[k], BAND_ALPHA),
        line: {
          width: BAND_OUTLINE,
          color: withAlpha(colors[k], Math.min(0.9, BAND_ALPHA + 0.2))
        },
        opacity: 1,
        name: `R${k + 1} 95%`,
        hoverinfo: "skip",
        showlegend: false
      });
      // Media (línea)
      traces.push({
        x: xs,
        y: mean[k],
        type: "scatter",
        mode: "lines",
        line: { width: MEAN_WIDTH, shape: "hv", color: colors[k] },
        name: `R${k + 1} mean`,
        hovertemplate: "<b>%{x}</b><br>P=%{y:.3f}<extra></extra>"
      });
    }

    const layout = {
      template: "plotly_white",
      title: { text: title, x: 0, xanchor: "left" },
      margin: { t: 60, r: 16, b: 140, l: 56 },
      xaxis: {
        title: "Year (t1)",
        tickangle: -90,
        automargin: true,
        tickfont: { size: 11 }
      },
      yaxis: { title: "Probability", range: [0, 1], tickformat: ".0%" },
      legend: { orientation: "h", x: 0, xanchor: "left", y: -0.28 },
      hovermode: "x unified"
    };

    Plotly.newPlot(el, traces, layout, {
      displaylogo: false,
      responsive: true,
      useResizeHandler: true
    });
    return el;
  }

  // ---------- salida (EU y MERCOSUR) sobre un root full-bleed ----------
  const root = this ?? html`<div class="fullbleed"></div>`;
  root.replaceChildren();
  root.appendChild(
    render(
      "Fig. R6 — EU-27: posterior regime probabilities with 95% bootstrap bands",
      EU27
    )
  );
  root.appendChild(
    render(
      "Fig. R6 — MERCOSUR-4: posterior regime probabilities with 95% bootstrap bands",
      MCS4
    )
  );
  return root;
}


function _Fig_R6_stackedFilled(HMM_shared,html,Plotly)
{
  if (HMM_shared.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;

  const { GAM, EU27, MCS4, K, colors, regimeLabels } = HMM_shared;

  // --- promedio por bloque (posteriores γ) y renormalización por año ---
  function meanGammas(bloc) {
    const elig = bloc.filter((c) => GAM.has(c));
    const xs = [...new Set(elig.flatMap((c) => GAM.get(c).years))].sort(
      (a, b) => a - b
    );

    // mean[k][t] = promedio de γ_k(t) entre países con dato
    const mean = Array.from({ length: K }, () => xs.map(() => 0));
    const nAtT = xs.map(() => 0);

    for (let ti = 0; ti < xs.length; ti++) {
      const y = xs[ti];
      const mats = elig
        .map((c) => {
          const { years, gamma } = GAM.get(c);
          const idx = years.indexOf(y);
          return idx >= 0 ? gamma[idx] : null;
        })
        .filter(Boolean);

      if (!mats.length) continue;
      nAtT[ti] = mats.length;

      for (let k = 0; k < K; k++) {
        mean[k][ti] = mats.reduce((p, g) => p + g[k], 0) / mats.length;
      }

      // renormalizar por robustez numérica (garantizar suma 1 exactamente)
      const s = mean.reduce((p, v) => p + v[ti], 0) || 1;
      for (let k = 0; k < K; k++) mean[k][ti] = mean[k][ti] / s;
    }
    return { xs, mean };
  }

  // --- renderer (áreas apiladas rellenas, sin bandas) ---
  function render(title, bloc) {
    const { xs, mean } = meanGammas(bloc);
    const el = document.createElement("div");
    el.style.width = "100%";
    el.style.height = "360px";
    el.style.margin = "0 0 44px 0";

    const traces = [];
    for (let k = 0; k < K; k++) {
      const name =
        regimeLabels && regimeLabels[k] && regimeLabels[k].length
          ? `Regime ${k + 1} (${regimeLabels[k].join("/")})`
          : `Regime ${k + 1}`;

      traces.push({
        x: xs,
        y: mean[k],
        type: "scatter",
        mode: "lines",
        line: { width: 1.2, shape: "hv", color: colors[k] },
        fill: "tonexty",
        stackgroup: "one", // áreas apiladas
        name,
        hovertemplate:
          "<b>%{x}</b><br>%{fullData.name}<br>P=%{y:.3f}<extra></extra>"
      });
    }

    const layout = {
      template: "plotly_white",
      title: { text: title, x: 0, xanchor: "left" },
      margin: { t: 56, r: 16, b: 100, l: 56 },
      xaxis: {
        title: "Year (t1)",
        tickangle: -90,
        automargin: true,
        tickfont: { size: 11 }
      },
      yaxis: { title: "Probability", range: [0, 1], tickformat: ".0%" },
      legend: { orientation: "h", x: 0, xanchor: "left", y: -0.25 },
      hovermode: "x unified"
      // Si se desea forzar 100% visual aun con leves desajustes: groupnorm: 'fraction' en cada trace (no necesario aquí)
    };

    Plotly.newPlot(el, traces, layout, {
      displaylogo: false,
      responsive: true
    });
    return el;
  }

  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.appendChild(
    render(
      "Fig. R6 — EU-27: posterior regime probabilities (stacked areas)",
      EU27
    )
  );
  wrap.appendChild(
    render(
      "Fig. R6 — MERCOSUR-4: posterior regime probabilities (stacked areas)",
      MCS4
    )
  );
  return wrap;
}


function _Fig_R4_transitions_byRegion(HMM_shared,html,regionMode,longData,tapioClassify,Plotly)
{
  if (HMM_shared?.error)
    return html`<div style="color:#900;">${HMM_shared.error}</div>`;

  const { EU27, MCS4, TAPIO_LABELS, tapioTolVal, colors } = HMM_shared;

  // ---- decide countries based on selector ----
  let ctries;
  if (regionMode === "UE") ctries = EU27;
  else if (regionMode === "Mercosur") ctries = MCS4;
  else if (regionMode === "Both") ctries = [...EU27, ...MCS4];
  else ctries = [...new Set(longData.map((d) => d.country))]; // option Countries (all visible)

  // ---- Tapio sequences for selected countries ----
  function tapioSequenceFor(country) {
    const seq = [];
    const yearsAll = [...new Set(longData.map((d) => d.year))].sort(
      (a, b) => a - b
    );
    for (let i = 1; i < yearsAll.length; i++) {
      const t0 = yearsAll[i - 1],
        t1 = yearsAll[i];
      const I0 = longData.find(
        (d) => d.country === country && d.flow === "MF" && d.year === t0
      )?.value;
      const I1 = longData.find(
        (d) => d.country === country && d.flow === "MF" && d.year === t1
      )?.value;
      const Y0 = longData.find(
        (d) => d.country === country && d.flow === "GDP" && d.year === t0
      )?.value;
      const Y1 = longData.find(
        (d) => d.country === country && d.flow === "GDP" && d.year === t1
      )?.value;
      if (![I0, I1, Y0, Y1].every(Number.isFinite) || I0 === 0 || Y0 === 0)
        continue;
      const gI = (I1 - I0) / I0,
        gY = (Y1 - Y0) / Y0;
      const lab = tapioClassify ? tapioClassify(gI, gY, tapioTolVal) : "NA";
      const obs = TAPIO_LABELS.indexOf(lab);
      if (obs >= 0) seq.push(obs);
    }
    return seq;
  }

  const sequences = [];
  for (const c of ctries) {
    const s = tapioSequenceFor(c);
    if (s.length >= 6) sequences.push(s);
  }
  if (!sequences.length)
    return html`<div style="color:#900;">No valid sequences for ${regionMode}.</div>`;

  // ---- re-train HMM for this subset ----
  const { K, S } = HMM_shared;
  function RNG(seed = 1234) {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 2 ** 32;
  }
  const rand = RNG(42);
  const dir = (a) => {
    const x = a.map((v) => -Math.log(rand()) / (v || 1));
    const s = x.reduce((p, v) => p + v, 0) || 1;
    return x.map((v) => v / s);
  };
  const norm = (v) => {
    const s = v.reduce((p, x) => p + x, 0);
    return s > 0 ? v.map((x) => x / s) : v.map(() => 1 / v.length);
  };
  function initModel(K, S) {
    return {
      K,
      S,
      pi: dir(Array(K).fill(1)),
      A: Array.from({ length: K }, () => norm(dir(Array(K).fill(1)))),
      B: Array.from({ length: K }, () => norm(dir(Array(S).fill(1))))
    };
  }
  function forwardScaled(m, obs) {
    const { K, B, A, pi } = m,
      T = obs.length;
    const alpha = Array.from({ length: T }, () => Array(K).fill(0)),
      c = Array(T).fill(0);
    for (let i = 0; i < K; i++) {
      alpha[0][i] = pi[i] * B[i][obs[0]];
      c[0] += alpha[0][i];
    }
    if (c[0] === 0) c[0] = 1e-300;
    for (let i = 0; i < K; i++) alpha[0][i] /= c[0];
    for (let t = 1; t < T; t++) {
      let ct = 0;
      for (let j = 0; j < K; j++) {
        let sum = 0;
        for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * A[i][j];
        const val = sum * B[j][obs[t]];
        alpha[t][j] = val;
        ct += val;
      }
      if (ct === 0) ct = 1e-300;
      c[t] = ct;
      for (let j = 0; j < K; j++) alpha[t][j] /= ct;
    }
    const loglik = -c.map((v) => Math.log(v)).reduce((p, v) => p + v, 0);
    return { alpha, c, loglik };
  }
  function backwardScaled(m, obs, c) {
    const { K, B, A } = m,
      T = obs.length;
    const beta = Array.from({ length: T }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) beta[T - 1][i] = 1 / c[T - 1];
    for (let t = T - 2; t >= 0; t--)
      for (let i = 0; i < K; i++) {
        let s = 0;
        for (let j = 0; j < K; j++)
          s += A[i][j] * B[j][obs[t + 1]] * beta[t + 1][j];
        beta[t][i] = s / c[t];
      }
    return beta;
  }
  function baumWelch(seqs, K, S, maxIters = 200, tol = 1e-6) {
    let m = initModel(K, S),
      prev = -Infinity;
    for (let it = 0; it < maxIters; it++) {
      const pi_acc = Array(K).fill(0),
        A_acc = Array.from({ length: K }, () => Array(K).fill(0)),
        B_acc = Array.from({ length: K }, () => Array(S).fill(0));
      let total = 0;
      for (const obs of seqs) {
        const { alpha, c, loglik } = forwardScaled(m, obs);
        const beta = backwardScaled(m, obs, c);
        total += loglik;
        const T = obs.length;
        const gamma = Array.from({ length: T }, () => Array(K).fill(0));
        const xi = Array.from({ length: T - 1 }, () =>
          Array.from({ length: K }, () => Array(K).fill(0))
        );
        for (let t = 0; t < T; t++) {
          let den = 0;
          for (let i = 0; i < K; i++) den += alpha[t][i] * beta[t][i];
          if (!den) den = 1e-300;
          for (let i = 0; i < K; i++)
            gamma[t][i] = (alpha[t][i] * beta[t][i]) / den;
        }
        for (let t = 0; t < T - 1; t++) {
          let den = 0;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              den +=
                alpha[t][i] * m.A[i][j] * m.B[j][obs[t + 1]] * beta[t + 1][j];
          if (!den) den = 1e-300;
          for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++)
              xi[t][i][j] =
                (alpha[t][i] *
                  m.A[i][j] *
                  m.B[j][obs[t + 1]] *
                  beta[t + 1][j]) /
                den;
        }
        for (let i = 0; i < K; i++) pi_acc[i] += gamma[0][i];
        for (let i = 0; i < K; i++) {
          let den = 0;
          for (let t = 0; t < T - 1; t++) den += gamma[t][i];
          den = den || 1e-300;
          for (let j = 0; j < K; j++) {
            let num = 0;
            for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
            A_acc[i][j] += num / den;
          }
        }
        for (let i = 0; i < K; i++) {
          let den = 0;
          for (let t = 0; t < T; t++) den += gamma[t][i];
          den = den || 1e-300;
          const btmp = Array(S).fill(0);
          for (let t = 0; t < T; t++) btmp[obs[t]] += gamma[t][i];
          for (let s = 0; s < S; s++) B_acc[i][s] += btmp[s] / den;
        }
      }
      const norm = (row) => {
        const s = row.reduce((p, x) => p + x, 0);
        return s > 0 ? row.map((x) => x / s) : row.map(() => 1 / row.length);
      };
      m.pi = norm(pi_acc);
      for (let i = 0; i < K; i++) {
        m.A[i] = norm(A_acc[i]);
        m.B[i] = norm(B_acc[i]);
      }
      if (it > 0 && Math.abs(total - prev) < tol * Math.max(1, Math.abs(prev)))
        break;
      prev = total;
    }
    return m;
  }
  const model = baumWelch(sequences, K, S, 300, 1e-6);

  // ---- dwell times ----
  const dwell = Array.from(
    { length: K },
    (_, i) => 1 / Math.max(1e-9, 1 - model.A[i][i])
  );

  // ---- Sankey plot ----
  const THR = 0.03;
  const nodes = Array.from({ length: K }, (_, k) => `R${k + 1}`);
  const src = [],
    tgt = [],
    val = [],
    lab = [];
  for (let i = 0; i < K; i++)
    for (let j = 0; j < K; j++)
      if (model.A[i][j] >= THR) {
        src.push(i);
        tgt.push(j);
        val.push(model.A[i][j]);
        lab.push(`A[${i + 1}→${j + 1}] = ${model.A[i][j].toFixed(3)}`);
      }
  const nodeLabel = nodes.map(
    (n, i) => `${n} — dwell: ${dwell[i].toFixed(1)} yrs`
  );

  const el = document.createElement("div");
  el.style.width = "100%";
  el.style.height = "520px";
  Plotly.newPlot(
    el,
    [
      {
        type: "sankey",
        orientation: "h",
        node: { label: nodeLabel, pad: 18, thickness: 16 },
        link: { source: src, target: tgt, value: val, label: lab }
      }
    ],
    {
      template: "plotly_white",
      margin: { t: 40, r: 16, b: 40, l: 56 }
      // no embedded title, so exports are clean
    },
    { displaylogo: false, responsive: true }
  );
  return el;
}


function _gapMeasure(Inputs){return(
Inputs.radio(["Nivel", "Share de MF"], {
  label: "Medida del gap (MF−DMC)",
  value: "Nivel"
})
)}

function _helpers_gap(globalThis,longData)
{
  const G = globalThis;
  const readMaybe = (n) => {
    try {
      return Function(`return (typeof ${n}!=="undefined")?${n}:null`)();
    } catch {
      return null;
    }
  };
  const uniq = (a) => [...new Set(a)];
  const asc = (a, b) => a - b;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const between = (x, a, b) => x >= a && x <= b;
  const unitFor = (flowName) => {
    const u = uniq(
      (longData || [])
        .filter((d) => d.flow === flowName)
        .map((d) => d.unit)
        .filter(Boolean)
    );
    return u.length ? u[0] : "";
  };
  const mapFlow = (flowName) => {
    const M = new Map();
    for (const d of longData || []) {
      if (d.flow !== flowName) continue;
      let m = M.get(d.country);
      if (!m) {
        m = new Map();
        M.set(d.country, m);
      }
      m.set(d.year, d.value);
    }
    return M;
  };
  return { G, readMaybe, uniq, asc, clamp, between, unitFor, mapFlow };
}


function _gapPanel_all(helpers_gap,extMode,longData,countriesUE,countriesMCS)
{
  const { uniq, mapFlow } = helpers_gap;
  const useCap =
    typeof extMode !== "undefined" && String(extMode).includes("/cap");
  const MFf = useCap ? "MF/cap" : "MF";
  const DMCf = useCap ? "DMC/cap" : "DMC";
  const MFM = mapFlow(MFf);
  const DMCM = mapFlow(DMCf);

  const years = uniq((longData || []).map((d) => d.year)).sort((a, b) => a - b);
  const cUE = Array.isArray(countriesUE) ? countriesUE : [];
  const cMC = Array.isArray(countriesMCS) ? countriesMCS : [];
  const countries = [...new Set([...cUE, ...cMC])];

  const out = [];
  for (const c of countries) {
    const m1 = MFM.get(c) || new Map();
    const m2 = DMCM.get(c) || new Map();
    for (const y of years) {
      const mf = m1.get(y),
        dmc = m2.get(y);
      if (!Number.isFinite(mf) || !Number.isFinite(dmc)) continue;
      const gap_level = mf - dmc;
      const gap_share = mf > 0 ? gap_level / mf : NaN;
      out.push({ country: c, year: y, mf, dmc, gap_level, gap_share });
    }
  }
  return out;
}


function _gapByBloc(yearStart,d3,gapPanel_all,yearEnd,countriesUE,countriesMCS)
{
  const y0 =
    typeof yearStart === "number"
      ? +yearStart
      : d3.min(gapPanel_all, (d) => d.year);
  const y1 =
    typeof yearEnd === "number"
      ? +yearEnd
      : d3.max(gapPanel_all, (d) => d.year);
  const isUE = new Set(Array.isArray(countriesUE) ? countriesUE : []);
  const isMC = new Set(Array.isArray(countriesMCS) ? countriesMCS : []);
  const inH = (r) => r.year >= y0 && r.year <= y1;
  const ue = gapPanel_all.filter((r) => inH(r) && isUE.has(r.country));
  const mcs = gapPanel_all.filter((r) => inH(r) && isMC.has(r.country));
  return { ue, mcs, y0, y1 };
}


function _tapioByCY(tapioByCountryForImpact)
{
  const map = new Map();
  const M =
    typeof tapioByCountryForImpact !== "undefined" && tapioByCountryForImpact
      ? tapioByCountryForImpact
      : null;
  if (M instanceof Map) {
    for (const [c, rows] of M)
      for (const r of rows || []) map.set(`${c}|${r.year}`, { ...r });
  }
  return map;
}


function _decodedRegimeByCY(helpers_gap,yearStart,d3,gapPanel_all,yearEnd,tapioByCY)
{
  const { readMaybe } = helpers_gap;
  const out = new Map();
  const push = (c, y, k, label) => out.set(`${c}|${y}`, { k, label });
  let ok = false;

  const H = readMaybe("HMM_shared");
  if (H && (H.decodedByCountry || H.decoded || H.viterbi || H.paths)) {
    const K = +H.K || (H.model && H.model.K) || 2;
    const labels =
      H.regimeLabels || Array.from({ length: K }, (_, i) => [`R${i + 1}`]);
    const src = H.decodedByCountry || H.decoded || H.viterbi || H.paths;
    if (src instanceof Map) {
      for (const [c, rows] of src)
        for (const r of rows || [])
          if (Number.isFinite(+r.year) && Number.isFinite(+r.k)) {
            push(
              c,
              +r.year,
              +r.k,
              r.label || (labels[r.k - 1] || [`R${r.k}`]).join("/")
            );
            ok = true;
          }
    } else if (Array.isArray(src)) {
      for (const r of src)
        if (r.country && Number.isFinite(+r.year) && Number.isFinite(+r.k)) {
          push(
            r.country,
            +r.year,
            +r.k,
            r.label || (labels[r.k - 1] || [`R${r.k}`]).join("/")
          );
          ok = true;
        }
    } else if (src && typeof src === "object") {
      for (const c of Object.keys(src))
        for (const r of src[c] || [])
          if (Number.isFinite(+r.year) && Number.isFinite(+r.k)) {
            push(
              c,
              +r.year,
              +r.k,
              r.label || (labels[r.k - 1] || [`R${r.k}`]).join("/")
            );
            ok = true;
          }
    }
  }

  if (!ok) {
    const good = new Set(["SD", "RD", "RC", "RND"]);
    const y0 =
      typeof yearStart === "number"
        ? +yearStart
        : d3.min(gapPanel_all, (d) => d.year) ?? 1995;
    const y1 =
      typeof yearEnd === "number"
        ? +yearEnd
        : d3.max(gapPanel_all, (d) => d.year) ?? 2021;
    for (const r of gapPanel_all) {
      if (r.year < y0 || r.year > y1) continue;
      const t = tapioByCY.get(`${r.country}|${r.year}`);
      const eff = t && good.has(t.state);
      const label = eff
        ? "efficiency-oriented (proxy)"
        : "material-intensive (proxy)";
      push(r.country, r.year, eff ? 1 : 2, label);
    }
  }
  return out;
}


async function _fig_R6_gapTrajectories(Plotly,require,helpers_gap,gapByBloc,extMode,gapMeasure,Inputs,html,d3,invalidation)
{
  // --- Plotly (carga segura) ---
  const P =
    typeof Plotly !== "undefined"
      ? Plotly
      : await require("plotly.js-dist-min");

  // --- utilidades y datos base ya presentes en el cuaderno ---
  const { uniq, asc, unitFor } = helpers_gap;
  const { ue, mcs } = gapByBloc; // arrays con filas {country, year, gap_level, gap_share}
  const useCap =
    typeof extMode !== "undefined" && String(extMode).includes("/cap");
  const MFflow = useCap ? "MF/cap" : "MF";
  const unitLbl = unitFor(MFflow) || "";
  const mode = gapMeasure === "Share of MF" ? "share" : "level";
  const key = mode === "share" ? "gap_share" : "gap_level";
  const yearsAll = uniq([...ue, ...mcs].map((d) => d.year)).sort(asc);

  // --- UI sencillo dentro de la misma celda ---
  const startInp = Inputs.range([yearsAll[0], yearsAll.at(-1) - 1], {
    label: "Start year",
    value: yearsAll[0],
    step: 1
  });
  const endInp = Inputs.range([() => +startInp.value + 1, yearsAll.at(-1)], {
    label: "End year",
    value: yearsAll.at(-1),
    step: 1
  });
  const blocInp = Inputs.radio(["EU", "MERCOSUR", "Both"], {
    label: "Scope",
    value: "Both"
  });

  const controls = html`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:6px 0 10px 0;"></div>`;
  controls.append(startInp, endInp, blocInp);

  // --- contenedor del gráfico ---
  const root = this ?? html`<div></div>`;
  root.replaceChildren(
    controls,
    html`<div class="chart" style="width:100%;height:800px;"></div>`
  );
  const div = root.querySelector(".chart");

  // --- funciones auxiliares ---
  const stat = (rows, yearsSel) => {
    const byY = d3.group(
      rows.filter((d) => yearsSel.has(d.year)),
      (d) => d.year
    );
    const out = [];
    for (const y of [...yearsSel].sort(asc)) {
      const v = (byY.get(y) || [])
        .map((d) => d[key])
        .filter(Number.isFinite)
        .sort(asc);
      out.push({
        year: y,
        med: v.length ? d3.median(v) : NaN,
        q1: v.length ? d3.quantileSorted(v, 0.25) : NaN,
        q3: v.length ? d3.quantileSorted(v, 0.75) : NaN
      });
    }
    return out;
  };

  const addCountryRibbons = (rows, label, yearsSel, into) => {
    const byC = d3.group(
      rows.filter((d) => yearsSel.has(d.year)),
      (d) => d.country
    );
    for (const [c, arr] of byC) {
      const a = arr.slice().sort((x, y) => asc(x.year, y.year));
      into.push({
        x: a.map((d) => d.year),
        y: a.map((d) => d[key]),
        mode: "lines",
        name: `${label}: ${c}`,
        line: { width: 1 },
        opacity: 0.2,
        hoverinfo: "skip",
        showlegend: false
      });
    }
  };

  const band = (S, color, label) => {
    const x = S.map((d) => d.year);
    const med = {
      x,
      y: S.map((d) => d.med),
      mode: "lines",
      name: `${label} — median`,
      line: { width: 3 }
    };
    const q1 = {
      x,
      y: S.map((d) => d.q1),
      mode: "lines",
      line: { width: 0 },
      showlegend: false,
      hoverinfo: "skip"
    };
    const q3 = {
      x,
      y: S.map((d) => d.q3),
      mode: "lines",
      line: { width: 0 },
      fill: "tonexty",
      fillcolor: color,
      opacity: 0.15,
      showlegend: false,
      hoverinfo: "skip"
    };
    return [q1, q3, med];
  };

  // --- render (reacciona a los selectores locales) ---
  const render = async () => {
    let y0 = +startInp.value,
      y1 = +endInp.value;
    if (y1 <= y0) {
      y1 = y0 + 1;
      endInp.value = y1;
    } // garantía simple
    const yearsSel = new Set(yearsAll.filter((y) => y >= y0 && y <= y1));

    const traces = [];
    const shapes = [];

    // ribbons + bandas por bloque según selección
    const wantEU = blocInp.value === "EU" || blocInp.value === "Both";
    const wantMCS = blocInp.value === "MERCOSUR" || blocInp.value === "Both";

    if (wantEU) {
      addCountryRibbons(ue, "EU", yearsSel, traces);
      traces.push(...band(stat(ue, yearsSel), "rgba(31,119,180,0.25)", "EU"));
    }
    if (wantMCS) {
      addCountryRibbons(mcs, "MERCOSUR", yearsSel, traces);
      traces.push(
        ...band(stat(mcs, yearsSel), "rgba(255,127,14,0.25)", "MERCOSUR")
      );
    }

    // sombreado 2020–2021 si cae dentro del rango visible
    if ([2020, 2021].some((y) => yearsSel.has(y))) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: 2019.5,
        x1: 2021.5,
        y0: 0,
        y1: 1,
        fillcolor: "#000",
        opacity: 0.06,
        line: { width: 0 }
      });
    }

    // ticks legibles
    const yearsVec = [...yearsSel].sort(asc);
    const tickStep = Math.max(1, Math.ceil(yearsVec.length / 10));
    const xticks = yearsVec.filter((_, i) => i % tickStep === 0);
    if (xticks.at(-1) !== yearsVec.at(-1)) xticks.push(yearsVec.at(-1));

    const yTitle =
      mode === "share"
        ? "MF−DMC / MF"
        : `MF−DMC${unitLbl ? ` (${unitLbl})` : ""}`;

    const layout = {
      template: "plotly_white",
      title: { text: "Externalisation gap trajectories" },
      xaxis: { tickmode: "array", tickvals: xticks, tickangle: -90 },
      yaxis: { title: yTitle, zeroline: false },
      legend: { orientation: "h", y: -0.2 },
      shapes,
      height: 700,
      margin: { l: 60, r: 20, t: 60, b: 80 },
      autosize: true
    };

    await P.react(div, traces, layout, {
      displaylogo: false,
      responsive: true
    });
  };

  // eventos (cambios de UI -> re-render)
  startInp.addEventListener("input", render);
  endInp.addEventListener("input", render);
  blocInp.addEventListener("input", render);

  // primer render
  await render();

  invalidation.then(() => {
    try {
      P.purge(div);
    } catch {}
  });

  return root;
}


async function _fig_R7_gapByRegime(Plotly,require,helpers_gap,gapMeasure,yearStart,d3,gapPanel_all,yearEnd,decodedRegimeByCY,tapioByCY,html,tapioPalette,invalidation)
{
  const P =
    typeof Plotly !== "undefined"
      ? Plotly
      : await require("plotly.js-dist-min");
  const { uniq } = helpers_gap;

  const modeKey = gapMeasure === "Share of MF" ? "gap_share" : "gap_level";
  const yTitle = gapMeasure === "Share of MF" ? "MF−DMC / MF" : "MF−DMC";
  const y0 =
    typeof yearStart === "number"
      ? +yearStart
      : d3.min(gapPanel_all, (d) => d.year);
  const y1 =
    typeof yearEnd === "number"
      ? +yearEnd
      : d3.max(gapPanel_all, (d) => d.year);

  const rows = [];
  for (const r of gapPanel_all) {
    if (r.year < y0 || r.year > y1) continue;
    const reg = decodedRegimeByCY.get(`${r.country}|${r.year}`);
    if (!reg) continue;
    const tap = tapioByCY.get(`${r.country}|${r.year}`);
    const yv = r[modeKey];
    if (!Number.isFinite(yv)) continue;
    rows.push({
      country: r.country,
      year: r.year,
      regime: reg.label || `R${reg.k}`,
      y: yv,
      tap: tap?.state
    });
  }
  if (!rows.length)
    return html`<div style="color:#900;">No data available for this range.</div>`;

  const regimes = uniq(rows.map((d) => d.regime));
  const traces = [];

  // Violin plots per regime
  for (const R of regimes) {
    const v = rows
      .filter((d) => d.regime === R)
      .map((d) => d.y)
      .filter(Number.isFinite);
    if (!v.length) continue;
    traces.push({
      type: "violin",
      x: Array(v.length).fill(R),
      y: v,
      name: R,
      box: { visible: true },
      meanline: { visible: true },
      points: "outliers",
      opacity: 0.6
    });
  }

  // Overlay Tapio states
  const tapStates = uniq(rows.map((d) => d.tap).filter(Boolean));
  const pal =
    typeof tapioPalette === "object" && tapioPalette ? tapioPalette : {};
  const colorOf = (s) => pal[s] || "#666";
  for (const S of tapStates) {
    const rr = rows.filter((d) => d.tap === S && Number.isFinite(d.y));
    traces.push({
      type: "scatter",
      mode: "markers",
      x: rr.map((d) => d.regime),
      y: rr.map((d) => d.y),
      name: S,
      marker: { size: 6, color: colorOf(S) },
      opacity: 0.85,
      hovertemplate: `%{x}<br>${S}<br>Value: %{y:.3f}<extra></extra>`
    });
  }

  const layout = {
    template: "plotly_white",
    title: { text: "Fig. R7 — Externalisation gap by regime" },
    yaxis: { title: yTitle, zeroline: false },
    xaxis: { title: "Regime" },
    height: 700,
    margin: { l: 60, r: 20, t: 60, b: 60 },
    autosize: true
  };

  const div = this ?? html`<div class="chart" style="width:100%"></div>`;
  div.style.height = "700px";
  div.style.width = "100%";

  await P.react(div, traces, layout, {
    displaylogo: false,
    responsive: true
  });

  invalidation.then(() => {
    try {
      P.purge(div);
    } catch {}
  });
  return div;
}


function _79(md){return(
md`# Figure. Material Footprint Gap Typology (1994-2024)`
)}

async function _fig_R8_typology(Plotly,require,html,yearEnd,yearStart,d3,gapPanel_all,decodedRegimeByCY,countriesUE,countriesMCS,invalidation)
{
  const P =
    typeof Plotly !== "undefined"
      ? Plotly
      : await require("plotly.js-dist-min");

  // Create container with selector and plot
  const container = html`<div style="display: flex; flex-direction: column; gap: 12px;"></div>`;
  const plotDiv = html`<div style="width: 100%; height: 750px;"></div>`;

  // Create bloc selector
  const blocSelector = html`<select style="padding: 6px; border-radius: 4px; max-width: 200px;">
    <option value="both">EU & MERCOSUR</option>
    <option value="eu">EU Only</option>
    <option value="mercosur">MERCOSUR Only</option>
  </select>`;

  // Size control slider
  const sizeSlider = html`<input type="range" min="8" max="20" value="12" style="width: 120px;">`;

  container.appendChild(html`<div style="margin-bottom: 15px; display: flex; gap: 20px; align-items: center;">
    <div>
      <label><b>Select Bloc:</b> </label>
      ${blocSelector}
    </div>
    <div>
      <label><b>Marker Size:</b> </label>
      ${sizeSlider}
    </div>
  </div>`);
  container.appendChild(plotDiv);

  // Utility functions
  const labelNorm = (s) => String(s || "").toLowerCase();
  const isEff = (lab) => labelNorm(lab).includes("efficiency");

  // Official ISO 3166-1 alpha-3 country codes
  const isoAlpha3 = {
    Germany: "DEU",
    France: "FRA",
    Italy: "ITA",
    Spain: "ESP",
    Netherlands: "NLD",
    Belgium: "BEL",
    Sweden: "SWE",
    Portugal: "PRT",
    Greece: "GRC",
    Austria: "AUT",
    Finland: "FIN",
    Ireland: "IRL",
    Luxembourg: "LUX",
    Denmark: "DNK",
    Poland: "POL",
    "Czech Republic": "CZE",
    Hungary: "HUN",
    Slovakia: "SVK",
    Slovenia: "SVN",
    Estonia: "EST",
    Latvia: "LVA",
    Lithuania: "LTU",
    Malta: "MLT",
    Cyprus: "CYP",
    Romania: "ROU",
    Bulgaria: "BGR",
    Croatia: "HRV",
    Brazil: "BRA",
    Argentina: "ARG",
    Paraguay: "PRY",
    Uruguay: "URY"
  };

  function abbr3(c) {
    if (isoAlpha3[c]) return isoAlpha3[c];
    const clean = String(c)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const parts = clean
      .replace(/[^A-Za-z ]/g, " ")
      .trim()
      .split(/\s+/);
    const letters = parts
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase();
    return c.length <= 10 ? c : letters.slice(0, 3);
  }

  const manualAdjustments = new Map([
    ["Czech Republic", { dx: 0.02, dy: 0.01, position: "bottom left" }],
    ["Hungary", { dx: -0.02, dy: -0.01, position: "top right" }]
  ]);

  const calculateTextPositions = (points) => {
    const THRESHOLD = 0.04;
    const positions = {};
    const offsets = {};
    const sorted = [...points].sort((a, b) => b.y - a.y);
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (manualAdjustments.has(current.country)) {
        const adj = manualAdjustments.get(current.country);
        positions[current.country] = adj.position;
        offsets[current.country] = { dx: adj.dx, dy: adj.dy };
        continue;
      }
      let position = "top center";
      let dx = 0;
      let dy = 0;
      for (let j = 0; j < i; j++) {
        const other = sorted[j];
        const yDiff = Math.abs(current.y - other.y);
        const xDiff = Math.abs(current.x - other.x);
        if (yDiff < THRESHOLD && xDiff < THRESHOLD) {
          dy = i % 2 === 0 ? 0.015 : -0.015;
          dx = i % 3 === 0 ? 0.02 : i % 3 === 1 ? -0.02 : 0;
          position = i % 2 === 0 ? "bottom center" : "top center";
        }
      }
      if (current.x > 0.85) position = "middle left";
      if (current.x < 0.15) position = "middle right";
      if (current.y > 0.85) position = "bottom center";
      positions[current.country] = position;
      offsets[current.country] = { dx, dy };
    }
    return { positions, offsets };
  };

  const updatePlot = async () => {
    const blocFilter = blocSelector.value;
    const markerSize = parseInt(sizeSlider.value);

    const coreMax = Math.min(
      2024,
      typeof yearEnd === "number" ? +yearEnd : 2024
    );
    const coreMin = typeof yearStart === "number" ? +yearStart : 1994;

    const byC = d3.group(
      gapPanel_all.filter((d) => d.year >= coreMin && d.year <= coreMax),
      (d) => d.country
    );

    const points = [];
    for (const [c, arr] of byC) {
      const yvals = arr.map((d) => d.gap_share).filter(Number.isFinite);
      if (!yvals.length) continue;
      const y = d3.median(yvals);
      const dec = arr
        .map((d) => decodedRegimeByCY.get(`${c}|${d.year}`))
        .filter(Boolean);
      const total = dec.length || 1;
      const shareEff = dec.filter((r) => isEff(r.label)).length / total;
      const isEU = (countriesUE || []).includes(c);
      const isMCS = (countriesMCS || []).includes(c);
      const bloc = isEU ? "EU" : isMCS ? "MERCOSUR" : "Other";
      if (blocFilter === "eu" && !isEU) continue;
      if (blocFilter === "mercosur" && !isMCS) continue;
      if (blocFilter === "both" && !(isEU || isMCS)) continue;
      points.push({
        country: c,
        countryCode: abbr3(c),
        bloc,
        x: shareEff,
        y,
        originalY: y,
        effYears: dec.filter((r) => isEff(r.label)).length,
        totalYears: total,
        medianGap: y
      });
    }

    if (!points.length) {
      plotDiv.innerHTML = `<div style="color:#900;padding:2em;text-align:center;">
        No data available for selected blocs
      </div>`;
      return;
    }

    const { positions, offsets } = calculateTextPositions(points);
    const yValues = points.map((p) => p.originalY);
    const yMed = d3.median(yValues);

    const blocVisuals = {
      EU: { symbol: "circle", color: "#1f77b4", size: markerSize * 0.5 },
      MERCOSUR: { symbol: "diamond", color: "#ff7f0e", size: markerSize * 0.5 },
      Other: { symbol: "square", color: "#888", size: markerSize * 0.5 }
    };

    const traces = [];
    for (const bloc of ["MERCOSUR", "EU", "Other"]) {
      const blocPoints = points.filter((p) => p.bloc === bloc);
      if (!blocPoints.length) continue;
      traces.push({
        type: "scatter",
        mode: "markers+text",
        name: bloc,
        x: blocPoints.map((d) => d.x + (offsets[d.country]?.dx || 0)),
        y: blocPoints.map((d) => d.y + (offsets[d.country]?.dy || 0)),
        text: blocPoints.map((d) => d.countryCode),
        textposition: blocPoints.map(
          (d) => positions[d.country] || "top center"
        ),
        textfont: {
          size: 10,
          color:
            bloc === "EU" ? "#1a5276" : bloc === "MERCOSUR" ? "#b8510a" : "#666"
        },
        marker: {
          size: blocPoints.map(() => blocVisuals[bloc].size),
          symbol: blocVisuals[bloc].symbol,
          color: blocVisuals[bloc].color,
          line: { width: 1, color: "#333" },
          opacity: 0.9
        },
        customdata: blocPoints.map((d) => ({
          country: d.country,
          effYears: d.effYears,
          totalYears: d.totalYears,
          medianGap: d.medianGap,
          originalX: d.x,
          originalY: d.y
        })),
        hovertemplate: `
          <b>%{customdata.country}</b> (%{fullData.name})<br>
          Efficiency years: %{customdata.effYears}/%{customdata.totalYears}<br>
          Share: %{customdata.originalX:.1%}<br>
          Median gap: %{customdata.originalY:.3f}<extra></extra>
        `
      });
    }

    const layout = {
      template: "plotly_white",
      xaxis: {
        title: "Proportion of time in efficiency-oriented regime",
        range: [-0.05, 1.05],
        tickformat: ",.0%",
        gridcolor: "#eee",
        zeroline: false,
        showspikes: true,
        spikethickness: 1
      },
      yaxis: {
        title: "Median (MF − DMC)/MF",
        tickformat: ",.0%",
        gridcolor: "#eee",
        zeroline: false,
        showspikes: true,
        spikethickness: 1
      },
      shapes: [
        {
          type: "line",
          x0: 0.5,
          x1: 0.5,
          y0: d3.min(yValues) - 0.05,
          y1: d3.max(yValues) + 0.05,
          line: { dash: "dot", color: "#999", width: 1 }
        },
        {
          type: "line",
          x0: -0.05,
          x1: 1.05,
          y0: yMed,
          y1: yMed,
          line: { dash: "dot", color: "#999", width: 1 }
        }
      ],
      annotations: [
        {
          x: 0.75,
          y: 1.03,
          xref: "paper",
          yref: "paper",
          showarrow: false,
          text: "HIGH EFFICIENCY FOCUS",
          font: { size: 12, color: "#555" }
        },
        {
          x: 0.25,
          y: 1.03,
          xref: "paper",
          yref: "paper",
          showarrow: false,
          text: "MODERATE EFFICIENCY",
          font: { size: 12, color: "#555" }
        }
      ],
      legend: {
        orientation: "h",
        y: -0.16,
        font: { size: 12 },
        itemclick: false,
        itemdoubleclick: false
      },
      margin: { l: 70, r: 30, t: 30, b: 70 }, // reduced top margin
      height: 700,
      hovermode: "closest",
      hoverlabel: {
        bgcolor: "#FFF",
        bordercolor: "#AAA",
        font: { size: 12, family: "Arial" },
        align: "left"
      },
      clickmode: "none"
    };

    await P.react(plotDiv, traces, layout, {
      displaylogo: false,
      responsive: true,
      scrollZoom: false
    });
  };

  await updatePlot();
  blocSelector.addEventListener("change", updatePlot);
  sizeSlider.addEventListener("input", updatePlot);

  invalidation.then(() => {
    try {
      P.purge(plotDiv);
    } catch (e) {}
  });

  return container;
}


async function _fig_R8_typology_grid(Plotly,require,html,d3,gapPanel_all,decodedRegimeByCY,countriesUE,countriesMCS,invalidation)
{
  const P =
    typeof Plotly !== "undefined"
      ? Plotly
      : await require("plotly.js-dist-min");

  const container = html`<div style="display: flex; flex-direction: column; gap: 12px;"></div>`;
  const plotDiv = html`<div style="width: 100%; height: 950px;"></div>`;

  // Bloc selector
  const blocSelector = html`<select style="padding: 6px; border-radius: 4px; max-width: 200px;">
    <option value="both">EU & MERCOSUR</option>
    <option value="eu">EU Only</option>
    <option value="mercosur">MERCOSUR Only</option>
  </select>`;

  // Marker-size slider (unchanged)
  const sizeSlider = html`<input type="range" min="4" max="14" value="6" style="width: 120px;">`;

  container.appendChild(html`<div style="margin-bottom: 15px; display: flex; gap: 20px; align-items: center;">
    <div><label><b>Select Bloc:</b> </label>${blocSelector}</div>
    <div><label><b>Marker Size:</b> </label>${sizeSlider}</div>
  </div>`);
  container.appendChild(plotDiv);

  // ISO alpha-3 codes
  const isoAlpha3 = {
    Germany: "DEU",
    France: "FRA",
    Italy: "ITA",
    Spain: "ESP",
    Netherlands: "NLD",
    Belgium: "BEL",
    Sweden: "SWE",
    Portugal: "PRT",
    Greece: "GRC",
    Austria: "AUT",
    Finland: "FIN",
    Ireland: "IRL",
    Luxembourg: "LUX",
    Denmark: "DNK",
    Poland: "POL",
    "Czech Republic": "CZE",
    Hungary: "HUN",
    Slovakia: "SVK",
    Slovenia: "SVN",
    Estonia: "EST",
    Latvia: "LVA",
    Lithuania: "LTU",
    Malta: "MLT",
    Cyprus: "CYP",
    Romania: "ROU",
    Bulgaria: "BGR",
    Croatia: "HRV",
    Brazil: "BRA",
    Argentina: "ARG",
    Paraguay: "PRY",
    Uruguay: "URY"
  };

  function abbr3(c) {
    if (isoAlpha3[c]) return isoAlpha3[c];
    const clean = String(c)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const parts = clean
      .replace(/[^A-Za-z ]/g, " ")
      .trim()
      .split(/\s+/);
    const letters = parts
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase();
    return c.length <= 10 ? c : letters.slice(0, 3);
  }

  const labelNorm = (s) => String(s || "").toLowerCase();
  const isEff = (lab) => labelNorm(lab).includes("efficiency");

  function makeTraces(coreMin, coreMax, blocFilter, markerSize, idx) {
    const byC = d3.group(
      gapPanel_all.filter((d) => d.year >= coreMin && d.year <= coreMax),
      (d) => d.country
    );
    const points = [];
    for (const [c, arr] of byC) {
      const yvals = arr.map((d) => d.gap_share).filter(Number.isFinite);
      if (!yvals.length) continue;
      const y = d3.median(yvals);
      const dec = arr
        .map((d) => decodedRegimeByCY.get(`${c}|${d.year}`))
        .filter(Boolean);
      const total = dec.length || 1;
      const shareEff = dec.filter((r) => isEff(r.label)).length / total;
      const isEU = (countriesUE || []).includes(c);
      const isMCS = (countriesMCS || []).includes(c);
      const bloc = isEU ? "EU" : isMCS ? "MERCOSUR" : "Other";
      if (blocFilter === "eu" && !isEU) continue;
      if (blocFilter === "mercosur" && !isMCS) continue;
      if (blocFilter === "both" && !(isEU || isMCS)) continue;
      points.push({ country: c, bloc, x: shareEff, y, code: abbr3(c) });
    }

    const blocVisuals = {
      EU: { symbol: "circle", color: "#1f77b4" },
      MERCOSUR: { symbol: "diamond", color: "#ff7f0e" },
      Other: { symbol: "square", color: "#888" }
    };

    const textPositions = [
      "top right",
      "top left",
      "bottom right",
      "bottom left"
    ];

    const traces = [];
    for (const bloc of ["MERCOSUR", "EU", "Other"]) {
      const blocPoints = points.filter((p) => p.bloc === bloc);
      if (!blocPoints.length) continue;

      traces.push({
        type: "scatter",
        mode: "markers+text",
        name: bloc,
        legendgroup: "all",
        showlegend: idx === 0,
        x: blocPoints.map((d) => d.x),
        y: blocPoints.map((d) => d.y),
        text: blocPoints.map((d) => d.code),
        textposition: blocPoints.map(
          (_, i) => textPositions[i % textPositions.length]
        ),
        textfont: {
          size: 8,
          color:
            bloc === "EU" ? "#1a5276" : bloc === "MERCOSUR" ? "#b8510a" : "#666"
        },
        textoffset: blocPoints.map((_, i) => (i % 2 === 0 ? "10px" : "-10px")),
        marker: {
          size: blocPoints.map(() => markerSize),
          symbol: blocVisuals[bloc].symbol,
          color: blocVisuals[bloc].color,
          line: { width: 1, color: "#333" },
          opacity: 0.85
        }
      });
    }

    // Reference lines (guard against empty panels)
    const yValues = points.map((p) => p.y);
    if (yValues.length) {
      const yMed = d3.median(yValues);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      traces.push({
        type: "line",
        mode: "lines",
        x: [0.5, 0.5],
        y: [yMin - 0.05, yMax + 0.05],
        line: { dash: "dot", color: "#999", width: 1 },
        hoverinfo: "skip",
        showlegend: false
      });
      traces.push({
        type: "line",
        mode: "lines",
        x: [-0.05, 1.05],
        y: [yMed, yMed],
        line: { dash: "dot", color: "#999", width: 1 },
        hoverinfo: "skip",
        showlegend: false
      });
    }

    return traces;
  }

  const updatePlot = async () => {
    const blocFilter = blocSelector.value;
    const markerSize = parseInt(sizeSlider.value);

    // === Requested four periods (nearly equal partitions of 1994–2024) ===
    const periods = [
      { min: 1994, max: 2001, title: "1994–2001" },
      { min: 2002, max: 2009, title: "2002–2009" },
      { min: 2010, max: 2017, title: "2010–2017" },
      { min: 2018, max: 2024, title: "2018–2024" }
    ];

    let data = [];
    let annotations = [];
    periods.forEach((p, idx) => {
      const traces = makeTraces(p.min, p.max, blocFilter, markerSize, idx);
      traces.forEach((t) => {
        t.xaxis = "x" + (idx + 1);
        t.yaxis = "y" + (idx + 1);
        data.push(t);
      });
      annotations.push({
        text: p.title,
        xref: "x" + (idx + 1) + " domain",
        yref: "y" + (idx + 1) + " domain",
        x: 0.5,
        y: 1.08,
        showarrow: false,
        font: { size: 13, color: "#333" }
      });
    });

    const layout = {
      template: "plotly_white",
      grid: { rows: 2, columns: 2, pattern: "independent" },
      height: 950,
      annotations: annotations,
      margin: { t: 40, l: 60, r: 30, b: 60 },
      legend: { orientation: "h", y: -0.15, font: { size: 12 } },
      xaxis: { tickformat: ",.0%", range: [-0.05, 1.05] },
      yaxis: { tickformat: ",.0%", zeroline: false },
      xaxis2: { tickformat: ",.0%", range: [-0.05, 1.05] },
      yaxis2: { tickformat: ",.0%", zeroline: false },
      xaxis3: { tickformat: ",.0%", range: [-0.05, 1.05] },
      yaxis3: { tickformat: ",.0%", zeroline: false },
      xaxis4: { tickformat: ",.0%", range: [-0.05, 1.05] },
      yaxis4: { tickformat: ",.0%", zeroline: false }
    };

    await P.react(plotDiv, data, layout, {
      displaylogo: false,
      responsive: true
    });
  };

  await updatePlot();
  blocSelector.addEventListener("change", updatePlot);
  sizeSlider.addEventListener("input", updatePlot);

  invalidation.then(() => {
    try {
      P.purge(plotDiv);
    } catch (e) {}
  });

  return container;
}


async function _tab_R3_regressions(d3,helpers_gap,gapMeasure,gapByBloc,gapPanel_all,html,tapioByCY,decodedRegimeByCY)
{
  // ——— Dependencies ———
  const mathLocal =
    typeof window.math !== "undefined"
      ? window.math
      : await import("https://cdn.jsdelivr.net/npm/mathjs/+esm");
  if (typeof d3 === "undefined") throw new Error("d3 is not available.");

  // ——— Helpers & globals ———
  const { asc } = helpers_gap;
  const modeKey = gapMeasure === "Share of MF" ? "gap_share" : "gap_level";
  const RESCALE = 1e-6; // Mt
  const fmt = (x, k = 4) => (Number.isFinite(x) ? x.toFixed(k) : "—");

  // EU/MERCOSUR membership
  const ueSet = new Set((gapByBloc?.ue ?? []).map((d) => d.country));
  const mcsSet = new Set((gapByBloc?.mcs ?? []).map((d) => d.country));

  // Years available
  const allYears = Array.from(new Set((gapPanel_all ?? []).map((d) => d.year)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const minAvail = allYears[0] ?? 1995;
  const maxAvail = allYears[allYears.length - 1] ?? 2024;
  const defaultStart = Math.max(1970, minAvail);
  const defaultEnd = Math.min(2024, maxAvail);

  // ——— UI controls ———
  const wrap = html`<div class="fullbleed"></div>`;
  wrap.style.width = "100%";

  const controls = html`<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:10px;">
    <div>
      <label style="font-size:12px;color:#444;">Region</label><br/>
      <select id="r3_region" style="padding:6px 8px;">
        <option value="both">Both (EU + MERCOSUR)</option>
        <option value="EU">EU only</option>
        <option value="MERCOSUR">MERCOSUR only</option>
      </select>
    </div>
    <div>
      <label style="font-size:12px;color:#444;">Start year</label><br/>
      <input id="r3_y0" type="number" min="${minAvail}" max="${maxAvail}" step="1" value="${defaultStart}" style="padding:6px 8px; width:110px;"/>
    </div>
    <div>
      <label style="font-size:12px;color:#444;">End year</label><br/>
      <input id="r3_y1" type="number" min="${minAvail}" max="${maxAvail}" step="1" value="${defaultEnd}" style="padding:6px 8px; width:110px;"/>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="r3_force_hmm" type="checkbox" />
      <label for="r3_force_hmm" style="font-size:12px;color:#444;">Force include HMM contrast</label>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="r3_match_hmm" type="checkbox" />
      <label for="r3_match_hmm" style="font-size:12px;color:#444;">Match HMM coverage across models</label>
    </div>
    <button id="r3_apply" style="padding:7px 10px;border-radius:6px;border:1px solid #ccc;background:#fafafa;cursor:pointer;">
      Apply
    </button>
  </div>`;
  wrap.append(controls);

  // Pedagogical legend (concise)
  const legend = html`<div style="font-size:12.5px;color:#444;margin:-2px 0 8px;">
    <b>Pedagogical key.</b> Base group (when Region = “Both”): <b>MERCOSUR</b>. Rows labelled
    “<i>MERCOSUR effect on {state}</i>” equal the coefficient of {state}; “<i>EU effect on {state}</i>” equals
    {state} + {state}×EU (delta-method SE); and “<i>UE − MERCOSUR on {state}</i>” equals the interaction {state}×EU.
    EC ≡ expansive coupling (PIB y materiales crecen a ritmos similares).
  </div>`;
  wrap.append(legend);

  const out = html`<div></div>`;
  wrap.append(out);

  // ——— Linear algebra: inverse with ridge fallback ———
  function ridgeInv(M, stepSeq = [0, 1e-8, 1e-6, 1e-4, 1e-3, 1e-2]) {
    const n = M.size()[0];
    for (const lam of stepSeq) {
      try {
        const Mlam =
          lam === 0
            ? M
            : mathLocal.add(M, mathLocal.multiply(lam, mathLocal.identity(n)));
        return mathLocal.inv(Mlam);
      } catch (_) {}
    }
    throw new Error("Matrix inversion failed even with ridge regularisation.");
  }

  // ——— Cluster-robust OLS (Arellano) ———
  function olsCluster(data, yKey, xKeys, clusterKey = "country") {
    const complete = data.filter(
      (d) =>
        Number.isFinite(d[yKey]) && xKeys.every((k) => Number.isFinite(d[k]))
    );
    const N = complete.length;
    if (!N)
      return {
        xKeys: ["Intercept", ...xKeys],
        stats: [],
        N: 0,
        G: 0,
        beta: null,
        vcov: null
      };

    const Y = mathLocal.matrix(complete.map((d) => [d[yKey]])); // N x 1
    const X = mathLocal.matrix(
      complete.map((d) => [1, ...xKeys.map((k) => d[k])])
    );
    const Xt = mathLocal.transpose(X);
    const XtX = mathLocal.multiply(Xt, X);

    try {
      const XtX_inv = ridgeInv(XtX);
      const beta = mathLocal.multiply(XtX_inv, mathLocal.multiply(Xt, Y)); // K x 1
      const yhat = mathLocal
        .multiply(X, beta)
        .toArray()
        .map((r) => r[0]);
      const u = complete.map((d, i) => d[yKey] - yhat[i]);

      // Cluster "meat"
      const groups = d3.group(complete, (d) => d[clusterKey]);
      const G = groups.size;
      let meat = mathLocal.zeros(XtX.size()[0], XtX.size()[1]);
      const Xarr = X.toArray();

      for (const [, rowsG] of groups) {
        const idx = rowsG.map((r) => complete.indexOf(r));
        const Xg = mathLocal.matrix(idx.map((i) => Xarr[i])); // n_g x K
        const ug = mathLocal.matrix(idx.map((i) => [u[i]])); // n_g x 1
        const XgTug = mathLocal.multiply(mathLocal.transpose(Xg), ug); // K x 1
        const Sg = mathLocal.multiply(XgTug, mathLocal.transpose(XgTug)); // K x K
        meat = mathLocal.add(meat, Sg);
      }

      // Small-sample correction
      const K = X.size()[1];
      const scale = G > 1 && N > K ? (G / (G - 1)) * ((N - 1) / (N - K)) : 1;
      const V = mathLocal.multiply(
        XtX_inv,
        mathLocal.multiply(mathLocal.multiply(meat, scale), XtX_inv)
      );

      const diag = V.toArray().map((row, i) => row[i]);
      const se = diag.map((v) => Math.sqrt(Math.max(0, v)));
      const coef = beta.toArray().map((r) => r[0]);
      const stats = coef.map((b, i) => ({
        coef: b,
        se: se[i],
        t: se[i] ? b / se[i] : NaN
      }));

      return {
        xKeys: ["Intercept", ...xKeys],
        stats,
        N,
        G,
        beta: coef,
        vcov: V.toArray()
      };
    } catch (e) {
      console.error("OLS error:", e);
      return {
        xKeys: ["Intercept", ...xKeys],
        stats: [],
        N: 0,
        G: 0,
        beta: null,
        vcov: null,
        error: e.message
      };
    }
  }

  // ——— Build rows (region y años) ———
  function buildRows(region, y0, y1_for_inference) {
    const includeEU = region === "both";
    const keep =
      region === "EU"
        ? (c) => ueSet.has(c)
        : region === "MERCOSUR"
        ? (c) => mcsSet.has(c)
        : (c) => ueSet.has(c) || mcsSet.has(c);

    const coreRowsRaw = gapPanel_all.filter(
      (d) => d.year >= y0 && d.year <= y1_for_inference && keep(d.country)
    );
    const byC = d3.group(coreRowsRaw, (d) => d.country);
    const rows = [];

    for (const [c, arr0] of byC) {
      const bloc = ueSet.has(c) ? "EU" : mcsSet.has(c) ? "MERCOSUR" : "OTHER";
      if (bloc === "OTHER") continue;
      const arr = arr0.slice().sort((a, b) => asc(a.year, b.year));
      for (let i = 1; i < arr.length; i++) {
        const t = arr[i],
          t1 = arr[i - 1];
        if (!Number.isFinite(t[modeKey]) || !Number.isFinite(t1[modeKey]))
          continue;

        const dy = (t[modeKey] - t1[modeKey]) * RESCALE;

        const tap = tapioByCY.get(`${c}|${t.year}`);
        const state = tap?.state ?? null;

        const reg = decodedRegimeByCY.get(`${c}|${t.year}`);
        let effHMM = null;
        if (reg && typeof reg.label === "string") {
          const lab = reg.label.toLowerCase();
          if (/efficien/.test(lab)) effHMM = 1;
          else if (/material|intens/.test(lab)) effHMM = 0;
          else effHMM = null;
        }

        rows.push({
          country: c,
          bloc,
          EU: includeEU ? (bloc === "EU" ? 1 : 0) : 0,
          year: t.year,
          dy,
          SD: state === "SD" ? 1 : 0,
          END: state === "END" ? 1 : 0,
          EC: state === "EC" ? 1 : 0,
          envPlus:
            state && new Set(["SD", "RD", "RC", "RND"]).has(state) ? 1 : 0,
          effHMM
        });
      }
    }
    if (!rows.length) return { rows: [], includeEU: false };
    return { rows, includeEU };
  }

  // ——— HMM diagnostics ———
  function hmmDiagnostics(rows) {
    const hasEff = rows.filter((r) => Number.isFinite(r.effHMM));
    const cov = hasEff.length;
    const uniq = new Set(hasEff.map((r) => r.effHMM));
    const varOK = uniq.size >= 2;
    const pairs = rows.filter(
      (r) => Number.isFinite(r.effHMM) && Number.isFinite(r.envPlus)
    );
    const dup = pairs.length
      ? pairs.filter((r) => r.effHMM === r.envPlus).length / pairs.length
      : NaN;
    return { cov, varOK, dup, pairs: pairs.length };
  }

  // ——— Prepare per-model sample (FE por submuestra) ———
  function prepareModelSample(baseRows, reg, includeEU) {
    const need = includeEU ? [reg, "EU", `${reg}_EU`] : [reg];
    const rows = baseRows.filter(
      (r) => Number.isFinite(r.dy) && need.every((k) => Number.isFinite(r[k]))
    );
    if (!rows.length) return { rows: [], yearFE: [], baseYear: null };

    const cleaned = rows.map((r) => {
      const o = { ...r };
      Object.keys(o).forEach((k) => {
        if (k.startsWith("FE_")) delete o[k];
      });
      return o;
    });

    const years = Array.from(new Set(cleaned.map((r) => r.year))).sort(
      (a, b) => a - b
    );
    const baseYear = years[0];
    const yearFE = years.filter((y) => y !== baseYear).map((y) => `FE_${y}`);
    for (const r of cleaned) {
      for (const k of yearFE) r[k] = +k.slice(3) === r.year ? 1 : 0;
    }
    return { rows: cleaned, yearFE, baseYear };
  }

  // ——— Fit models ———
  function fitModels(built, forceHMM, matchHMMRange) {
    let { rows: baseRows, includeEU } = built;
    if (!baseRows.length)
      return {
        fits: [],
        dropHMM: false,
        diag: { cov: 0, varOK: false, dup: NaN, pairs: 0 }
      };

    const diagAll = hmmDiagnostics(baseRows);
    if (matchHMMRange && diagAll.cov > 0) {
      baseRows = baseRows.filter((r) => Number.isFinite(r.effHMM));
    }
    const diag = hmmDiagnostics(baseRows);
    const dropHMM = forceHMM
      ? false
      : diag.cov === 0 || !diag.varOK || (diag.pairs > 0 && diag.dup === 1);

    const regs = ["SD", "END", "EC", "envPlus", ...(dropHMM ? [] : ["effHMM"])];
    const fits = [];

    for (const reg of regs) {
      const rowsEU = baseRows.map((r) => {
        const o = { ...r };
        if (includeEU)
          o[`${reg}_EU`] =
            reg in o && Number.isFinite(o[reg]) ? o[reg] * o.EU : NaN;
        return o;
      });

      const smp = prepareModelSample(rowsEU, reg, includeEU);
      if (!smp.rows.length) continue;

      const X = includeEU
        ? [reg, "EU", `${reg}_EU`, ...smp.yearFE]
        : [reg, ...smp.yearFE];
      const fit = olsCluster(smp.rows, "dy", X);
      fits.push({
        model: includeEU
          ? `Δgap ~ 1 + ${reg} + EU + ${reg}×EU + Year FE`
          : `Δgap ~ 1 + ${reg} + Year FE`,
        reg,
        includeEU,
        ...fit
      });
    }
    return { fits, dropHMM, diag };
  }

  // ——— Derived EU effect and readable row helpers ———
  function deriveEUEffect(fit, reg) {
    if (!fit || !fit.beta || !fit.vcov) return null;
    const ixReg = fit.xKeys.indexOf(reg);
    const ixInt = fit.xKeys.indexOf(`${reg}_EU`);
    if (ixReg < 0 || ixInt < 0) return null;
    const bReg = fit.beta[ixReg],
      bInt = fit.beta[ixInt];
    const bEUeff = bReg + bInt;
    const V = fit.vcov;
    const varEU =
      (V[ixReg][ixReg] ?? 0) +
      (V[ixInt][ixInt] ?? 0) +
      2 * (V[ixReg][ixInt] ?? 0);
    const seEU = Math.sqrt(Math.max(0, varEU));
    const tEU = seEU ? bEUeff / seEU : NaN;
    return { coef: bEUeff, se: seEU, t: tEU };
  }

  function getStatByName(fit, name) {
    const idx = fit.xKeys.indexOf(name);
    if (idx < 0) return null;
    const s = fit.stats[idx]; // {coef,se,t}
    return s ? { ...s } : null;
  }

  // ——— Render: main table ———
  function renderTable(container, fits, coreMinSel, coreMaxSel, region) {
    container.innerHTML = "";

    const title = html`<h3 style="margin:6px 0 2px;">Tab. R3 — Panel regressions / correlations (clustered SE by country)</h3>`;
    const note = html`<div style="color:#555;margin-bottom:8px;">
      Region: <b>${region === "both" ? "EU + MERCOSUR" : region}</b>.
      Core sample for inference: <b>${coreMinSel}–${coreMaxSel}</b>.
      Dependent variable: Δgap (units: 10<sup>6</sup> tonnes, Mt). Models include year fixed effects (not shown).
    </div>`;
    container.append(title, note);

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "13.5px";
    table.innerHTML = `<thead><tr>
      <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Model</th>
      <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Regressor</th>
      <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">Coef. (10^6 t)</th>
      <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">SE (10^6 t)</th>
      <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">t</th>
      <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">N</th>
      <th style="text-align:right;padding:6px;border-bottom:1px solid #ddd;">Clusters</th>
    </tr></thead><tbody></tbody>`;
    const TB = table.querySelector("tbody");

    function appendRow(labelModel, labelReg, stat, N = "", G = "") {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:6px;border-bottom:1px solid #f1f1f1;">${labelModel}</td>
        <td style="padding:6px;border-bottom:1px solid #f1f1f1;">${labelReg}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid #f1f1f1;">${fmt(
          stat?.coef
        )}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid #f1f1f1;">${fmt(
          stat?.se
        )}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid #f1f1f1;">${
          Number.isFinite(stat?.t) ? stat.t.toFixed(2) : "—"
        }</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid #f1f1f1;">${N}</td>
        <td style="padding:6px;text-align:right;border-bottom:1px solid #f1f1f1;">${G}</td>
      `;
      TB.append(tr);
    }

    for (const fit of fits) {
      appendRow(fit.model, "Intercept", fit.stats[0], fit.N, fit.G);

      if (fit.includeEU) {
        const statMCS = getStatByName(fit, fit.reg);
        appendRow("", `MERCOSUR effect on ${fit.reg}`, statMCS);

        const statEU = deriveEUEffect(fit, fit.reg);
        appendRow(
          "",
          `EU effect on ${fit.reg} = ${fit.reg} + ${fit.reg}_EU`,
          statEU
        );

        const statDiff = getStatByName(fit, `${fit.reg}_EU`);
        appendRow("", `UE − MERCOSUR on ${fit.reg} (interaction)`, statDiff);

        const statEUbase = getStatByName(fit, "EU");
        if (statEUbase)
          appendRow("", `EU baseline (when ${fit.reg}=0)`, statEUbase);
      } else {
        const blocName =
          controls.querySelector("#r3_region").value === "EU"
            ? "EU"
            : "MERCOSUR";
        const statBloc = getStatByName(fit, fit.reg);
        appendRow("", `${blocName} effect on ${fit.reg}`, statBloc);
      }
    }

    container.append(table);
  }

  // ——— Footnote with diagnostics ———
  function renderFoot(
    container,
    dropHMM,
    diag,
    coreMinSel,
    coreMaxSel,
    forced,
    matched
  ) {
    const foot = html`<div style="color:#666;margin-top:8px;font-size:12.5px;">
      Standard errors clustered by country (Arellano). Models include year fixed effects (coefficients omitted).
      Core sample: ${coreMinSel}–${coreMaxSel}. Units: coefficients and SE in 10<sup>6</sup> tonnes (Mt).<br/>
      HMM diagnostics — coverage: <b>${diag.cov}</b> obs; variation: <b>${
      diag.varOK ? "OK" : "insufficient"
    }</b>;
      duplication with envPlus: <b>${
        Number.isFinite(diag.dup) ? (diag.dup * 100).toFixed(1) + "%" : "NA"
      }</b> (pairs=${diag.pairs}).
      ${matched ? "All models estimated on the HMM-covered subsample. " : ""}
      ${
        forced
          ? "HMM inclusion was forced by user preference."
          : dropHMM
          ? "HMM contrast omitted due to insufficient or duplicative coverage relative to the Tapio proxy."
          : "HMM contrast included."
      }
    </div>`;
    container.append(foot);
  }

  // ——— Compose render ———
  async function recompute() {
    out.innerHTML = "";

    const region = controls.querySelector("#r3_region").value;
    let y0 = +controls.querySelector("#r3_y0").value || defaultStart;
    let y1 = +controls.querySelector("#r3_y1").value || defaultEnd;
    const forceHMM = controls.querySelector("#r3_force_hmm").checked;
    const matchHMM = controls.querySelector("#r3_match_hmm").checked;

    if (y0 > y1) [y0, y1] = [y1, y0];
    y0 = Math.max(minAvail, Math.floor(y0));
    y1 = Math.min(maxAvail, Math.floor(y1));

    const coreMinSel = y0;
    const coreMaxSel = y1;

    const built = buildRows(region, coreMinSel, coreMaxSel);
    if (!built.rows.length) {
      out.append(
        html`<div style="color:#900;">No Δgap observations for the selected core sample (${coreMinSel}–${coreMaxSel}) and region (${region}).</div>`
      );
      return;
    }

    const { fits, dropHMM, diag } = fitModels(built, forceHMM, matchHMM);
    renderTable(out, fits, coreMinSel, coreMaxSel, region);

    renderFoot(
      out,
      dropHMM,
      diag,
      coreMinSel,
      coreMaxSel,
      forceHMM && dropHMM === false,
      matchHMM
    );
  }

  // Wire up
  controls.querySelector("#r3_apply").addEventListener("click", recompute);
  for (const id of ["#r3_y0", "#r3_y1"]) {
    controls.querySelector(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") recompute();
    });
  }
  controls.querySelector("#r3_region").addEventListener("change", recompute);
  controls.querySelector("#r3_force_hmm").addEventListener("change", recompute);
  controls.querySelector("#r3_match_hmm").addEventListener("change", recompute);

  // First paint
  await recompute();
  return wrap;
}


export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["mfa_filled.csv", {url: new URL("./files/4a160eb440b8af888ae17a172c59e7e52b287b3d7623e9a48212ed09627f99285af600aca97b1191bdbb72a914f0181ebdbd5483afac55d494b7acd2b58aa37c.csv", import.meta.url), mimeType: "text/csv", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("mfa_filled")).define("mfa_filled", ["__query","FileAttachment","invalidation"], _mfa_filled);
  main.variable(observer("longData")).define("longData", ["mfa_filled"], _longData);
  main.variable(observer("blocsResolved")).define("blocsResolved", _blocsResolved);
  main.variable(observer("countriesInData")).define("countriesInData", ["longData"], _countriesInData);
  main.variable(observer("countriesUE")).define("countriesUE", ["blocsResolved","countriesInData"], _countriesUE);
  main.variable(observer("countriesMCS")).define("countriesMCS", ["blocsResolved","countriesInData"], _countriesMCS);
  main.variable(observer("viewof regionMode")).define("viewof regionMode", ["Inputs"], _regionMode);
  main.variable(observer("regionMode")).define("regionMode", ["Generators", "viewof regionMode"], (G, _) => G.input(_));
  main.variable(observer("viewof countryPicker")).define("viewof countryPicker", ["Inputs","countriesUE","countriesMCS"], _countryPicker);
  main.variable(observer("countryPicker")).define("countryPicker", ["Generators", "viewof countryPicker"], (G, _) => G.input(_));
  main.variable(observer("selectedCountries")).define("selectedCountries", ["regionMode","countriesUE","countriesMCS","countryPicker"], _selectedCountries);
  main.variable(observer("flowOptions")).define("flowOptions", ["longData"], _flowOptions);
  main.variable(observer("defaultFlow")).define("defaultFlow", ["flowOptions"], _defaultFlow);
  main.variable(observer("viewof flow")).define("viewof flow", ["Inputs","flowOptions","defaultFlow"], _flow);
  main.variable(observer("flow")).define("flow", ["Generators", "viewof flow"], (G, _) => G.input(_));
  main.variable(observer("unitOfFlow")).define("unitOfFlow", ["longData","flow"], _unitOfFlow);
  main.variable(observer("yearsAll")).define("yearsAll", ["longData"], _yearsAll);
  main.variable(observer("viewof yearStart")).define("viewof yearStart", ["Inputs","yearsAll"], _yearStart);
  main.variable(observer("yearStart")).define("yearStart", ["Generators", "viewof yearStart"], (G, _) => G.input(_));
  main.variable(observer("viewof yearEnd")).define("viewof yearEnd", ["Inputs","yearStart","yearsAll"], _yearEnd);
  main.variable(observer("yearEnd")).define("yearEnd", ["Generators", "viewof yearEnd"], (G, _) => G.input(_));
  main.variable(observer("viewof normalizeMode")).define("viewof normalizeMode", ["Inputs"], _normalizeMode);
  main.variable(observer("normalizeMode")).define("normalizeMode", ["Generators", "viewof normalizeMode"], (G, _) => G.input(_));
  main.variable(observer("viewof smoothWin")).define("viewof smoothWin", ["Inputs"], _smoothWin);
  main.variable(observer("smoothWin")).define("smoothWin", ["Generators", "viewof smoothWin"], (G, _) => G.input(_));
  main.variable(observer("viewof maxPanels")).define("viewof maxPanels", ["Inputs"], _maxPanels);
  main.variable(observer("maxPanels")).define("maxPanels", ["Generators", "viewof maxPanels"], (G, _) => G.input(_));
  main.variable(observer("seriesPerCountry")).define("seriesPerCountry", ["yearStart","yearEnd","longData","flow","selectedCountries","smoothWin","normalizeMode","sortMode"], _seriesPerCountry);
  main.variable(observer("seriesForRidge")).define("seriesForRidge", ["yearStart","yearEnd","selectedCountries","longData","flow","smoothWin"], _seriesForRidge);
  main.variable(observer("Plotly")).define("Plotly", ["require"], _Plotly);
  main.variable(observer("normalizeSeries")).define("normalizeSeries", ["normalizeMode","seriesForRidge"], _normalizeSeries);
  main.variable(observer("viewof sortMode")).define("viewof sortMode", ["Inputs"], _sortMode);
  main.variable(observer("sortMode")).define("sortMode", ["Generators", "viewof sortMode"], (G, _) => G.input(_));
  main.variable(observer("rankedSeries")).define("rankedSeries", ["normalizeSeries","seriesForRidge","normalizeMode","sortMode"], _rankedSeries);
  main.variable(observer("fullBleedStyle")).define("fullBleedStyle", ["html"], _fullBleedStyle);
  main.variable(observer("stackedCountryCharts")).define("stackedCountryCharts", ["html","rankedSeries","normalizeMode","unitOfFlow","Plotly","ResizeObserver","invalidation"], _stackedCountryCharts);
  main.variable(observer("driverOptions")).define("driverOptions", ["longData"], _driverOptions);
  main.variable(observer("viewof driverFlow")).define("viewof driverFlow", ["Inputs","driverOptions"], _driverFlow);
  main.variable(observer("driverFlow")).define("driverFlow", ["Generators", "viewof driverFlow"], (G, _) => G.input(_));
  main.variable(observer("viewof tapioTol")).define("viewof tapioTol", ["Inputs"], _tapioTol);
  main.variable(observer("tapioTol")).define("tapioTol", ["Generators", "viewof tapioTol"], (G, _) => G.input(_));
  main.variable(observer("tapioPalette")).define("tapioPalette", _tapioPalette);
  main.variable(observer("tapioStateName")).define("tapioStateName", _tapioStateName);
  main.variable(observer("tapioClassify")).define("tapioClassify", _tapioClassify);
  main.variable(observer("tapioByCountry")).define("tapioByCountry", ["tapioTol","yearStart","yearEnd","selectedCountries","longData","flow","driverFlow","tapioClassify","tapioPalette"], _tapioByCountry);
  main.variable(observer("tapioCatalog")).define("tapioCatalog", _tapioCatalog);
  main.variable(observer("viewof tapioSelector")).define("viewof tapioSelector", ["tapioCatalog","Inputs"], _tapioSelector);
  main.variable(observer("tapioSelector")).define("tapioSelector", ["Generators", "viewof tapioSelector"], (G, _) => G.input(_));
  main.variable(observer("selectedTapioStates")).define("selectedTapioStates", ["tapioSelector","tapioCatalog"], _selectedTapioStates);
  main.variable(observer("tapioColor")).define("tapioColor", ["tapioCatalog"], _tapioColor);
  main.variable(observer("tapioHover")).define("tapioHover", _tapioHover);
  main.variable(observer("stackedCountryChartsTapio")).define("stackedCountryChartsTapio", ["html","rankedSeries","normalizeMode","unitOfFlow","tapioByCountry","selectedTapioStates","Plotly","ResizeObserver","invalidation"], _stackedCountryChartsTapio);
  main.variable(observer("viewof extMode")).define("viewof extMode", ["Inputs"], _extMode);
  main.variable(observer("extMode")).define("extMode", ["Generators", "viewof extMode"], (G, _) => G.input(_));
  main.variable(observer()).define(["extMode"], _43);
  main.variable(observer("unitFor")).define("unitFor", ["longData"], _unitFor);
  main.variable(observer("flowMap")).define("flowMap", ["longData"], _flowMap);
  main.variable(observer("seriesExternalization")).define("seriesExternalization", ["extMode","flowMap","yearStart","yearEnd","selectedCountries","smoothWin"], _seriesExternalization);
  main.variable(observer("rankedExternalization")).define("rankedExternalization", ["seriesExternalization","sortMode","maxPanels"], _rankedExternalization);
  main.variable(observer("unitExternalization")).define("unitExternalization", ["extMode","unitFor"], _unitExternalization);
  main.variable(observer("tapioByCountryForImpact")).define("tapioByCountryForImpact", ["tapioTol","extMode","selectedCountries","longData","yearStart","yearEnd","driverFlow","tapioClassify","tapioPalette"], _tapioByCountryForImpact);
  main.variable(observer("ridgeExternalizationTapio")).define("ridgeExternalizationTapio", ["d3","html","rankedExternalization","normalizeMode","unitExternalization","selectedTapioStates","sortMode","tapioByCountryForImpact","Plotly","ResizeObserver","invalidation"], _ridgeExternalizationTapio);
  main.variable(observer("viewof ts_flows")).define("viewof ts_flows", ["flowOptions","longData","Inputs"], _ts_flows);
  main.variable(observer("ts_flows")).define("ts_flows", ["Generators", "viewof ts_flows"], (G, _) => G.input(_));
  main.variable(observer("timeSeries_multiIndicator_Tapio")).define("timeSeries_multiIndicator_Tapio", ["Plotly","html","longData","normalizeMode","smoothWin","yearStart","yearEnd","selectedCountries","ts_flows","rankedSeries","unitOfFlow","unitFor","extMode","driverFlow","tapioTol","tapioPalette","selectedTapioStates","tapioClassify","ResizeObserver","invalidation"], _timeSeries_multiIndicator_Tapio);
  main.variable(observer("hmm_Tapio_overlay")).define("hmm_Tapio_overlay", ["Plotly","html","longData","globalThis","yearStart","yearEnd","selectedCountries","driverFlow","extMode","tapioPalette","tapioClassify","tapioTol","invalidation"], _hmm_Tapio_overlay);
  main.variable(observer("R_yearStart")).define("R_yearStart", _R_yearStart);
  main.variable(observer("R_yearEnd_infer")).define("R_yearEnd_infer", _R_yearEnd_infer);
  main.variable(observer("R_rollK")).define("R_rollK", _R_rollK);
  main.variable(observer("R_helpers")).define("R_helpers", _R_helpers);
  main.variable(observer("Fig_R1_TapioSharesByBloc")).define("Fig_R1_TapioSharesByBloc", ["R_helpers","countriesUE","R_yearStart","R_yearEnd_infer","longData","flow","driverFlow","tapioTol","tapioClassify","countriesMCS","Plotly"], _Fig_R1_TapioSharesByBloc);
  main.variable(observer("viewof R2_bloc")).define("viewof R2_bloc", ["Inputs"], _R2_bloc);
  main.variable(observer("R2_bloc")).define("R2_bloc", ["Generators", "viewof R2_bloc"], (G, _) => G.input(_));
  main.variable(observer("Fig_R2_TapioStrips_with_Rolling")).define("Fig_R2_TapioStrips_with_Rolling", ["R_helpers","R2_bloc","countriesUE","countriesMCS","R_yearStart","R_yearEnd_infer","longData","flow","driverFlow","tapioTol","tapioClassify","R_rollK","Plotly"], _Fig_R2_TapioStrips_with_Rolling);
  main.variable(observer("Tab_R1_StateProps_Elasticity_Tests")).define("Tab_R1_StateProps_Elasticity_Tests", ["R_helpers","countriesUE","R_yearStart","R_yearEnd_infer","longData","flow","driverFlow","tapioTol","tapioClassify","countriesMCS"], _Tab_R1_StateProps_Elasticity_Tests);
  main.variable(observer("HMM_posteriors_by_bloc")).define("HMM_posteriors_by_bloc", ["Plotly","html","longData","globalThis","yearStart","yearEnd","driverFlow","extMode","tapioTol","tapioClassify","selectedCountries"], _HMM_posteriors_by_bloc);
  main.variable(observer("Tab_R2_regime_shares_and_IC")).define("Tab_R2_regime_shares_and_IC", ["longData","html","globalThis","yearStart","yearEnd","driverFlow","extMode","tapioTol","tapioClassify"], _Tab_R2_regime_shares_and_IC);
  main.variable(observer("HMM_shared")).define("HMM_shared", ["globalThis","longData","yearStart","yearEnd","driverFlow","extMode","tapioTol","tapioClassify"], _HMM_shared);
  main.variable(observer("Fig_R3_emissions")).define("Fig_R3_emissions", ["HMM_shared","html","Plotly"], _Fig_R3_emissions);
  main.variable(observer("Fig_R4_transitions")).define("Fig_R4_transitions", ["HMM_shared","html","Plotly"], _Fig_R4_transitions);
  main.variable(observer("Fig_R5_decoded_heatmaps")).define("Fig_R5_decoded_heatmaps", ["HMM_shared","html","Plotly"], _Fig_R5_decoded_heatmaps);
  main.variable(observer("Fig_R6_bands_filled_fullbleed")).define("Fig_R6_bands_filled_fullbleed", ["HMM_shared","html","Plotly"], _Fig_R6_bands_filled_fullbleed);
  main.variable(observer("Fig_R6_stackedFilled")).define("Fig_R6_stackedFilled", ["HMM_shared","html","Plotly"], _Fig_R6_stackedFilled);
  main.variable(observer("Fig_R4_transitions_byRegion")).define("Fig_R4_transitions_byRegion", ["HMM_shared","html","regionMode","longData","tapioClassify","Plotly"], _Fig_R4_transitions_byRegion);
  main.variable(observer("viewof gapMeasure")).define("viewof gapMeasure", ["Inputs"], _gapMeasure);
  main.variable(observer("gapMeasure")).define("gapMeasure", ["Generators", "viewof gapMeasure"], (G, _) => G.input(_));
  main.variable(observer("helpers_gap")).define("helpers_gap", ["globalThis","longData"], _helpers_gap);
  main.variable(observer("gapPanel_all")).define("gapPanel_all", ["helpers_gap","extMode","longData","countriesUE","countriesMCS"], _gapPanel_all);
  main.variable(observer("gapByBloc")).define("gapByBloc", ["yearStart","d3","gapPanel_all","yearEnd","countriesUE","countriesMCS"], _gapByBloc);
  main.variable(observer("tapioByCY")).define("tapioByCY", ["tapioByCountryForImpact"], _tapioByCY);
  main.variable(observer("decodedRegimeByCY")).define("decodedRegimeByCY", ["helpers_gap","yearStart","d3","gapPanel_all","yearEnd","tapioByCY"], _decodedRegimeByCY);
  main.variable(observer("fig_R6_gapTrajectories")).define("fig_R6_gapTrajectories", ["Plotly","require","helpers_gap","gapByBloc","extMode","gapMeasure","Inputs","html","d3","invalidation"], _fig_R6_gapTrajectories);
  main.variable(observer("fig_R7_gapByRegime")).define("fig_R7_gapByRegime", ["Plotly","require","helpers_gap","gapMeasure","yearStart","d3","gapPanel_all","yearEnd","decodedRegimeByCY","tapioByCY","html","tapioPalette","invalidation"], _fig_R7_gapByRegime);
  main.variable(observer()).define(["md"], _79);
  main.variable(observer("fig_R8_typology")).define("fig_R8_typology", ["Plotly","require","html","yearEnd","yearStart","d3","gapPanel_all","decodedRegimeByCY","countriesUE","countriesMCS","invalidation"], _fig_R8_typology);
  main.variable(observer("fig_R8_typology_grid")).define("fig_R8_typology_grid", ["Plotly","require","html","d3","gapPanel_all","decodedRegimeByCY","countriesUE","countriesMCS","invalidation"], _fig_R8_typology_grid);
  main.variable(observer("tab_R3_regressions")).define("tab_R3_regressions", ["d3","helpers_gap","gapMeasure","gapByBloc","gapPanel_all","html","tapioByCY","decodedRegimeByCY"], _tab_R3_regressions);
  return main;
}
