// ---------------------------------------------------------------
// Definición de las 9 capas del geoportal.
// "vista" = nombre de la vista *_geojson creada en Supabase.
// "tipo"  = point | line | polygon, para saber cómo dibujarla.
// ---------------------------------------------------------------
const CAPAS = [
  { id: "buffer5000", vista: "buffer5000_geojson", tipo: "polygon", color: "#5C7A8A" },
  { id: "buffer1000", vista: "buffer1000_geojson", tipo: "polygon", color: "#5C7A8A" },
  { id: "buffer500", vista: "buffer500_geojson", tipo: "polygon", color: "#5C7A8A" },
  { id: "poligonos_asistencias", vista: "poligonos_asistencias_geojson", tipo: "polygon", color: "#E3C48C" },
  { id: "area_distribucion", vista: "area_distribucion_geojson", tipo: "polygon", color: "#9DBBA8" },
  { id: "rutas", vista: "rutas_geojson", tipo: "line", color: "#A24936" },
  { id: "asistencias", vista: "asistencias_geojson", tipo: "point", color: "#C1892F" },
  { id: "domicilios", vista: "domicilios_geojson", tipo: "point", color: "#2F4B3C" },
  { id: "distrital", vista: "distrital_geojson", tipo: "point", color: "#2B2B26" },
];

// Mapa base centrado en Azuay, Ecuador
const mapa = L.map("mapa", { zoomControl: true }).setView([-2.9, -79.0], 10);

mapa.createPane("pane-polygon").style.zIndex = 200;
mapa.createPane("pane-line").style.zIndex = 300;
mapa.createPane("pane-point").style.zIndex = 400;

// Varias opciones de mapa base para elegir
const baseCalles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap", maxZoom: 19
});
const baseSatelital = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri", maxZoom: 19
});
const baseRelieve = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenTopoMap (CC-BY-SA)", maxZoom: 17
});
const baseClaro = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 19
});

baseCalles.addTo(mapa);

L.control.layers(
  { "Calles": baseCalles, "Satelital": baseSatelital, "Relieve": baseRelieve, "Claro": baseClaro },
  null,
  { position: "topright", collapsed: true }
).addTo(mapa);

const indicadorEl = document.getElementById("contador-asistencias");

const featuresPorCapa = {};   // id -> array de Features GeoJSON (datos crudos, sin filtrar)
const capasActivas = {};      // id -> L.geoJSON actualmente dibujada en el mapa

// Estado de los filtros actuales
const FILTROS = { tecnico: "todos", desde: null, hasta: null };

// Nombres de mes en español, por si fecha_mes_ viene como texto y no como número
const MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

// Reconstruye una fecha real de JS a partir de fecha_anio / fecha_mes_ / fecha_dia_
function parseFechaAsistencia(props) {
  const anio = parseInt(props.fecha_anio, 10);
  let mes = parseInt(props.fecha_mes_, 10);
  if (isNaN(mes)) mes = MESES_ES[String(props.fecha_mes_ || "").trim().toLowerCase()];
  const dia = parseInt(props.fecha_dia_, 10) || 1;
  if (isNaN(anio) || !mes) return null;
  return new Date(anio, mes - 1, dia);
}

// Interpreta valores tipo bandera (SI/NO, 1/0, true/false) guardados como texto
function esVerdadero(valor) {
  if (valor === null || valor === undefined) return false;
  const s = String(valor).trim().toLowerCase();
  return ["1", "si", "sí", "true", "yes", "x"].includes(s);
}

function set(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

// Calcula los indicadores de la franja superior a partir de las asistencias YA filtradas
function actualizarIndicadoresAsistencias(featuresFiltradas) {
  let rural = 0, urbano = 0, d500 = 0, d1000 = 0, d5000 = 0, fuera5000 = 0, distrital = 0;

  featuresFiltradas.forEach(f => {
    const p = f.properties;
    const clas = String(p.clas || "").toLowerCase();
    if (clas.includes("rural")) rural++;
    if (clas.includes("urban")) urbano++;
    if (esVerdadero(p.buffer_500)) d500++;
    if (esVerdadero(p.buffer_100)) d1000++;
    if (esVerdadero(p.buffer_501)) d5000++; else fuera5000++;
    if (esVerdadero(p.buff_distr)) distrital++;
  });

  set("ind-total", featuresFiltradas.length);
  set("ind-rural", rural);
  set("ind-urbano", urbano);
  set("ind-500", d500);
  set("ind-1000", d1000);
  set("ind-5000", d5000);
  set("ind-fuera5000", fuera5000);
  set("ind-distrital", distrital);
}

// Calcula el tiempo/distancia de traslado promedio desde la capa "rutas",
// respetando el filtro de técnico activo (tabla de rutas, una fila por técnico)
function actualizarTiempoTraslado() {
  let rutas = featuresPorCapa["rutas"] || [];
  if (FILTROS.tecnico !== "todos") {
    rutas = rutas.filter(f => String(f.properties.id_tec) === FILTROS.tecnico);
  }
  if (!rutas.length) { set("ind-tiempo", "—"); return; }

  const prom = (campo) => rutas.reduce((s, f) => s + (parseFloat(f.properties[campo]) || 0), 0) / rutas.length;
  const min = prom("tiempo_min");
  const km = prom("dist_km");
  set("ind-tiempo", `${min.toFixed(0)} min / ${km.toFixed(1)} km`);
}
const POPUP_CAMPOS = {
  distrital: [
    ["nombre", "Oficina"],
  ],
  domicilios: [
    ["a2_nombres", "Técnico"],
    ["b1__provin", "Provincia"],
    ["b2__cantó", "Cantón"],
    ["b3__parroq", "Parroquia"],
    ["a1__númer", "Cédula"],
    ["b4__calle_", "Calle principal"],
    ["b5__númer", "N.º calle"],
    ["b6__calle_", "Calle secundaria"],
  ],
  rutas: [
    ["tiempo_min", "Tiempo de traslado (min)"],
    ["dist_km", "Distancia de traslado (km)"],
  ],
  asistencias: [
    ["nombre_pro", "Provincia"],
    ["nombre_can", "Cantón"],
    ["nombre_par", "Parroquia"],
    ["cedula_pro", "Cédula"],
    ["fecha_anio", "Año"],
    ["fecha_mes_", "Mes"],
    ["fecha_dia_", "Día"],
    ["aer_vis", "AER"],
    ["tipo_vis", "Tipo de visita"],
    ["categoria_", "Categoría"],
    ["tematica", "Temática"],
    ["actividad_", "Actividad"],
    ["rubro_ava", "Rubro"],
  ],
  poligonos_asistencias: [
    ["cedula_tec", "Cédula técnico"],
    ["tecnico_ma", "Técnico"],
  ],
  area_distribucion: [
    ["nombre", "Nombre"],
    ["cedula", "Cédula"],
  ],
  buffer500: [
    ["b4__calle_", "Calle principal"],
    ["b5__númer", "N.º calle"],
    ["b6__calle_", "Calle secundaria"],
    ["a2_nombres", "Técnico"],
    ["b1__provin", "Provincia"],
    ["b2__cantó", "Cantón"],
    ["b3__parroq", "Parroquia"],
  ],
  buffer1000: [
    ["b4__calle_", "Calle principal"],
    ["b5__númer", "N.º calle"],
    ["b6__calle_", "Calle secundaria"],
    ["a2_nombres", "Técnico"],
    ["b1__provin", "Provincia"],
    ["b2__cantó", "Cantón"],
    ["b3__parroq", "Parroquia"],
  ],
  buffer5000: [
    ["b4__calle_", "Calle principal"],
    ["b5__númer", "N.º calle"],
    ["b6__calle_", "Calle secundaria"],
    ["a2_nombres", "Técnico"],
    ["b1__provin", "Provincia"],
    ["b2__cantó", "Cantón"],
    ["b3__parroq", "Parroquia"],
  ],
};

function popupHTML(props, capaId) {
  const campos = POPUP_CAMPOS[capaId];
  if (!campos) {
    return Object.entries(props)
      .filter(([k]) => k !== "geom" && k !== "geojson")
      .map(([k, v]) => `<b>${k}:</b> ${v ?? "-"}`)
      .join("<br>");
  }
  return campos
    .filter(([k]) => k in props)
    .map(([k, label]) => `<b>${label}:</b> ${props[k] ?? "-"}`)
    .join("<br>");
}

// Paleta de colores para diferenciar cada técnico en el área de distribución
const PALETA_TECNICOS = [
  "#6B4C9A", "#1F7A8C", "#C1439E", "#3D8361", "#D68C45", "#4363D8",
  "#B5651D", "#8E44AD", "#2E8B57", "#CB4335", "#117864", "#7D6608"
];
const colorPorTecnico = new Map(); // id_tec -> color

function construirColoresPorTecnico() {
  const ids = [...new Set((featuresPorCapa["area_distribucion"] || [])
    .map(f => f.properties.id_tec)
    .filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));

  ids.forEach((id, i) => colorPorTecnico.set(String(id), PALETA_TECNICOS[i % PALETA_TECNICOS.length]));
}

function estiloCapa(capa) {
  if (capa.id === "distrital") {
    const officeIcon = L.divIcon({
      html: '<div style="font-size:22px;line-height:1;text-align:center;filter:drop-shadow(1px 1px 2px rgba(0,0,0,.4))">🏛️</div>',
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    return {
      pointToLayer: (f, latlng) => L.marker(latlng, { icon: officeIcon })
    };
  }
  if (capa.id === "domicilios") {
    const homeIcon = L.divIcon({
      html: '<div style="font-size:20px;line-height:1;text-align:center;filter:drop-shadow(1px 1px 2px rgba(0,0,0,.4))">🏠</div>',
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    return {
      pointToLayer: (f, latlng) => L.marker(latlng, { icon: homeIcon })
    };
  }
  if (capa.tipo === "point") {
    return {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 6, color: capa.color, fillColor: capa.color, fillOpacity: 0.85, weight: 1
      })
    };
  }
  if (capa.tipo === "line") {
    return { style: { color: capa.color, weight: 3 } };
  }
  if (capa.id === "area_distribucion") {
    return {
      style: (feature) => {
        const color = colorPorTecnico.get(String(feature.properties.id_tec)) || capa.color;
        return { color, weight: 1.5, fillColor: color, fillOpacity: 0.35 };
      }
    };
  }
  return { style: { color: capa.color, weight: 1.5, fillColor: capa.color, fillOpacity: 0.25 } };
}

// Decide si una feature debe verse, según los filtros activos
function featureVisible(capaId, props) {
  if (FILTROS.tecnico !== "todos" && "id_tec" in props) {
    if (String(props.id_tec) !== FILTROS.tecnico) return false;
  }
  if (capaId === "asistencias" && (FILTROS.desde || FILTROS.hasta)) {
    const fecha = parseFechaAsistencia(props);
    if (!fecha) return false; // sin fecha reconocible, se excluye al filtrar por rango
    if (FILTROS.desde && fecha < FILTROS.desde) return false;
    if (FILTROS.hasta && fecha > FILTROS.hasta) return false;
  }
  return true;
}

// Descarga los datos crudos (GeoJSON) de una capa desde Supabase
async function descargarCapa(capa) {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let todas = [];

  while (true) {
    const resp = await fetch(`${SUPABASE_URL}${capa.vista}?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        Prefer: "count=exact",
      }
    });
    if (!resp.ok) throw new Error(`${capa.vista}: ${resp.status}`);
    const filas = await resp.json();
    todas = todas.concat(filas);
    if (filas.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return todas
    .filter(f => f.geojson)
    .map(f => ({ type: "Feature", geometry: JSON.parse(f.geojson), properties: f }));
}

// (Re)dibuja una capa en el mapa aplicando los filtros actuales,
// respetando si su checkbox está activado o no.
function redibujarCapa(capa) {
  if (capasActivas[capa.id]) {
    mapa.removeLayer(capasActivas[capa.id]);
  }

  const featuresFiltradas = featuresPorCapa[capa.id].filter(f => featureVisible(capa.id, f.properties));

  const paneMap = { point: "pane-point", line: "pane-line", polygon: "pane-polygon" };
  const pane = paneMap[capa.tipo] || "overlayPane";

  const layer = L.geoJSON(featuresFiltradas, {
    ...estiloCapa(capa),
    pane,
    onEachFeature: (feature, lyr) => lyr.bindPopup(popupHTML(feature.properties, capa.id))
  });

  capasActivas[capa.id] = layer;

  const checkbox = document.querySelector(`input[data-layer="${capa.id}"]`);
  if (checkbox && checkbox.checked) layer.addTo(mapa);

  if (capa.id === "asistencias") {
    indicadorEl.textContent = `${featuresFiltradas.length} asistencias`;
    actualizarIndicadoresAsistencias(featuresFiltradas);
  }
}

function redibujarTodas() {
  CAPAS.forEach(redibujarCapa);
}

// Llena un <select> con opciones únicas, ordenadas
function poblarSelect(selectEl, valores, etiquetaTodos) {
  const unicos = [...new Set(valores.filter(v => v !== null && v !== undefined && v !== ""))]
    .sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));

  selectEl.innerHTML = `<option value="todos">${etiquetaTodos}</option>` +
    unicos.map(v => `<option value="${v}">${v}</option>`).join("");
}

function construirOpcionesDeFiltros() {
  const asistencias = featuresPorCapa["asistencias"] || [];
  const poligonos = featuresPorCapa["poligonos_asistencias"] || [];

  // Técnico: id_tec -> nombre (tecnico_ma), tomado de asistencias o polígonos de asistencias
  const mapaTecnicos = new Map();
  [...asistencias, ...poligonos].forEach(f => {
    const p = f.properties;
    if (p.id_tec && !mapaTecnicos.has(String(p.id_tec))) {
      mapaTecnicos.set(String(p.id_tec), p.tecnico_ma || String(p.id_tec));
    }
  });

  const selectTecnico = document.getElementById("filtro-tecnico");
  const entradas = [...mapaTecnicos.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  selectTecnico.innerHTML = `<option value="todos">Todos los técnicos</option>` +
    entradas.map(([id, nombre]) => `<option value="${id}">${nombre}</option>`).join("");
}

async function iniciar() {
  let cargadas = 0;
  for (const capa of CAPAS) {
    try {
      featuresPorCapa[capa.id] = await descargarCapa(capa);
      cargadas++;
      indicadorEl.textContent = `Cargando… ${cargadas}/${CAPAS.length}`;
    } catch (err) {
      console.error("Error cargando", capa.id, err);
      featuresPorCapa[capa.id] = [];
      indicadorEl.textContent = `Error cargando "${capa.id}"`;
    }
  }

  construirOpcionesDeFiltros();
  construirColoresPorTecnico();
  redibujarTodas();
  actualizarTiempoTraslado();
}

// Checkboxes: mostrar/ocultar cada capa (respetando el filtro activo)
document.querySelectorAll(".layer-item input").forEach(input => {
  input.addEventListener("change", () => {
    const id = input.dataset.layer;
    const layer = capasActivas[id];
    if (!layer) return;
    if (input.checked) layer.addTo(mapa);
    else mapa.removeLayer(layer);
  });
});

document.getElementById("btn-todas").addEventListener("click", () => {
  document.querySelectorAll(".layer-item input").forEach(input => {
    input.checked = true;
    input.dispatchEvent(new Event("change"));
  });
});
document.getElementById("btn-ninguna").addEventListener("click", () => {
  document.querySelectorAll(".layer-item input").forEach(input => {
    input.checked = false;
    input.dispatchEvent(new Event("change"));
  });
});

// Filtros: técnico, año y mes
document.getElementById("filtro-tecnico").addEventListener("change", e => {
  FILTROS.tecnico = e.target.value;
  redibujarTodas();
  actualizarTiempoTraslado();
});
document.getElementById("filtro-desde").addEventListener("change", e => {
  FILTROS.desde = e.target.value ? new Date(e.target.value + "T00:00:00") : null;
  redibujarCapa(CAPAS.find(c => c.id === "asistencias"));
});
document.getElementById("filtro-hasta").addEventListener("change", e => {
  FILTROS.hasta = e.target.value ? new Date(e.target.value + "T23:59:59") : null;
  redibujarCapa(CAPAS.find(c => c.id === "asistencias"));
});
document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
  FILTROS.tecnico = "todos";
  FILTROS.desde = null;
  FILTROS.hasta = null;
  document.getElementById("filtro-tecnico").value = "todos";
  document.getElementById("filtro-desde").value = "";
  document.getElementById("filtro-hasta").value = "";
  redibujarTodas();
  actualizarTiempoTraslado();
});

iniciar();