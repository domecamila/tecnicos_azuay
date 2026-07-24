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

// Herramienta de medición custom
const MedirControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd() {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control-medir");
    container.innerHTML = `<button id="btn-medir" title="Medir distancia">📏</button>`;
    L.DomEvent.disableClickPropagation(container);
    this._activo = false;
    this._puntos = [];
    this._linea = null;
    this._marcadores = [];
    this._tooltip = null;

    container.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggle();
    });
    return container;
  },
  _toggle() {
    this._activo = !this._activo;
    const btn = document.getElementById("btn-medir");
    if (this._activo) {
      btn.style.background = "#C1892F";
      btn.style.color = "#fff";
      mapa.getContainer().style.cursor = "crosshair";
      this._onClickFn = (e) => this._agregarPunto(e.latlng);
      this._onDblClickFn = (e) => { L.DomEvent.stop(e); this._finalizar(); };
      mapa.on("click", this._onClickFn);
      mapa.on("dblclick", this._onDblClickFn);
    } else {
      this._limpiar();
      btn.style.background = "";
      btn.style.color = "";
      mapa.getContainer().style.cursor = "";
      mapa.off("click", this._onClickFn);
      mapa.off("dblclick", this._onDblClickFn);
    }
  },
  _agregarPunto(latlng) {
    this._puntos.push(latlng);
    const icon = L.divIcon({
      html: '<div style="width:10px;height:10px;background:#C1892F;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.5)"></div>',
      className: "",
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    const m = L.marker(latlng, { icon, pane: "markerPane" }).addTo(mapa);
    this._marcadores.push(m);

    if (this._puntos.length > 1) {
      if (this._linea) mapa.removeLayer(this._linea);
      this._linea = L.polyline(this._puntos, {
        color: "#C1892F", weight: 3, dashArray: "6 4", pane: "pane-line"
      }).addTo(mapa);
    }

    if (this._tooltip) this._tooltip.remove();
    if (this._puntos.length >= 2) {
      const dist = this._distanciaTotal();
      const texto = dist >= 1000
        ? `${(dist / 1000).toFixed(2)} km`
        : `${dist.toFixed(0)} m`;
      this._tooltip = L.tooltip({ permanent: true, direction: "top", className: "medir-tooltip" })
        .setLatLng(latlng)
        .setContent(`📏 ${texto}`)
        .addTo(mapa);
    }
  },
  _distanciaTotal() {
    let total = 0;
    for (let i = 1; i < this._puntos.length; i++) {
      total += this._puntos[i].distanceTo(this._puntos[i - 1]);
    }
    return total;
  },
  _finalizar() {
    if (this._puntos.length < 2) return;
    const dist = this._distanciaTotal();
    const texto = dist >= 1000
      ? `Distancia total: ${(dist / 1000).toFixed(2)} km`
      : `Distancia total: ${dist.toFixed(0)} m`;
    if (this._tooltip) this._tooltip.remove();
    L.popup({ className: "medir-popup" })
      .setLatLng(this._puntos[this._puntos.length - 1])
      .setContent(`📏 <b>${texto}</b><br><small>Doble clic para nueva medición</small>`)
      .openOn(mapa);
  },
  _limpiar() {
    this._puntos = [];
    this._marcadores.forEach(m => mapa.removeLayer(m));
    this._marcadores = [];
    if (this._linea) { mapa.removeLayer(this._linea); this._linea = null; }
    if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
    mapa.closePopup();
  }
});
new MedirControl().addTo(mapa);

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
    const url = `${SUPABASE_URL}${capa.vista}?select=*&offset=${offset}&limit=${PAGE_SIZE}`;
    const resp = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
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

// =============================================
// Asistente simple del geoportal (sin API externa)
// =============================================
(function() {
  const chatToggle = document.getElementById("chatbot-toggle");
  const chatPanel = document.getElementById("chatbot-panel");
  const chatClose = document.getElementById("chatbot-close");
  const chatMessages = document.getElementById("chatbot-messages");
  const chatInput = document.getElementById("chatbot-text");
  const chatSend = document.getElementById("chatbot-send");

  chatToggle.addEventListener("click", () => chatPanel.classList.toggle("open"));
  chatClose.addEventListener("click", () => chatPanel.classList.remove("open"));

  function addMsg(html, cls) {
    const div = document.createElement("div");
    div.className = `chat-msg ${cls}`;
    div.innerHTML = html;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Nombres de mes en español
  const MES_NOM = {
    enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5,
    julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11
  };
  const MES_ABREV = {
    ene:0, feb:1, mar:2, abr:3, may:4, jun:5,
    jul:6, ago:7, sep:8, oct:9, nov:10, dic:11
  };

  function normalizar(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  // Buscar técnico por nombre parcial (fuzzy)
  function buscarTecnico(texto) {
    const norm = normalizar(texto);
    const tecnicos = [...new Set(
      (featuresPorCapa["asistencias"] || [])
        .concat(featuresPorCapa["poligonos_asistencias"] || [])
        .map(f => f.properties.tecnico_ma)
        .filter(Boolean)
    )];
    // Intento exacto
    let encontrado = tecnicos.find(t => normalizar(t) === norm);
    if (encontrado) return encontrado;
    // Contiene
    encontrado = tecnicos.find(t => normalizar(t).includes(norm) || norm.includes(normalizar(t)));
    if (encontrado) return encontrado;
    // Por palabras
    const palabras = norm.split(/\s+/);
    encontrado = tecnicos.find(t => {
      const tn = normalizar(t);
      return palabras.every(p => tn.includes(p));
    });
    return encontrado || null;
  }

  function buscarIdTecnico(nombre) {
    const norm = normalizar(nombre);
    const feats = (featuresPorCapa["asistencias"] || [])
      .concat(featuresPorCapa["poligonos_asistencias"] || []);
    for (const f of feats) {
      if (f.properties.tecnico_ma && normalizar(f.properties.tecnico_ma) === norm) {
        return String(f.properties.id_tec);
      }
    }
    return null;
  }

  // Detectar fechas en el texto
  function detectarFechas(texto) {
    const norm = normalizar(texto);
    const hoy = new Date();
    let desde = null, hasta = null;

    // "semana pasada"
    if (norm.includes("semana pasada")) {
      hasta = new Date(hoy); hasta.setDate(hoy.getDate() - hoy.getDay());
      desde = new Date(hasta); desde.setDate(hasta.getDate() - 6);
      return { desde, hasta };
    }
    // "semana anterior"
    if (norm.includes("semana anterior")) {
      hasta = new Date(hoy); hasta.setDate(hoy.getDate() - hoy.getDay() - 7);
      desde = new Date(hasta); desde.setDate(hasta.getDate() - 6);
      return { desde, hasta };
    }
    // "este mes"
    if (norm.includes("este mes")) {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = hoy;
      return { desde, hasta };
    }
    // "mes pasado"
    if (norm.includes("mes pasado") || norm.includes("el mes anterior")) {
      const mp = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      desde = mp;
      hasta = new Date(mp.getFullYear(), mp.getMonth() + 1, 0);
      return { desde, hasta };
    }
    // "año anterior" / "el año pasado"
    if (norm.includes("ano anterior") || norm.includes("ano pasado") || norm.includes("año anterior") || norm.includes("año pasado")) {
      desde = new Date(hoy.getFullYear() - 1, 0, 1);
      hasta = new Date(hoy.getFullYear() - 1, 11, 31);
      return { desde, hasta };
    }
    // "este año"
    if (norm.includes("este ano") || norm.includes("este año")) {
      desde = new Date(hoy.getFullYear(), 0, 1);
      hasta = hoy;
      return { desde, hasta };
    }

    // Buscar nombre de mes
    for (const [nom, idx] of Object.entries(MES_NOM)) {
      if (norm.includes(nom)) {
        const anio = hoy.getFullYear();
        desde = new Date(anio, idx, 1);
        hasta = new Date(anio, idx + 1, 0);
        return { desde, hasta };
      }
    }
    for (const [abrev, idx] of Object.entries(MES_ABREV)) {
      if (norm.includes(abrev)) {
        const anio = hoy.getFullYear();
        desde = new Date(anio, idx, 1);
        hasta = new Date(anio, idx + 1, 0);
        return { desde, hasta };
      }
    }

    return null;
  }

  // Detectar qué tipo de consulta quiere
  function detectarTipoConsulta(texto) {
    const norm = normalizar(texto);
    if (norm.includes("asistencia")) return "asistencias";
    if (norm.includes("domicilio")) return "domicilios";
    if (norm.includes("ruta") || norm.includes("movilizacion") || norm.includes("traslado")) return "rutas";
    if (norm.includes("buffer") || norm.includes("cobertura")) return "buffers";
    if (norm.includes("area") || norm.includes("distribucion")) return "area_distribucion";
    if (norm.includes("poligono")) return "poligonos_asistencias";
    if (norm.includes("distrital") || norm.includes("oficina")) return "distrital";
    if (norm.includes("resumen") || norm.includes("todo") || norm.includes("general")) return "resumen";
    return null;
  }

  function contarPorCampo(features, campo) {
    const mapa = {};
    features.forEach(f => {
      const val = f.properties[campo] || "Sin dato";
      mapa[val] = (mapa[val] || 0) + 1;
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }

  function generarRespuesta(tipo, tecnico, fechas, texto) {
    const norm = normalizar(texto);
    const respuestas = [];

    // Respuestas generales
    if (norm.includes("cuantos tecnicos") || norm.includes("cuántos técnicos") || norm.includes("listado de tecnicos") || norm.includes("cuantos hay")) {
      const tecnicos = [...new Set(
        (featuresPorCapa["asistencias"] || [])
          .concat(featuresPorCapa["poligonos_asistencias"] || [])
          .map(f => f.properties.tecnico_ma)
          .filter(Boolean)
      )].sort();
      respuestas.push(`<strong>Técnicos registrados: ${tecnicos.length}</strong>`);
      respuestas.push("<ul>" + tecnicos.map(t => `<li>${t}</li>`).join("") + "</ul>");
      return respuestas.join("");
    }

    if (norm.includes("que puedo preguntar") || norm.includes("que puedes") || norm.includes("ayuda") || norm.includes("que sabes")) {
      return `Puedo responder preguntas sobre:<ul>
        <li><strong>Técnicos</strong>: "¿cuántos técnicos hay?", "¿quién es el técnico de...?"</li>
        <li><strong>Asistencias</strong>: "¿cuántas asistencias tiene Julio Chimbo?", "asistencias en mayo"</li>
        <li><strong>Rutas</strong>: "distancia promedio de traslado", "tiempo de ruta"</li>
        <li><strong>Zonas</strong>: "cuántos en zona rural", "cuántos en zona urbana"</li>
        <li><strong>Filtros</strong>: puedo aplicar filtros de técnico y fecha automáticamente</li>
        <li><strong>Resumen</strong>: "dame un resumen general"</li>
      </ul>`;
    }

    // Consulta de rutas / tiempo de traslado
    if (tipo === "rutas" || norm.includes("tiempo") || norm.includes("distancia") || norm.includes("km") || norm.includes("minutos")) {
      let rutas = featuresPorCapa["rutas"] || [];
      if (tecnico) {
        const idTec = buscarIdTecnico(tecnico);
        if (idTec) rutas = rutas.filter(f => String(f.properties.id_tec) === idTec);
      }
      if (!rutas.length) return "No hay datos de rutas para esta consulta.";
      const prom = (campo) => rutas.reduce((s, f) => s + (parseFloat(f.properties[campo]) || 0), 0) / rutas.length;
      const minProm = prom("tiempo_min");
      const kmProm = prom("dist_km");
      respuestas.push(tecnico ? `<strong>Rutas de ${tecnico}:</strong>` : "<strong>Rutas (promedio general):</strong>");
      respuestas.push(`<ul><li>Tiempo promedio: <strong>${minProm.toFixed(1)} min</strong></li>`);
      respuestas.push(`<li>Distancia promedio: <strong>${kmProm.toFixed(1)} km</strong></li>`);
      respuestas.push(`<li>Rutas registradas: <strong>${rutas.length}</strong></li></ul>`);
      return respuestas.join("");
    }

    // Resumen general
    if (tipo === "resumen" || norm.includes("resumen")) {
      const asist = featuresPorCapa["asistencias"] || [];
      let asistFiltradas = asist;
      if (tecnico) {
        const idTec = buscarIdTecnico(tecnico);
        if (idTec) asistFiltradas = asist.filter(f => String(f.properties.id_tec) === idTec);
      }
      if (fechas) {
        asistFiltradas = asistFiltradas.filter(f => {
          const fecha = parseFechaAsistencia(f.properties);
          if (!fecha) return false;
          if (fechas.desde && fecha < fechas.desde) return false;
          if (fechas.hasta && fecha > fechas.hasta) return false;
          return true;
        });
      }
      const domic = featuresPorCapa["domicilios"] || [];
      const rutas = featuresPorCapa["rutas"] || [];
      const TecUnicos = new Set(asistFiltradas.map(f => f.properties.tecnico_ma).filter(Boolean));

      let rural = 0, urbano = 0;
      asistFiltradas.forEach(f => {
        const clas = String(f.properties.clas || "").toLowerCase();
        if (clas.includes("rural")) rural++;
        if (clas.includes("urban")) urbano++;
      });

      respuestas.push(`<strong>Resumen${tecnico ? " de " + tecnico : ""}:</strong>`);
      respuestas.push("<ul>");
      respuestas.push(`<li>Asistencias: <strong>${asistFiltradas.length}</strong></li>`);
      respuestas.push(`<li>Técnicos con asistencias: <strong>${TecUnicos.size}</strong></li>`);
      respuestas.push(`<li>Zona rural: <strong>${rural}</strong> | Urbana: <strong>${urbano}</strong></li>`);
      respuestas.push(`<li>Domicilios registrados: <strong>${domic.length}</strong></li>`);
      respuestas.push(`<li>Rutas: <strong>${rutas.length}</strong></li>`);
      respuestas.push("</ul>");
      return respuestas.join("");
    }

    // Zonas rural/urbano
    if (norm.includes("rural") || norm.includes("urbano") || norm.includes("urbana")) {
      let asist = featuresPorCapa["asistencias"] || [];
      if (tecnico) {
        const idTec = buscarIdTecnico(tecnico);
        if (idTec) asist = asist.filter(f => String(f.properties.id_tec) === idTec);
      }
      if (fechas) {
        asist = asist.filter(f => {
          const fecha = parseFechaAsistencia(f.properties);
          if (!fecha) return false;
          if (fechas.desde && fecha < fechas.desde) return false;
          if (fechas.hasta && fecha > fechas.hasta) return false;
          return true;
        });
      }
      let rural = 0, urbano = 0;
      asist.forEach(f => {
        const clas = String(f.properties.clas || "").toLowerCase();
        if (clas.includes("rural")) rural++;
        if (clas.includes("urban")) urbano++;
      });
      respuestas.push(tecnico ? `<strong>${tecnico}:</strong>` : "<strong>Asistencias por zona:</strong>");
      respuestas.push(`<ul><li>Rural: <strong>${rural}</strong></li><li>Urbana: <strong>${urbano}</strong></li></ul>`);
      return respuestas.join("");
    }

    // Buffers
    if (tipo === "buffers" || norm.includes("500") || norm.includes("1000") || norm.includes("5000")) {
      let asist = featuresPorCapa["asistencias"] || [];
      if (tecnico) {
        const idTec = buscarIdTecnico(tecnico);
        if (idTec) asist = asist.filter(f => String(f.properties.id_tec) === idTec);
      }
      if (fechas) {
        asist = asist.filter(f => {
          const fecha = parseFechaAsistencia(f.properties);
          if (!fecha) return false;
          if (fechas.desde && fecha < fechas.desde) return false;
          if (fechas.hasta && fecha > fechas.hasta) return false;
          return true;
        });
      }
      let d500 = 0, d1000 = 0, d5000 = 0, fuera = 0;
      asist.forEach(f => {
        if (esVerdadero(f.properties.buffer_500)) d500++;
        if (esVerdadero(f.properties.buffer_100)) d1000++;
        if (esVerdadero(f.properties.buffer_501)) d5000++; else fuera++;
      });
      respuestas.push(tecnico ? `<strong>${tecnico} - Cobertura por buffers:</strong>` : "<strong>Cobertura por buffers:</strong>");
      respuestas.push("<ul>");
      respuestas.push(`<li>Dentro de 500 m: <strong>${d500}</strong></li>`);
      respuestas.push(`<li>Dentro de 1000 m: <strong>${d1000}</strong></li>`);
      respuestas.push(`<li>Dentro de 5000 m: <strong>${d5000}</strong></li>`);
      respuestas.push(`<li>Fuera de 5000 m: <strong>${fuera}</strong></li>`);
      respuestas.push("</ul>");
      return respuestas.join("");
    }

    // Asistencias (por defecto si menciona un técnico)
    let asist = featuresPorCapa["asistencias"] || [];
    if (tecnico) {
      const idTec = buscarIdTecnico(tecnico);
      if (idTec) asist = asist.filter(f => String(f.properties.id_tec) === idTec);
    }
    if (fechas) {
      asist = asist.filter(f => {
        const fecha = parseFechaAsistencia(f.properties);
        if (!fecha) return false;
        if (fechas.desde && fecha < fechas.desde) return false;
        if (fechas.hasta && fecha > fechas.hasta) return false;
        return true;
      });
    }

    if (asist.length === 0) return "No se encontraron asistencias para esta consulta.";

    respuestas.push(tecnico ? `<strong>Asistencias de ${tecnico}:</strong>` : "<strong>Asistencias encontradas:</strong>");
    respuestas.push(`<ul><li>Total: <strong>${asist.length}</strong></li>`);

    // Por cantón
    const porCanton = contarPorCampo(asist, "nombre_can");
    if (porCanton.length > 0 && porCanton.length <= 20) {
      respuestas.push("<li>Por cantón: " + porCanton.map(([k, v]) => `${k} (${v})`).join(", ") + "</li>");
    }

    // Por parroquia (top 5)
    const porParroquia = contarPorCampo(asist, "nombre_par").slice(0, 5);
    if (porParroquia.length > 0) {
      respuestas.push("<li>Principales parroquias: " + porParroquia.map(([k, v]) => `${k} (${v})`).join(", ") + "</li>");
    }

    // Por tipo de visita
    const porTipo = contarPorCampo(asist, "tipo_vis");
    if (porTipo.length > 0 && porTipo.length <= 10) {
      respuestas.push("<li>Por tipo: " + porTipo.map(([k, v]) => `${k} (${v})`).join(", ") + "</li>");
    }

    let rural = 0, urbano = 0;
    asist.forEach(f => {
      const clas = String(f.properties.clas || "").toLowerCase();
      if (clas.includes("rural")) rural++;
      if (clas.includes("urban")) urbano++;
    });
    respuestas.push(`<li>Rural: <strong>${rural}</strong> | Urbana: <strong>${urbano}</strong></li>`);
    respuestas.push("</ul>");
    return respuestas.join("");
  }

  function procesar() {
    const texto = chatInput.value.trim();
    if (!texto) return;
    chatInput.value = "";

    addMsg(texto, "chat-user");

    const norm = normalizar(texto);

    // 1. Detectar técnico
    const nombreEncontrado = buscarTecnico(texto);
    let tecnico = null;
    let idTec = null;
    if (nombreEncontrado) {
      tecnico = nombreEncontrado;
      idTec = buscarIdTecnico(nombreEncontrado);
    }

    // 2. Detectar fechas
    const fechas = detectarFechas(texto);

    // 3. Detectar tipo de consulta
    const tipo = detectarTipoConsulta(texto);

    // 4. Aplicar filtros al mapa si se detectaron
    if (idTec) {
      FILTROS.tecnico = idTec;
      document.getElementById("filtro-tecnico").value = idTec;
    } else if (norm.includes("todos") || norm.includes("limpiar") || norm.includes("quitar filtro")) {
      FILTROS.tecnico = "todos";
      FILTROS.desde = null;
      FILTROS.hasta = null;
      document.getElementById("filtro-tecnico").value = "todos";
      document.getElementById("filtro-desde").value = "";
      document.getElementById("filtro-hasta").value = "";
      redibujarTodas();
      actualizarTiempoTraslado();
      addMsg("Filtros limpiados. Se muestran todos los datos.", "chat-bot");
      return;
    }

    if (fechas) {
      FILTROS.desde = fechas.desde;
      FILTROS.hasta = fechas.hasta;
      const fmt = d => d.toISOString().slice(0, 10);
      document.getElementById("filtro-desde").value = fmt(fechas.desde);
      document.getElementById("filtro-hasta").value = fmt(fechas.hasta);
    }

    // Redibujar con filtros
    redibujarTodas();
    actualizarTiempoTraslado();

    // 5. Generar respuesta
    const respuesta = generarRespuesta(tipo, tecnico, fechas, texto);
    addMsg(respuesta, "chat-bot");
  }

  chatSend.addEventListener("click", procesar);
  chatInput.addEventListener("keydown", e => { if (e.key === "Enter") procesar(); });
})();