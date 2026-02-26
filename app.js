/****************************************************
 *  MENÚS CGS – PILOTO (Be medit. I)
 *  API real (GET): https://apps.es.sodexo.com/smart/es/3.0/api/flatelementslist/111
 *  Filtrado en cliente por Restaurant + ModuleId + Day
 ****************************************************/

/* ========= 1) CONFIG BÁSICA ========= */

// TU API REAL (listado plano por siteId=111)
const API_URL = 'https://apps.es.sodexo.com/smart/es/3.0/api/flatelementslist/111';

// Comedor del piloto: "Be medit. I" → Restaurant code
// (de tu Excel de mapeo de comedores)
const COMEDORES = {
  // slug → Restaurant
  "be-medit-i": "ES.BOA.CO.G1.FN034" // Be medit. I
};

// Módulos (slug → ModuleId) — de tu tabla maestra
const MODULES = {
  "be-dessert": 23,            // be Dessert
  "fruta": 125,                // Fruta
  "postres": 17,               // Postres (si luego quieres añadirlo a Dessert)
  "be-fresh": 57,              // Be Fresh
  "salsas": 30,                // Salsas y Aliños (be Salsa)
  "be-grill": 80,              // Be Grill
  "guarnicion": 14,            // Guarnición
  "be-soup": 79,               // Be Soup
  "smoothies": 42,             // Smoothies / Zumos
  "be-tradicional-1": 31,      // be Tradicional 1º
  "be-tradicional-2": 32,      // be Tradicional 2º
  "be-tradicional-g": 33,      // be Tradicional Guarn.
  "be-vital-1": 81,            // Be Vital 1º
  "be-vital-2": 82             // Be Vital 2º
};

// Pantallas del comedor → lista de módulos (en orden)
const PANTALLAS = {
  "be-dessert": ["be-dessert", "fruta"],                       // (23, 125)
  "be-fresh": ["be-fresh", "salsas"],                          // (57, 30)
  "be-grill": ["be-grill", "guarnicion", "salsas"],            // (80, 14, 30)
  "be-soup": ["be-soup", "smoothies"],                         // (79, 42)
  "be-traditional": ["be-tradicional-1", "be-tradicional-2", "be-tradicional-g"], // (31,32,33)
  "be-traditional-takeaway": ["be-tradicional-1", "be-tradicional-2"],            // (31,32)
  "be-vital": ["be-vital-1", "be-vital-2"]                     // (81,82)
};

// Títulos bonitos por pantalla
const TITULOS = {
  "be-dessert": "BE DESSERT",
  "be-fresh": "BE FRESH",
  "be-grill": "BE GRILL",
  "be-soup": "BE SOUP",
  "be-traditional": "BE TRADITIONAL",
  "be-traditional-takeaway": "BE TRADITIONAL / TAKEAWAY",
  "be-vital": "BE VITAL"
};

/* ========= 2) ROUTER ========= */

const { comedorSlug, pantallaSlug, fecha } = parseRoute();

document.getElementById('hdrTitle').textContent = TITULOS[pantallaSlug] || 'MENÚ';
document.getElementById('hdrSub').textContent = `${comedorSlug} • ${fecha}`;

// Traducciones de slugs → códigos reales
const restaurantCode = COMEDORES[comedorSlug];
const modules = (PANTALLAS[pantallaSlug] || []).map(s => MODULES[s]);

if (!restaurantCode || modules.length === 0) {
  fail('Ruta no válida o pantalla sin módulos configurados.');
  throw new Error('Ruta inválida');
}

/* ========= 3) CARGA + RENDER ========= */

boot();

async function boot() {
  try {
    // 3.1) Trae el “flat list” del API real (una sola llamada)
    const allItems = await fetchFlatList();

    // 3.2) Filtra por comedor + módulos + fecha
    const filtered = filterBy(allItems, {
      restaurant: restaurantCode,
      modules,
      day: fecha
    });

    // 3.3) Normaliza al modelo de interfaz
    const data = normalize(filtered);

    // 3.4) Render
    renderMenu(data);

  } catch (err) {
    fail('No se pudo cargar el menú. Revisa la consola.');
    console.error(err);
  }

  // Auto-refresh cada 5 minutos (pantallas de comedor)
  setTimeout(boot, 5 * 60 * 1000);
}

/* ========= 3.a) API CALL (GET al listado plano) ========= */

async function fetchFlatList() {
  const res = await fetch(API_URL, { method: 'GET' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API HTTP ${res.status}: ${txt}`);
  }

  // Se espera un array JSON de platos (tu muestra refleja esos campos).
  // Si fuera un objeto con envoltura, ajusta aquí.
  const json = await res.json();
  if (!Array.isArray(json)) {
    console.warn('Respuesta no es Array. Recibido:', json);
  }
  return json;
}

/* ========= 3.b) FILTRO LOCAL ========= */

function filterBy(list, { restaurant, modules, day }) {
  if (!Array.isArray(list)) return [];

  // Compara fecha por parte 'YYYY-MM-DD'
  const dayKey = (typeof day === 'string' ? day : new Date(day).toISOString().slice(0,10));

  return list.filter(x => {
    try {
      // Restaurant exacto (de tu Excel)
      const okRestaurant = String(x.Restaurant || '').trim() === restaurant;

      // ModuleId dentro de la lista de la pantalla
      const okModule = modules.includes(Number(x.ModuleId));

      // Fecha (Day puede venir con hora: 'YYYY-MM-DDTHH:mm:ss')
      const apiDay = (x.Day || '').toString().slice(0,10);
      const okDay = apiDay === dayKey;

      return okRestaurant && okModule && okDay;
    } catch {
      return false;
    }
  }).sort((a, b) => Number(a.Order || 0) - Number(b.Order || 0)); // orden sugerido
}

/* ========= 3.c) NORMALIZACIÓN (según TU API real) =========
   Convierte platos en { categoria, titulo, descripcion, tags[] }
   Campos reales confirmados en tu dump:
   - Component (Primero/Segundo/Guarnición/…)
   - Name
   - IngredientsText
   - AllergensText (coma-separado)
*/
function normalize(list) {
  if (!Array.isArray(list)) return { items: [] };

  const items = list.map(plato => ({
    categoria: plato.Component || 'General',
    titulo: plato.Name || '—',
    descripcion: plato.IngredientsText || '',
    tags: (plato.AllergensText ? String(plato.AllergensText).split(',').map(s => s.trim()).filter(Boolean) : [])
  }));

  return { items };
}

/* ========= 4) RENDER ========= */

function renderMenu(data) {
  const root = document.getElementById('menu');
  root.innerHTML = '';

  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    root.innerHTML = `<div class="alert">No hay datos para esta pantalla.</div>`;
    return;
  }

  // Agrupamos por categoría (Component) para maquetar "cajas/columnas"
  const porCat = groupBy(data.items, x => x.categoria || 'General');

  // Contenedor tipo grid de 3 columnas (ajusta en CSS si quieres)
