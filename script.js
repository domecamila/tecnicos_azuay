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

// =====================================================================
// ASISTENTE DE CONSULTAS — Motor de reglas en español (sin API externa)
// =====================================================================

const ChatAsistente = (() => {
  const chatToggle = document.getElementById("chat-toggle");
  const chatWindow = document.getElementById("chat-window");
  const chatClose = document.getElementById("chat-close");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  chatToggle.addEventListener("click", () => chatWindow.classList.toggle("open"));
  chatClose.addEventListener("click", () => chatWindow.classList.remove("open"));
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;
    agregarMensaje(texto, "user");
    chatInput.value = "";
    setTimeout(() => {
      const respuesta = procesar(texto);
      agregarMensaje(respuesta, "bot");
    }, 150);
  });

  function agregarMensaje(html, tipo) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-${tipo}`;
    div.innerHTML = html;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Normaliza texto: quita tildes, minúsculas, recorta
  function norm(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  // Verifica si el texto contiene alguna de las palabras clave
  function contiene(texto, ...palabras) {
    const t = norm(texto);
    return palabras.some(p => t.includes(norm(p)));
  }

  // Extrae un valor entre palabras clave (ej: "en Cuenca" → "Cuenca")
  function extraerValor(texto, ...claves) {
    const t = norm(texto);
    for (const clave of claves) {
      const idx = t.indexOf(norm(clave));
      if (idx === -1) continue;
      let resto = t.slice(idx + norm(clave).length).trim();
      // Quitar palabras comunes de cierre
      resto = resto.replace(/\s*(y|e|o|de|del|las?|los?|un|una|que|en|por|para|con|el|la)\s*$/i, "").trim();
      if (resto.length > 0) return resto;
    }
    return null;
  }

  // Lista de cantones de Azuay conocidos
  const CANTONES_AZUAY = [
    "cuenca", "paute", "gualaceo", "sevilla de oro", "camilo ponce enriquez",
    "el tambo", "daniel leonidas ordonez", "guaranda", "miguel ribast gauss",
    "lausaca", "lufa", "san fernando", "santa isabel", "sigsig", "onioc",
    "pacifico", "suscal", "bibián", "el pan", "chiscán"
  ];

  // Busca si el texto menciona algún cantón conocido
  function buscarCanton(texto) {
    const t = norm(texto);
    for (const c of CANTONES_AZUAY) {
      if (t.includes(norm(c))) return c;
    }
    return null;
  }

  // Busca si el texto menciona un nombre de técnico conocido
  function buscarTecnico(texto) {
    const t = norm(texto);
    const tecnicos = featuresPorCapa["poligonos_asistencias"] || featuresPorCapa["asistencias"] || [];
    const nombres = new Map();
    tecnicos.forEach(f => {
      const p = f.properties;
      if (p.tecnico_ma) nombres.set(norm(p.tecnico_ma), p.tecnico_ma);
      if (p.id_tec) nombres.set(norm(String(p.id_tec)), p.tecnico_ma || String(p.id_tec));
    });
    // Buscar coincidencia más larga primero
    let mejor = null;
    let mejorLen = 0;
    for (const [normN, real] of nombres) {
      if (t.includes(normN) && normN.length > mejorLen) {
        mejor = real;
        mejorLen = normN.length;
      }
    }
    return mejor;
  }

  // Busca si el texto menciona una cédula (número de 10 dígitos)
  function buscarCedula(texto) {
    const m = texto.match(/\b\d{10}\b/);
    return m ? m[0] : null;
  }

  // Lista de capas conocidas (id -> nombre amigable)
  const CAPAS_NOMBRES = {
    asistencias: "asistencias",
    domicilios: "domicilios",
    distrital: "dirección distrital",
    rutas: "rutas",
    poligonos_asistencias: "polígonos de asistencias",
    area_distribucion: "área de distribución",
    buffer500: "buffer 500 m",
    buffer1000: "buffer 1000 m",
    buffer5000: "buffer 5000 m",
  };

  function buscarCapa(texto) {
    const t = norm(texto);
    for (const [id, nombre] of Object.entries(CAPAS_NOMBRES)) {
      if (t.includes(norm(nombre)) || t.includes(norm(id))) return id;
    }
    return null;
  }

  // ==================== ACCIONES ====================

  function accionResumenGeneral() {
    const asist = featuresPorCapa["asistencias"] || [];
    const dom = featuresPorCapa["domicilios"] || [];
    const poli = featuresPorCapa["poligonos_asistencias"] || [];
    const areas = featuresPorCapa["area_distribucion"] || [];
    const rutas = featuresPorCapa["rutas"] || [];

    let rural = 0, urbano = 0;
    asist.forEach(f => {
      const c = String(f.properties.clas || "").toLowerCase();
      if (c.includes("rural")) rural++;
      if (c.includes("urban")) urbano++;
    });

    const tecnicos = new Set();
    [...poli, ...areas].forEach(f => {
      if (f.properties.id_tec) tecnicos.add(String(f.properties.id_tec));
    });

    const cantones = new Set();
    asist.forEach(f => {
      if (f.properties.nombre_can) cantones.add(f.properties.nombre_can);
    });

    return `<b>Resumen general del geoportal:</b><br><br>` +
      `• <b>${asist.length}</b> asistencias técnicas registradas<br>` +
      `• <b>${dom.length}</b> domicilios de técnicos<br>` +
      `• <b>${tecnicos.size}</b> técnicos en territorial<br>` +
      `• <b>${cantones.size}</b> cantones con asistencias<br>` +
      `• <b>${areas.length}</b> polígonos de área de distribución<br>` +
      `• <b>${rutas.length}</b> rutas de movilización<br><br>` +
      `Asistencias por zona: rural <b>${rural}</b> · urbana <b>${urbano}</b>`;
  }

  function accionContarAsistencias(canton, tecnico) {
    let features = featuresPorCapa["asistencias"] || [];
    let total = features.length;
    let filtros = [];

    if (canton) {
      features = features.filter(f => norm(f.properties.nombre_can).includes(norm(canton)));
      filtros.push(`cantón "${canton}"`);
    }
    if (tecnico) {
      features = features.filter(f => norm(f.properties.tecnico_ma).includes(norm(tecnico)));
      filtros.push(`técnico "${tecnico}"`);
    }

    const texto = filtros.length ? ` en ${filtros.join(" y ")}` : "";
    return `Hay <b>${features.length}</b> asistencias${texto} de un total de ${total}.`;
  }

  function accionBuscarDomicilio(nombre) {
    const dom = featuresPorCapa["domicilios"] || [];
    const resultados = dom.filter(f => {
      const p = f.properties;
      return norm(p.a2_nombres).includes(norm(nombre)) ||
             norm(String(p.a1__númer)).includes(norm(nombre));
    });

    if (!resultados.length) return `No encontré domicilios para "<b>${nombre}</b>".`;

    let resp = `Encontré <b>${resultados.length}</b> resultado(s):<br><br>`;
    resultados.slice(0, 5).forEach(f => {
      const p = f.properties;
      resp += `• <b>${p.a2_nombres || "?"}</b> — Cédula: ${p.a1__númer || "?"}<br>`;
      resp += `  ${p.b2__cantó || "?"}, ${p.b3__parroq || "?"}<br>`;
      resp += `  ${p.b4__calle_ || ""} ${p.b5__númer || ""} y ${p.b6__calle_ || ""}<br><br>`;
    });
    if (resultados.length > 5) resp += `<i>...y ${resultados.length - 5} resultado(s) más.</i>`;
    return resp;
  }

  function accionBuscarAsistencias(nombre) {
    const asist = featuresPorCapa["asistencias"] || [];
    const resultados = asist.filter(f => {
      const p = f.properties;
      return norm(p.tecnico_ma).includes(norm(nombre)) ||
             norm(p.cedula_pro).includes(norm(nombre));
    });

    if (!resultados.length) return `No encontré asistencias para "<b>${nombre}</b>".`;

    let resp = `Encontré <b>${resultados.length}</b> asistencia(s) para "<b>${nombre}</b>":<br><br>`;

    // Agrupar por cantón
    const porCanton = {};
    resultados.forEach(f => {
      const c = f.properties.nombre_can || "Sin cantón";
      porCanton[c] = (porCanton[c] || 0) + 1;
    });
    Object.entries(porCanton).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
      resp += `• ${c}: <b>${n}</b><br>`;
    });

    return resp;
  }

  function accionEstadisticas() {
    const asist = featuresPorCapa["asistencias"] || [];
    let rural = 0, urbano = 0, d500 = 0, d1000 = 0, d5000 = 0, fuera5000 = 0;

    asist.forEach(f => {
      const p = f.properties;
      const c = String(p.clas || "").toLowerCase();
      if (c.includes("rural")) rural++;
      if (c.includes("urban")) urbano++;
      if (esVerdadero(p.buffer_500)) d500++;
      if (esVerdadero(p.buffer_100)) d1000++;
      if (esVerdadero(p.buffer_501)) d5000++; else fuera5000++;
    });

    const rutas = featuresPorCapa["rutas"] || [];
    let promTiempo = 0, promDist = 0;
    if (rutas.length) {
      promTiempo = rutas.reduce((s, f) => s + (parseFloat(f.properties.tiempo_min) || 0), 0) / rutas.length;
      promDist = rutas.reduce((s, f) => s + (parseFloat(f.properties.dist_km) || 0), 0) / rutas.length;
    }

    return `<b>Estadísticas de asistencias técnicas:</b><br><br>` +
      `Total: <b>${asist.length}</b><br>` +
      `Rural: <b>${rural}</b> (${(rural / asist.length * 100).toFixed(1)}%)<br>` +
      `Urbana: <b>${urbano}</b> (${(urbano / asist.length * 100).toFixed(1)}%)<br><br>` +
      `<b>Por distancia al domicilio:</b><br>` +
      `• ≤ 500 m: <b>${d500}</b><br>` +
      `• ≤ 1000 m: <b>${d1000}</b><br>` +
      `• ≤ 5000 m: <b>${d5000}</b><br>` +
      `• > 5000 m: <b>${fuera5000}</b><br><br>` +
      `<b>Traslado promedio:</b> ${promTiempo.toFixed(0)} min / ${promDist.toFixed(1)} km`;
  }

  function accionEstadisticasCanton(canton) {
    const asist = featuresPorCapa["asistencias"] || [];
    const filtradas = asist.filter(f => norm(f.properties.nombre_can).includes(norm(canton)));

    if (!filtradas.length) return `No hay asistencias en el cantón "<b>${canton}</b>".`;

    let rural = 0, urbano = 0;
    const tecnicos = new Set();
    const parroquias = new Set();
    filtradas.forEach(f => {
      const p = f.properties;
      const c = String(p.clas || "").toLowerCase();
      if (c.includes("rural")) rural++;
      if (c.includes("urban")) urbano++;
      if (p.tecnico_ma) tecnicos.add(p.tecnico_ma);
      if (p.nombre_par) parroquias.add(p.nombre_par);
    });

    return `<b>Estadísticas para ${canton}:</b><br><br>` +
      `• Asistencias: <b>${filtradas.length}</b><br>` +
      `• Rural: <b>${rural}</b> · Urbana: <b>${urbano}</b><br>` +
      `• Técnicos con asistencias: <b>${tecnicos.size}</b><br>` +
      `• Parroquias: <b>${parroquias.size}</b> (${[...parroquias].join(", ")})`;
  }

  function accionListarTecnicos() {
    const poli = featuresPorCapa["poligonos_asistencias"] || [];
    const mapa = new Map();
    poli.forEach(f => {
      const p = f.properties;
      if (p.tecnico_ma && !mapa.has(p.tecnico_ma)) {
        mapa.set(p.tecnico_ma, p.cedula_tec || "");
      }
    });
    const lista = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));

    if (!lista.length) return "No hay técnicos registrados.";

    let resp = `<b>Técnicos en territorial (${lista.length}):</b><br><br>`;
    lista.forEach(([nombre, cedula], i) => {
      resp += `${i + 1}. ${nombre} — CC: ${cedula || "?"}<br>`;
    });
    return resp;
  }

  function accionMostrarCapa(capaId) {
    const checkbox = document.querySelector(`input[data-layer="${capaId}"]`);
    if (!checkbox) return `No encontré la capa "${capaId}".`;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    return `Capa "<b>${CAPAS_NOMBRES[capaId] || capaId}</b>" activada en el mapa.`;
  }

  function accionOcultarCapa(capaId) {
    const checkbox = document.querySelector(`input[data-layer="${capaId}"]`);
    if (!checkbox) return `No encontré la capa "${capaId}".`;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    return `Capa "<b>${CAPAS_NOMBRES[capaId] || capaId}</b>" ocultada.`;
  }

  function accionMostrarTodas() {
    document.querySelectorAll(".layer-item input").forEach(input => {
      input.checked = true;
      input.dispatchEvent(new Event("change"));
    });
    return "Todas las capas activadas.";
  }

  function accionOcultarTodas() {
    document.querySelectorAll(".layer-item input").forEach(input => {
      input.checked = false;
      input.dispatchEvent(new Event("change"));
    });
    return "Todas las capas ocultadas.";
  }

  function accionIrA(canton) {
    // Buscar features que mencionen el cantón para centrar el mapa
    const todas = [
      ...(featuresPorCapa["asistencias"] || []),
      ...(featuresPorCapa["domicilios"] || []),
      ...(featuresPorCapa["area_distribucion"] || []),
    ];

    const matches = todas.filter(f => {
      const p = f.properties;
      return norm(p.nombre_can || p.b2__cantó || "").includes(norm(canton));
    });

    if (matches.length) {
      // Calcular bounds
      const coords = [];
      matches.forEach(f => {
        if (f.geometry.type === "Point") {
          coords.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
        } else if (f.geometry.type === "Polygon") {
          f.geometry.coordinates[0].forEach(c => coords.push([c[1], c[0]]));
        } else if (f.geometry.type === "MultiPolygon") {
          f.geometry.coordinates.forEach(poly => poly[0].forEach(c => coords.push([c[1], c[0]])));
        }
      });
      if (coords.length) {
        mapa.fitBounds(L.latLngBounds(coords).pad(0.2));
      }
    }
    return `Moviendo el mapa a "<b>${canton}</b>"...`;
  }

  function accionListarCantones() {
    const asist = featuresPorCapa["asistencias"] || [];
    const porCanton = {};
    asist.forEach(f => {
      const c = f.properties.nombre_can || "Desconocido";
      porCanton[c] = (porCanton[c] || 0) + 1;
    });
    const lista = Object.entries(porCanton).sort((a, b) => b[1] - a[1]);

    let resp = `<b>Cantones con asistencias (${lista.length}):</b><br><br>`;
    lista.forEach(([c, n]) => {
      resp += `• ${c}: <b>${n}</b> asistencias<br>`;
    });
    return resp;
  }

  function accionRubros() {
    const asist = featuresPorCapa["asistencias"] || [];
    const porRubro = {};
    asist.forEach(f => {
      const r = f.properties.rubro_ava || "Sin especificar";
      porRubro[r] = (porRubro[r] || 0) + 1;
    });
    const lista = Object.entries(porRubro).sort((a, b) => b[1] - a[1]);

    let resp = `<b>Asistencias por rubro:</b><br><br>`;
    lista.forEach(([r, n]) => {
      resp += `• ${r}: <b>${n}</b><br>`;
    });
    return resp;
  }

  function accionTiposVisita() {
    const asist = featuresPorCapa["asistencias"] || [];
    const porTipo = {};
    asist.forEach(f => {
      const t = f.properties.tipo_vis || "Sin especificar";
      porTipo[t] = (porTipo[t] || 0) + 1;
    });
    const lista = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);

    let resp = `<b>Asistencias por tipo de visita:</b><br><br>`;
    lista.forEach(([t, n]) => {
      resp += `• ${t}: <b>${n}</b><br>`;
    });
    return resp;
  }

  function accionRankingTraslado() {
    const rutas = featuresPorCapa["rutas"] || [];
    if (!rutas.length) return "No hay datos de rutas de traslado.";

    const mapaTec = new Map();
    rutas.forEach(f => {
      const p = f.properties;
      const id = String(p.id_tec || "");
      if (!id) return;
      const tiempo = parseFloat(p.tiempo_min) || 0;
      const dist = parseFloat(p.dist_km) || 0;
      mapaTec.set(id, { tiempo, dist, nombre: p.tecnico_ma || id });
    });

    const lista = [...mapaTec.values()].sort((a, b) => b.tiempo - a.tiempo);
    const top = lista.slice(0, 5);

    let resp = `<b>Ranking de traslado — mayor a menor tiempo:</b><br><br>`;
    top.forEach((t, i) => {
      resp += `${i + 1}. <b>${t.nombre}</b> — ${t.tiempo.toFixed(0)} min / ${t.dist.toFixed(1)} km<br>`;
    });
    resp += `<br><i>Promedio general: ${(lista.reduce((s, x) => s + x.tiempo, 0) / lista.length).toFixed(0)} min / ${(lista.reduce((s, x) => s + x.dist, 0) / lista.length).toFixed(1)} km</i>`;
    return resp;
  }

  function accionRankingAsistencias() {
    const asist = featuresPorCapa["asistencias"] || [];
    if (!asist.length) return "No hay datos de asistencias.";

    const porTec = {};
    asist.forEach(f => {
      const nombre = f.properties.tecnico_ma || "Desconocido";
      porTec[nombre] = (porTec[nombre] || 0) + 1;
    });

    const lista = Object.entries(porTec).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let resp = `<b>Ranking de asistencias — mayor a menor cantidad:</b><br><br>`;
    lista.forEach(([nombre, n], i) => {
      resp += `${i + 1}. <b>${nombre}</b>: ${n} asistencias<br>`;
    });
    return resp;
  }

  function accionRankingCantones() {
    const asist = featuresPorCapa["asistencias"] || [];
    if (!asist.length) return "No hay datos de asistencias.";

    const porCanton = {};
    asist.forEach(f => {
      const c = f.properties.nombre_can || "Desconocido";
      porCanton[c] = (porCanton[c] || 0) + 1;
    });

    const lista = Object.entries(porCanton).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let resp = `<b>Ranking de cantones — mayor a menor asistencias:</b><br><br>`;
    lista.forEach(([c, n], i) => {
      resp += `${i + 1}. <b>${c}</b>: ${n} asistencias<br>`;
    });
    return resp;
  }

  function accionTecnicoMasDemora() {
    const rutas = featuresPorCapa["rutas"] || [];
    if (!rutas.length) return "No hay datos de rutas de traslado.";

    let max = null;
    rutas.forEach(f => {
      const p = f.properties;
      const tiempo = parseFloat(p.tiempo_min) || 0;
      if (!max || tiempo > max.tiempo) {
        max = { nombre: p.tecnico_ma || p.id_tec || "?", tiempo, dist: parseFloat(p.dist_km) || 0 };
      }
    });

    return `El técnico que más tiempo se demora en trasladarse es <b>${max.nombre}</b> con <b>${max.tiempo.toFixed(0)} minutos</b> (${max.dist.toFixed(1)} km).`;
  }

  function accionTecnicoMenosDemora() {
    const rutas = featuresPorCapa["rutas"] || [];
    if (!rutas.length) return "No hay datos de rutas de traslado.";

    let min = null;
    rutas.forEach(f => {
      const p = f.properties;
      const tiempo = parseFloat(p.tiempo_min) || 0;
      if (!min || (tiempo > 0 && tiempo < min.tiempo)) {
        min = { nombre: p.tecnico_ma || p.id_tec || "?", tiempo, dist: parseFloat(p.dist_km) || 0 };
      }
    });

    return `El técnico que menos tiempo se demora en trasladarse es <b>${min.nombre}</b> con <b>${min.tiempo.toFixed(0)} minutos</b> (${min.dist.toFixed(1)} km).`;
  }

  function accionPromedioTraslado() {
    const rutas = featuresPorCapa["rutas"] || [];
    if (!rutas.length) return "No hay datos de rutas de traslado.";

    const total = rutas.length;
    const promTiempo = rutas.reduce((s, f) => s + (parseFloat(f.properties.tiempo_min) || 0), 0) / total;
    const promDist = rutas.reduce((s, f) => s + (parseFloat(f.properties.dist_km) || 0), 0) / total;
    const maxT = Math.max(...rutas.map(f => parseFloat(f.properties.tiempo_min) || 0));
    const minT = Math.min(...rutas.filter(f => parseFloat(f.properties.tiempo_min) > 0).map(f => parseFloat(f.properties.tiempo_min) || Infinity));

    return `<b>Promedios de traslado (${total} técnicos):</b><br><br>` +
      `• Promedio: <b>${promTiempo.toFixed(0)} min</b> / ${promDist.toFixed(1)} km<br>` +
      `• Máximo: <b>${maxT.toFixed(0)} min</b><br>` +
      `• Mínimo: <b>${minT.toFixed(0)} min</b>`;
  }

  function accionAyuda() {
    return `<b>¿Cómo puedo ayudarte?</b><br><br>` +
      `<b>Consultas de datos:</b><br>` +
      `• ¿Cuántas asistencias hay en [cantón]?<br>` +
      `• ¿Cuántos técnicos hay?<br>` +
      `• ¿Dónde vive [nombre]?<br>` +
      `• ¿Cuántas asistencias tiene [técnico]?<br>` +
      `• Busca cédula [número]<br><br>` +
      `<b>Estadísticas y rankings:</b><br>` +
      `• Resumen general<br>` +
      `• Estadísticas de [cantón]<br>` +
      `• ¿Qué rubros hay?<br>` +
      `• Tipos de visita<br>` +
      `• Lista de cantones<br>` +
      `• Lista de técnicos<br>` +
      `• Ranking de asistencias<br>` +
      `• Ranking de traslados<br><br>` +
      `<b>Traslados:</b><br>` +
      `• ¿Quién tarda más en trasladarse?<br>` +
      `• ¿Quién tarda menos en trasladarse?<br>` +
      `• Promedio de traslado<br><br>` +
      `<b>Navegación del mapa:</b><br>` +
      `• Muestra la capa de [nombre]<br>` +
      `• Oculta la capa de [nombre]<br>` +
      `• Muestra todas / Oculta todas<br>` +
      `• Ve a [cantón]`;
  }

  // ==================== PROCESADOR PRINCIPAL ====================

  function procesar(texto) {
    const t = norm(texto);

    // Ayuda
    if (contiene(t, "ayuda", "help", "qué puedes", "que puedes", "comandos", "opciones")) {
      return accionAyuda();
    }

    // Resumen general
    if (contiene(t, "resumen general", "resumir todo", "resumen de todo", "todo el geoportal")) {
      return accionResumenGeneral();
    }

    // Estadísticas generales
    if (contiene(t, "estadísticas", "estadisticas", "porcentaje", "proporción")) {
      const canton = buscarCanton(t);
      if (canton) return accionEstadisticasCanton(canton);
      return accionEstadisticas();
    }

    // Rubros
    if (contiene(t, "rubro", "rubros", "ava")) {
      return accionRubros();
    }

    // Tipos de visita
    if (contiene(t, "tipo de visita", "tipos de visita", "visitas por tipo")) {
      return accionTiposVisita();
    }

    // Lista de cantones
    if (contiene(t, "lista de cantones", "cuáles cantones", "cuales cantones", "qué cantones")) {
      return accionListarCantones();
    }

    // Lista de técnicos
    if (contiene(t, "lista de técnicos", "lista de tecnicos", "cuáles técnicos", "cuales tecnicos", "qué técnicos")) {
      return accionListarTecnicos();
    }

    // Traslados — quién tarda más / menos
    if (contiene(t, "tarda más", "tarda mas", "más tiempo", "mas tiempo", "más demora", "mas demora", "quién tarda más", "quien tarda mas", "más lento", "mas lento", "cuál técnico se demora más", "cual tecnico se demora mas")) {
      return accionTecnicoMasDemora();
    }
    if (contiene(t, "tarda menos", "menos tiempo", "menos demora", "quién tarda menos", "quien tarda menos", "más rápido", "mas rapido", "cuál técnico se demora menos", "cual tecnico se demora menos")) {
      return accionTecnicoMenosDemora();
    }
    if (contiene(t, "promedio de traslado", "promedio traslado", "tiempo promedio", "promedio de tiempo")) {
      return accionPromedioTraslado();
    }

    // Ranking de asistencias
    if (contiene(t, "ranking de asistencias", "ranking asistencias", "quién tiene más asistencias", "quien tiene mas asistencias", "más asistencias")) {
      return accionRankingAsistencias();
    }

    // Ranking de traslados
    if (contiene(t, "ranking de traslados", "ranking traslados", "ranking de traslado")) {
      return accionRankingTraslado();
    }

    // Ranking de cantones
    if (contiene(t, "ranking de cantones", "ranking cantones", "cuáles cantones tienen más", "cuales cantones tienen mas")) {
      return accionRankingCantones();
    }

    // Contar asistencias
    if (contiene(t, "cuántas asistencias", "cuantas asistencias", "cuánto", "cuanto", "total de asistencias", "número de asistencias")) {
      const canton = buscarCanton(t);
      const tecnico = buscarTecnico(t);
      return accionContarAsistencias(canton, tecnico);
    }

    // Buscar por cédula
    if (contiene(t, "cédula", "cedula")) {
      const cedula = buscarCedula(t);
      if (cedula) {
        return accionBuscarDomicilio(cedula);
      }
    }

    // Buscar domicilio de técnico
    if (contiene(t, "dónde vive", "donde vive", "domicilio de", "dirección de", "direccion de")) {
      const nombre = extraerValor(t, "dónde vive", "donde vive", "domicilio de", "dirección de", "direccion de");
      if (nombre) return accionBuscarDomicilio(nombre);
    }

    // Buscar asistencias de técnico
    if (contiene(t, "asistencias de", "asistencias del", "asistencias tiene")) {
      const nombre = extraerValor(t, "asistencias de", "asistencias del", "asistencias tiene");
      if (nombre) return accionBuscarAsistencias(nombre);
    }

    // Mostrar/ocultar capa
    if (contiene(t, "mostrar capa", "activar capa", "muestra la capa", "activa la capa", "encender")) {
      const capa = buscarCapa(t);
      if (capa) return accionMostrarCapa(capa);
      if (contiene(t, "todas las capas", "todas")) return accionMostrarTodas();
    }
    if (contiene(t, "ocultar capa", "apagar capa", "oculta la capa", "desactiva la capa")) {
      const capa = buscarCapa(t);
      if (capa) return accionOcultarCapa(capa);
      if (contiene(t, "todas las capas", "todas")) return accionOcultarTodas();
    }

    // Ir a cantón
    if (contiene(t, "ve a", "ir a", "centra en", "centrar en", "muéstrame", "muestrame")) {
      const canton = buscarCanton(t);
      if (canton) return accionIrA(canton);
    }

    // Buscar técnico por nombre directo (si no matcheó antes)
    const tec = buscarTecnico(t);
    if (tec && t.length > 3) {
      return accionBuscarAsistencias(tec);
    }

    // Si nada matcheó
    return `No entendí tu consulta. Escribe <b>"ayuda"</b> para ver las opciones disponibles.`;
  }

  return { procesar };
})();
