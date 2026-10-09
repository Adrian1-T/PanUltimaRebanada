// ============================================
// AMONG BREADS - Servidor Multijugador
// Node.js + Express + Socket.IO
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS totalmente abierto para permitir conexiones desde cualquier origen / celular
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 20000,
  pingInterval: 10000,
  transports: ['websocket', 'polling']
});

// ============================================
// ESTADO GLOBAL DE SALAS
// ============================================
const rooms = new Map(); // code -> Room
const socketToRoom = new Map(); // socketId -> code

const BREAD_SKINS = [
  'bolillo', 'baguette', 'donut', 'concha', 'mohoso', 'quemado',
  'croissant', 'pandemuerto', 'concha_rosa', 'tostada', 'bagel', 'muffin', 'donut_chocolate'
];
const HATS = [
  'none', 'chef', 'butter', 'candle', 'beret', 'crown', 'mini_bread', 'rolling_pin', 'flower', 'party'
];
const FACES = [
  'none', 'sunglasses', 'mustache', 'monocle', 'blush', 'pirate', 'glasses', 'mask', 'bubblegum'
];

// ============================================
// MAPAS ARQUITECTÓNICOS DIVERSOS (HABITACIONES, PASILLOS Y PAREDES)
// ============================================
const MAPS = {
  'El Horno Central': {
    width: 3200,
    height: 2400,
    emergency: { x: 1600, y: 1200 },
    spawns: [
      { x: 1600, y: 1100 }, { x: 1680, y: 1140 }, { x: 1700, y: 1220 },
      { x: 1650, y: 1280 }, { x: 1550, y: 1280 }, { x: 1500, y: 1220 },
      { x: 1520, y: 1140 }, { x: 1600, y: 1260 }, { x: 1720, y: 1180 },
      { x: 1480, y: 1180 }, { x: 1600, y: 1150 }, { x: 1650, y: 1200 }
    ],
    rooms: [
      { id: 'cafeteria', name: 'Cafetería & Salón Principal', x: 1250, y: 950, w: 700, h: 500, floor: 'wood', label: 'CAFETERÍA' },
      { id: 'gran_horno', name: 'El Gran Salón de Hornos', x: 1250, y: 50, w: 700, h: 650, floor: 'stone', label: 'GRAN HORNO' },
      { id: 'cocina', name: 'Cocina & Amasadero Maestro', x: 50, y: 50, w: 900, h: 650, floor: 'tile', label: 'COCINA & AMASADO' },
      { id: 'fermentacion', name: 'Cámara de Fermentación Fría', x: 50, y: 950, w: 900, h: 500, floor: 'tile_dark', label: 'FERMENTACIÓN' },
      { id: 'despensa', name: 'Gran Despensa & Silos de Harina', x: 50, y: 1700, w: 900, h: 650, floor: 'rustic', label: 'DESPENSA & SILOS' },
      { id: 'enfriamiento', name: 'Cuarto de Enfriamiento & Ventiladores', x: 1250, y: 1700, w: 700, h: 650, floor: 'metal', label: 'ENFRIAMIENTO' },
      { id: 'reposteria', name: 'Taller de Repostería & Glaseados', x: 2250, y: 50, w: 900, h: 650, floor: 'tile_pink', label: 'REPOSTERÍA' },
      { id: 'ventas', name: 'Mostrador & Salón de Ventas', x: 2250, y: 950, w: 900, h: 500, floor: 'wood_dark', label: 'VENTAS & MOSTRADOR' },
      { id: 'empaque', name: 'Despacho & Empaque Artesanal', x: 2250, y: 1700, w: 900, h: 650, floor: 'wood', label: 'DESPACHO' }
    ],
    walls: [
      // Perímetro exterior
      { x: 0, y: 0, w: 3200, h: 30 },
      { x: 0, y: 2370, w: 3200, h: 30 },
      { x: 0, y: 0, w: 30, h: 2400 },
      { x: 3170, y: 0, w: 30, h: 2400 },

      // Cocina (NW)
      { x: 50, y: 700, w: 900, h: 25 },
      { x: 950, y: 50, w: 25, h: 250 },
      { x: 950, y: 450, w: 25, h: 250 }, // puerta y: 300-450

      // Fermentación (W)
      { x: 50, y: 950, w: 900, h: 25 },
      { x: 50, y: 1450, w: 900, h: 25 },
      { x: 950, y: 950, w: 25, h: 170 },
      { x: 950, y: 1280, w: 25, h: 170 }, // puerta y: 1120-1280

      // Despensa (SW)
      { x: 50, y: 1700, w: 900, h: 25 },
      { x: 950, y: 1700, w: 25, h: 240 },
      { x: 950, y: 2100, w: 25, h: 250 }, // puerta y: 1940-2100

      // Gran Horno (N)
      { x: 1250, y: 50, w: 25, h: 650 },
      { x: 1950, y: 50, w: 25, h: 650 },
      { x: 1250, y: 700, w: 260, h: 25 },
      { x: 1690, y: 700, w: 260, h: 25 }, // puerta x: 1510-1690

      // Cafetería Central
      { x: 1250, y: 950, w: 260, h: 25 },
      { x: 1690, y: 950, w: 260, h: 25 }, // puerta Norte x: 1510-1690
      { x: 1250, y: 1450, w: 260, h: 25 },
      { x: 1690, y: 1450, w: 260, h: 25 }, // puerta Sur x: 1510-1690
      { x: 1250, y: 950, w: 25, h: 170 },
      { x: 1250, y: 1280, w: 25, h: 170 }, // puerta Oeste y: 1120-1280
      { x: 1950, y: 950, w: 25, h: 170 },
      { x: 1950, y: 1280, w: 25, h: 170 }, // puerta Este y: 1120-1280

      // Enfriamiento (S)
      { x: 1250, y: 1700, w: 25, h: 650 },
      { x: 1950, y: 1700, w: 25, h: 650 },
      { x: 1250, y: 1700, w: 260, h: 25 },
      { x: 1690, y: 1700, w: 260, h: 25 }, // puerta x: 1510-1690

      // Repostería (NE)
      { x: 2250, y: 700, w: 900, h: 25 },
      { x: 2250, y: 50, w: 25, h: 250 },
      { x: 2250, y: 450, w: 25, h: 250 }, // puerta y: 300-450

      // Ventas (E)
      { x: 2250, y: 950, w: 900, h: 25 },
      { x: 2250, y: 1450, w: 900, h: 25 },
      { x: 2250, y: 950, w: 25, h: 170 },
      { x: 2250, y: 1280, w: 25, h: 170 }, // puerta y: 1120-1280

      // Empaque (SE)
      { x: 2250, y: 1700, w: 900, h: 25 },
      { x: 2250, y: 1700, w: 25, h: 240 },
      { x: 2250, y: 2100, w: 25, h: 250 } // puerta y: 1940-2100
    ],
    decorations: [
      { type: 'oven_block', x: 1400, y: 110, w: 400, h: 110 },
      { type: 'table_prep', x: 350, y: 300, w: 200, h: 90 },
      { type: 'table_prep', x: 650, y: 450, w: 180, h: 90 },
      { type: 'flour_sacks', x: 150, y: 1800, count: 10 },
      { type: 'flour_sacks', x: 450, y: 1800, count: 8 },
      { type: 'wooden_crates', x: 750, y: 2100, count: 6 },
      { type: 'glass_showcase', x: 2450, y: 1050, w: 320, h: 80 },
      { type: 'checkout_counter', x: 2850, y: 1300, w: 240, h: 70 },
      { type: 'bread_rack', x: 2500, y: 1900, w: 70, h: 200 },
      { type: 'bread_rack', x: 2800, y: 1900, w: 70, h: 200 },
      { type: 'cafe_table', x: 1380, y: 1050 },
      { type: 'cafe_table', x: 1820, y: 1050 },
      { type: 'cafe_table', x: 1380, y: 1350 },
      { type: 'cafe_table', x: 1820, y: 1350 }
    ],
    tasks: [
      { id: 1, name: 'Amasar la Masa', room: 'Cocina & Amasado', x: 420, y: 320, type: 'amasar' },
      { id: 2, name: 'Moler Trigo', room: 'Cocina & Amasado', x: 700, y: 470, type: 'moler' },
      { id: 3, name: 'Meter Panes al Horno', room: 'Gran Horno', x: 1550, y: 240, type: 'horno' },
      { id: 4, name: 'Ajustar Temperatura', room: 'Gran Horno', x: 1750, y: 240, type: 'temperatura' },
      { id: 5, name: 'Decorar Donas', room: 'Repostería', x: 2550, y: 300, type: 'donas' },
      { id: 6, name: 'Acomodar Panes', room: 'Repostería', x: 2850, y: 450, type: 'acomodar' },
      { id: 7, name: 'Ordenar Sacos', room: 'Despensa & Silos', x: 300, y: 1950, type: 'sacos' },
      { id: 8, name: 'Vaciar Mermelada', room: 'Despensa & Silos', x: 650, y: 2150, type: 'mermelada' },
      { id: 9, name: 'Limpiar Migajas', room: 'Ventas & Mostrador', x: 2600, y: 1180, type: 'limpiar' },
      { id: 10, name: 'Enfriar Baguettes', room: 'Enfriamiento', x: 1600, y: 2000, type: 'abanicar' }
    ]
  },

  'La Masadería': {
    width: 3300,
    height: 2500,
    emergency: { x: 1650, y: 1250 },
    spawns: [
      { x: 1650, y: 1150 }, { x: 1730, y: 1190 }, { x: 1750, y: 1270 },
      { x: 1700, y: 1330 }, { x: 1600, y: 1330 }, { x: 1550, y: 1270 },
      { x: 1570, y: 1190 }, { x: 1650, y: 1310 }, { x: 1770, y: 1230 },
      { x: 1530, y: 1230 }, { x: 1650, y: 1200 }, { x: 1700, y: 1250 }
    ],
    rooms: [
      { id: 'salon', name: 'Gran Salón Rústico de Catas', x: 1300, y: 980, w: 700, h: 540, floor: 'rustic', label: 'LA GRAN MESA' },
      { id: 'molino', name: 'Sala de Engranajes del Molino', x: 1300, y: 60, w: 700, h: 660, floor: 'stone', label: 'MOLINO DE VIENTO' },
      { id: 'cava', name: 'Cava Ancestral de Levaduras', x: 60, y: 60, w: 920, h: 660, floor: 'tile_dark', label: 'CAVA DE LEVADURAS' },
      { id: 'amasado', name: 'Amasadero en Artesas de Roble', x: 60, y: 980, w: 920, h: 540, floor: 'wood', label: 'AMASADO EN ARTESAS' },
      { id: 'granero', name: 'Granero de Centeno, Cebada & Trigo', x: 60, y: 1780, w: 920, h: 660, floor: 'rustic', label: 'GRANERO DE SEMILLAS' },
      { id: 'cubas', name: 'Lavado de Barricas & Calderas', x: 1300, y: 1780, w: 700, h: 660, floor: 'metal', label: 'LAVADO DE BARRICAS' },
      { id: 'horno_piedra', name: 'Hornos de Piedra Volcánica', x: 2320, y: 60, w: 920, h: 660, floor: 'stone', label: 'HORNO VOLCÁNICO' },
      { id: 'confiteria_miel', name: 'Obrador de Miel & Piloncillo', x: 2320, y: 980, w: 920, h: 540, floor: 'tile_pink', label: 'CONFITERÍA DE MIEL' },
      { id: 'despacho_carretas', name: 'Despacho de Carretas & Cestas', x: 2320, y: 1780, w: 920, h: 660, floor: 'wood_dark', label: 'DESPACHO RÚSTICO' }
    ],
    walls: [
      { x: 0, y: 0, w: 3300, h: 30 },
      { x: 0, y: 2470, w: 3300, h: 30 },
      { x: 0, y: 0, w: 30, h: 2500 },
      { x: 3270, y: 0, w: 30, h: 2500 },

      // Cava (NW)
      { x: 60, y: 720, w: 920, h: 25 },
      { x: 980, y: 60, w: 25, h: 250 },
      { x: 980, y: 470, w: 25, h: 250 },

      // Amasado (W)
      { x: 60, y: 980, w: 920, h: 25 },
      { x: 60, y: 1520, w: 920, h: 25 },
      { x: 980, y: 980, w: 25, h: 180 },
      { x: 980, y: 1340, w: 25, h: 180 },

      // Granero (SW)
      { x: 60, y: 1780, w: 920, h: 25 },
      { x: 980, y: 1780, w: 25, h: 250 },
      { x: 980, y: 2190, w: 25, h: 250 },

      // Molino (N)
      { x: 1300, y: 60, w: 25, h: 660 },
      { x: 2000, y: 60, w: 25, h: 660 },
      { x: 1300, y: 720, w: 260, h: 25 },
      { x: 1740, y: 720, w: 260, h: 25 },

      // Salón Central
      { x: 1300, y: 980, w: 260, h: 25 },
      { x: 1740, y: 980, w: 260, h: 25 },
      { x: 1300, y: 1520, w: 260, h: 25 },
      { x: 1740, y: 1520, w: 260, h: 25 },
      { x: 1300, y: 980, w: 25, h: 180 },
      { x: 1300, y: 1340, w: 25, h: 180 },
      { x: 2000, y: 980, w: 25, h: 180 },
      { x: 2000, y: 1340, w: 25, h: 180 },

      // Lavado (S)
      { x: 1300, y: 1780, w: 25, h: 660 },
      { x: 2000, y: 1780, w: 25, h: 660 },
      { x: 1300, y: 1780, w: 260, h: 25 },
      { x: 1740, y: 1780, w: 260, h: 25 },

      // Horno Volcánico (NE)
      { x: 2320, y: 720, w: 920, h: 25 },
      { x: 2320, y: 60, w: 25, h: 250 },
      { x: 2320, y: 470, w: 25, h: 250 },

      // Confitería (E)
      { x: 2320, y: 980, w: 920, h: 25 },
      { x: 2320, y: 1520, w: 920, h: 25 },
      { x: 2320, y: 980, w: 25, h: 180 },
      { x: 2320, y: 1340, w: 25, h: 180 },

      // Despacho (SE)
      { x: 2320, y: 1780, w: 920, h: 25 },
      { x: 2320, y: 1780, w: 25, h: 250 },
      { x: 2320, y: 2190, w: 25, h: 250 }
    ],
    decorations: [
      { type: 'stone_oven', x: 2500, y: 120, w: 400, h: 120 },
      { type: 'flour_sacks', x: 200, y: 1900, count: 12 },
      { type: 'wooden_crates', x: 600, y: 2150, count: 8 },
      { type: 'table_prep', x: 450, y: 1150, w: 220, h: 90 },
      { type: 'shelves', x: 200, y: 120, w: 300, h: 60 },
      { type: 'glass_showcase', x: 2500, y: 1080, w: 320, h: 80 },
      { type: 'bread_rack', x: 2600, y: 1950, w: 80, h: 220 },
      { type: 'cafe_table', x: 1450, y: 1100 },
      { type: 'cafe_table', x: 1850, y: 1100 },
      { type: 'cafe_table', x: 1450, y: 1400 },
      { type: 'cafe_table', x: 1850, y: 1400 }
    ],
    tasks: [
      { id: 1, name: 'Amasar en Artesa de Roble', room: 'Amasado en Artesas', x: 480, y: 1180, type: 'amasar' },
      { id: 2, name: 'Moler Centeno con Piedra', room: 'Molino de Viento', x: 1650, y: 350, type: 'moler' },
      { id: 3, name: 'Meter Panes al Horno Volcánico', room: 'Horno Volcánico', x: 2650, y: 240, type: 'horno' },
      { id: 4, name: 'Ajustar Tiraje de Humo', room: 'Horno Volcánico', x: 2850, y: 400, type: 'temperatura' },
      { id: 5, name: 'Bañar en Piloncillo', room: 'Confitería de Miel', x: 2650, y: 1150, type: 'donas' },
      { id: 6, name: 'Acomodar Hogazas Rústicas', room: 'Confitería de Miel', x: 2900, y: 1300, type: 'acomodar' },
      { id: 7, name: 'Apilar Sacos de Semillas', room: 'Granero de Semillas', x: 400, y: 2050, type: 'sacos' },
      { id: 8, name: 'Llenar Cántaro de Miel', room: 'Cava de Levaduras', x: 500, y: 350, type: 'mermelada' },
      { id: 9, name: 'Barrer Virutas de Madera', room: 'Lavado de Barricas', x: 1650, y: 2100, type: 'limpiar' },
      { id: 10, name: 'Abanicar Panes de Masa Madre', room: 'Despacho Rústico', x: 2650, y: 2100, type: 'abanicar' }
    ]
  },

  'Pastelería Francesa': {
    width: 3400,
    height: 2500,
    emergency: { x: 1700, y: 1250 },
    spawns: [
      { x: 1700, y: 1150 }, { x: 1780, y: 1190 }, { x: 1800, y: 1270 },
      { x: 1750, y: 1330 }, { x: 1650, y: 1330 }, { x: 1600, y: 1270 },
      { x: 1620, y: 1190 }, { x: 1700, y: 1310 }, { x: 1820, y: 1230 },
      { x: 1580, y: 1230 }, { x: 1700, y: 1200 }, { x: 1750, y: 1250 }
    ],
    rooms: [
      { id: 'salon_real', name: 'Salón de Té & Degustación Real', x: 1350, y: 980, w: 700, h: 540, floor: 'marble', label: 'SALÓN DE TÉ REAL' },
      { id: 'atelier_macarons', name: 'Atelier de Macarons & Merengues', x: 1350, y: 60, w: 700, h: 660, floor: 'tile_pink', label: 'ATELIER MACARONS' },
      { id: 'chocolateria', name: 'Laboratorio de Alta Chocolatería', x: 60, y: 60, w: 960, h: 660, floor: 'wood_dark', label: 'CHOCOLATERÍA FINA' },
      { id: 'mantequilla', name: 'Cámara Fría de Mantequilla de Normandía', x: 60, y: 980, w: 960, h: 540, floor: 'tile', label: 'CÁMARA MANTEQUILLA' },
      { id: 'invernadero', name: 'Invernadero de Vainilla & Frambuesas', x: 60, y: 1780, w: 960, h: 660, floor: 'stone', label: 'INVERNADERO FRUTAL' },
      { id: 'horno_croissants', name: 'Hornos de Croissants Hojaldrados', x: 1350, y: 1780, w: 700, h: 660, floor: 'stone', label: 'HORNO CROISSANTS' },
      { id: 'cava_licores', name: 'Cava de Vinos Dulces & Licores', x: 2380, y: 60, w: 960, h: 660, floor: 'rustic', label: 'CAVA DE LICORES' },
      { id: 'galeria_cristal', name: 'Galería de Vitrinas & Esculturas de Azúcar', x: 2380, y: 980, w: 960, h: 540, floor: 'marble', label: 'GALERÍA DE CRISTAL' },
      { id: 'empaque_seda', name: 'Salón de Empaque de Lujo con Seda', x: 2380, y: 1780, w: 960, h: 660, floor: 'wood', label: 'EMPAQUE DE SEDA' }
    ],
    walls: [
      { x: 0, y: 0, w: 3400, h: 30 },
      { x: 0, y: 2470, w: 3400, h: 30 },
      { x: 0, y: 0, w: 30, h: 2500 },
      { x: 3370, y: 0, w: 30, h: 2500 },

      // Chocolatería (NW)
      { x: 60, y: 720, w: 960, h: 25 },
      { x: 1020, y: 60, w: 25, h: 250 },
      { x: 1020, y: 470, w: 25, h: 250 },

      // Mantequilla (W)
      { x: 60, y: 980, w: 960, h: 25 },
      { x: 60, y: 1520, w: 960, h: 25 },
      { x: 1020, y: 980, w: 25, h: 180 },
      { x: 1020, y: 1340, w: 25, h: 180 },

      // Invernadero (SW)
      { x: 60, y: 1780, w: 960, h: 25 },
      { x: 1020, y: 1780, w: 25, h: 250 },
      { x: 1020, y: 2190, w: 25, h: 250 },

      // Atelier Macarons (N)
      { x: 1350, y: 60, w: 25, h: 660 },
      { x: 2050, y: 60, w: 25, h: 660 },
      { x: 1350, y: 720, w: 260, h: 25 },
      { x: 1790, y: 720, w: 260, h: 25 },

      // Salón de Té Central
      { x: 1350, y: 980, w: 260, h: 25 },
      { x: 1790, y: 980, w: 260, h: 25 },
      { x: 1350, y: 1520, w: 260, h: 25 },
      { x: 1790, y: 1520, w: 260, h: 25 },
      { x: 1350, y: 980, w: 25, h: 180 },
      { x: 1350, y: 1340, w: 25, h: 180 },
      { x: 2050, y: 980, w: 25, h: 180 },
      { x: 2050, y: 1340, w: 25, h: 180 },

      // Horno Croissants (S)
      { x: 1350, y: 1780, w: 25, h: 660 },
      { x: 2050, y: 1780, w: 25, h: 660 },
      { x: 1350, y: 1780, w: 260, h: 25 },
      { x: 1790, y: 1780, w: 260, h: 25 },

      // Cava Licores (NE)
      { x: 2380, y: 720, w: 960, h: 25 },
      { x: 2380, y: 60, w: 25, h: 250 },
      { x: 2380, y: 470, w: 25, h: 250 },

      // Galería Cristal (E)
      { x: 2380, y: 980, w: 960, h: 25 },
      { x: 2380, y: 1520, w: 960, h: 25 },
      { x: 2380, y: 980, w: 25, h: 180 },
      { x: 2380, y: 1340, w: 25, h: 180 },

      // Empaque Seda (SE)
      { x: 2380, y: 1780, w: 960, h: 25 },
      { x: 2380, y: 1780, w: 25, h: 250 },
      { x: 2380, y: 2190, w: 25, h: 250 }
    ],
    decorations: [
      { type: 'glass_showcase', x: 2500, y: 1050, w: 380, h: 80 },
      { type: 'crystal_table', x: 1500, y: 1100, w: 180, h: 80 },
      { type: 'crystal_table', x: 1720, y: 1100, w: 180, h: 80 },
      { type: 'oven_block', x: 1500, y: 1840, w: 400, h: 110 },
      { type: 'table_prep', x: 300, y: 300, w: 220, h: 90 },
      { type: 'flour_sacks', x: 200, y: 1850, count: 8 },
      { type: 'bread_rack', x: 2600, y: 1950, w: 80, h: 220 },
      { type: 'checkout_counter', x: 2800, y: 1350, w: 260, h: 70 }
    ],
    tasks: [
      { id: 1, name: 'Amasar Hojaldre Francés', room: 'Chocolatería Fina', x: 450, y: 340, type: 'amasar' },
      { id: 2, name: 'Moler Granos de Cacao', room: 'Chocolatería Fina', x: 750, y: 520, type: 'moler' },
      { id: 3, name: 'Hornear Croissants de Mantequilla', room: 'Horno Croissants', x: 1650, y: 1980, type: 'horno' },
      { id: 4, name: 'Atemperar Chocolate Suizo', room: 'Cámara Mantequilla', x: 450, y: 1240, type: 'temperatura' },
      { id: 5, name: 'Decorar Macarons de Colores', room: 'Atelier Macarons', x: 1650, y: 320, type: 'donas' },
      { id: 6, name: 'Acomodar Eclairs en Vitrina', room: 'Galería de Cristal', x: 2750, y: 1220, type: 'acomodar' },
      { id: 7, name: 'Organizar Cajas de Seda', room: 'Empaque de Seda', x: 2750, y: 2020, type: 'sacos' },
      { id: 8, name: 'Verter Jalea de Frambuesa', room: 'Invernadero Frutal', x: 450, y: 2020, type: 'mermelada' },
      { id: 9, name: 'Lustrar Vitrinas de Cristal', room: 'Cava de Licores', x: 2750, y: 420, type: 'limpiar' },
      { id: 10, name: 'Enfriar Merengues Suaves', room: 'Atelier Macarons', x: 1700, y: 480, type: 'abanicar' }
    ]
  },

  'Fábrica Industrial': {
    width: 3500,
    height: 2600,
    emergency: { x: 1750, y: 1300 },
    spawns: [
      { x: 1750, y: 1200 }, { x: 1830, y: 1240 }, { x: 1850, y: 1320 },
      { x: 1800, y: 1380 }, { x: 1700, y: 1380 }, { x: 1650, y: 1320 },
      { x: 1670, y: 1240 }, { x: 1750, y: 1360 }, { x: 1870, y: 1280 },
      { x: 1630, y: 1280 }, { x: 1750, y: 1250 }, { x: 1800, y: 1300 }
    ],
    rooms: [
      { id: 'control_central', name: 'Sala de Comando & Monitores Centrales', x: 1400, y: 1020, w: 700, h: 560, floor: 'caution', label: 'CONTROL CENTRAL' },
      { id: 'hornos_tunel', name: 'Hornos de Túnel Automatizados', x: 1400, y: 60, w: 700, h: 680, floor: 'stone', label: 'HORNOS DE TÚNEL' },
      { id: 'silos_acero', name: 'Parque de Silos de Acero Inoxidable', x: 60, y: 60, w: 1000, h: 680, floor: 'metal', label: 'SILOS DE ACERO' },
      { id: 'mezcladoras', name: 'Mezcladoras Continuas de Gran Volumen', x: 60, y: 1020, w: 1000, h: 560, floor: 'tile_dark', label: 'MEZCLADORAS INDUSTRIALES' },
      { id: 'laboratorio', name: 'Laboratorio de Biotecnología & Levaduras', x: 60, y: 1860, w: 1000, h: 680, floor: 'tile', label: 'LABORATORIO DE CALIDAD' },
      { id: 'calderas', name: 'Generadores de Vapor & Calderas', x: 1400, y: 1860, w: 700, h: 680, floor: 'metal', label: 'CALDERAS DE VAPOR' },
      { id: 'rebanado', name: 'Línea Robótica de Rebanado & Envasado', x: 2440, y: 60, w: 1000, h: 680, floor: 'caution', label: 'LÍNEA DE REBANADO' },
      { id: 'inspeccion', name: 'Puesto de Inspección & Rayos X', x: 2440, y: 1020, w: 1000, h: 560, floor: 'tile', label: 'INSPECCIÓN DE CALIDAD' },
      { id: 'muelle', name: 'Muelle de Embarque & Logística de Camiones', x: 2440, y: 1860, w: 1000, h: 680, floor: 'metal', label: 'MUELLE DE CARGA' }
    ],
    walls: [
      { x: 0, y: 0, w: 3500, h: 30 },
      { x: 0, y: 2570, w: 3500, h: 30 },
      { x: 0, y: 0, w: 30, h: 2600 },
      { x: 3470, y: 0, w: 30, h: 2600 },

      // Silos (NW)
      { x: 60, y: 740, w: 1000, h: 25 },
      { x: 1060, y: 60, w: 25, h: 250 },
      { x: 1060, y: 490, w: 25, h: 250 },

      // Mezcladoras (W)
      { x: 60, y: 1020, w: 1000, h: 25 },
      { x: 60, y: 1580, w: 1000, h: 25 },
      { x: 1060, y: 1020, w: 25, h: 180 },
      { x: 1060, y: 1400, w: 25, h: 180 },

      // Laboratorio (SW)
      { x: 60, y: 1860, w: 1000, h: 25 },
      { x: 1060, y: 1860, w: 25, h: 250 },
      { x: 1060, y: 2290, w: 25, h: 250 },

      // Hornos Túnel (N)
      { x: 1400, y: 60, w: 25, h: 680 },
      { x: 2100, y: 60, w: 25, h: 680 },
      { x: 1400, y: 740, w: 260, h: 25 },
      { x: 1840, y: 740, w: 260, h: 25 },

      // Control Central
      { x: 1400, y: 1020, w: 260, h: 25 },
      { x: 1840, y: 1020, w: 260, h: 25 },
      { x: 1400, y: 1580, w: 260, h: 25 },
      { x: 1840, y: 1580, w: 260, h: 25 },
      { x: 1400, y: 1020, w: 25, h: 180 },
      { x: 1400, y: 1400, w: 25, h: 180 },
      { x: 2100, y: 1020, w: 25, h: 180 },
      { x: 2100, y: 1400, w: 25, h: 180 },

      // Calderas (S)
      { x: 1400, y: 1860, w: 25, h: 680 },
      { x: 2100, y: 1860, w: 25, h: 680 },
      { x: 1400, y: 1860, w: 260, h: 25 },
      { x: 1840, y: 1860, w: 260, h: 25 },

      // Rebanado (NE)
      { x: 2440, y: 740, w: 1000, h: 25 },
      { x: 2440, y: 60, w: 25, h: 250 },
      { x: 2440, y: 490, w: 25, h: 250 },

      // Inspección (E)
      { x: 2440, y: 1020, w: 1000, h: 25 },
      { x: 2440, y: 1580, w: 1000, h: 25 },
      { x: 2440, y: 1020, w: 25, h: 180 },
      { x: 2440, y: 1400, w: 25, h: 180 },

      // Muelle (SE)
      { x: 2440, y: 1860, w: 1000, h: 25 },
      { x: 2440, y: 1860, w: 25, h: 250 },
      { x: 2440, y: 2290, w: 25, h: 250 }
    ],
    decorations: [
      { type: 'conveyor_belt', x: 2550, y: 250, w: 500, h: 60 },
      { type: 'conveyor_belt', x: 2550, y: 450, w: 500, h: 60 },
      { type: 'silo', x: 300, y: 250, r: 80 },
      { type: 'silo', x: 600, y: 250, r: 80 },
      { type: 'silo', x: 900, y: 250, r: 80 },
      { type: 'oven_block', x: 1500, y: 150, w: 500, h: 140 },
      { type: 'wooden_crates', x: 2600, y: 2000, count: 12 },
      { type: 'flour_sacks', x: 300, y: 1200, count: 10 },
      { type: 'table_prep', x: 600, y: 1200, w: 240, h: 90 }
    ],
    tasks: [
      { id: 1, name: 'Amasar Masa en Tina Industrial', room: 'Mezcladoras Industriales', x: 480, y: 1280, type: 'amasar' },
      { id: 2, name: 'Moler Trigo en Molino Eléctrico', room: 'Silos de Acero', x: 480, y: 380, type: 'moler' },
      { id: 3, name: 'Supervisar Horno de Túnel', room: 'Hornos de Túnel', x: 1750, y: 360, type: 'horno' },
      { id: 4, name: 'Calibrar Sensores Térmicos', room: 'Calderas de Vapor', x: 1750, y: 2180, type: 'temperatura' },
      { id: 5, name: 'Inyectar Relleno Automático', room: 'Línea de Rebanado', x: 2850, y: 360, type: 'donas' },
      { id: 6, name: 'Estibar Rebanadas de Molde', room: 'Inspección de Calidad', x: 2850, y: 1280, type: 'acomodar' },
      { id: 7, name: 'Descargar Sacos de Levadura', room: 'Laboratorio de Calidad', x: 480, y: 2180, type: 'sacos' },
      { id: 8, name: 'Presurizar Tanque de Mermelada', room: 'Laboratorio de Calidad', x: 780, y: 2180, type: 'mermelada' },
      { id: 9, name: 'Desinfectar Banda Transportadora', room: 'Muelle de Carga', x: 2850, y: 2180, type: 'limpiar' },
      { id: 10, name: 'Activar Turbinas de Enfriamiento', room: 'Hornos de Túnel', x: 1750, y: 550, type: 'abanicar' }
    ]
  }
};

// ============================================
// UTILIDADES
// ============================================
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getMapPayload(room) {
  return {
    width: room.map.width,
    height: room.map.height,
    emergency: room.map.emergency,
    spawns: room.map.spawns,
    rooms: room.map.rooms || [],
    walls: room.map.walls || [],
    decorations: room.map.decorations || [],
    tasks: room.map.tasks.slice(0, room.config.taskCount)
  };
}

// ============================================
// MANEJO DE SOCKETS
// ============================================
io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);

  // -------- CREAR SALA --------
  socket.on('create_room', (config, cb) => {
    try {
      const code = generateRoomCode();
      const mapName = MAPS[config.map] ? config.map : 'El Horno Central';
      const mapData = MAPS[mapName];

      const room = {
        code,
        hostId: socket.id,
        state: 'lobby', // lobby | playing | voting | ended
        config: {
          maxPlayers: Math.min(15, Math.max(2, config.maxPlayers || 8)),
          speed: Math.min(3, Math.max(0.5, config.speed || 1.5)),
          vision: Math.min(600, Math.max(120, config.vision || 280)),
          taskCount: Math.min(15, Math.max(5, config.taskCount || 10)),
          impostors: Math.min(3, Math.max(1, config.impostors || 1)),
          map: mapName
        },
        map: mapData,
        players: new Map(),
        createdAt: Date.now(),
        votes: {},
        chat: [],
        bodyReported: null,
        votingTimer: null
      };

      rooms.set(code, room);
      socketToRoom.set(socket.id, code);
      socket.join(code);

      const player = createPlayer(socket.id, config.profile, room);
      room.players.set(socket.id, player);

      const mapPayload = getMapPayload(room);
      const playersList = Array.from(room.players.values()).map(sanitizePlayer);

      cb({
        ok: true,
        code,
        player: sanitizePlayer(player),
        config: room.config,
        map: mapPayload,
        players: playersList
      });

      io.to(code).emit('lobby_update', {
        players: playersList,
        hostId: room.hostId,
        config: room.config,
        map: mapPayload
      });

      console.log(`🏠 Sala creada: ${code}`);
    } catch (e) {
      console.error(e);
      cb({ ok: false, error: 'Error al crear sala' });
    }
  });

  // -------- UNIRSE A SALA --------
  socket.on('join_room', ({ code, profile }, cb) => {
    try {
      code = String(code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return cb({ ok: false, error: 'Sala no encontrada' });
      if (room.state !== 'lobby') return cb({ ok: false, error: 'Partida en curso' });
      if (room.players.size >= room.config.maxPlayers)
        return cb({ ok: false, error: 'Sala llena' });

      socketToRoom.set(socket.id, code);
      socket.join(code);

      const player = createPlayer(socket.id, profile, room);
      room.players.set(socket.id, player);

      const mapPayload = getMapPayload(room);
      const playersList = Array.from(room.players.values()).map(sanitizePlayer);

      io.to(code).emit('lobby_update', {
        players: playersList,
        hostId: room.hostId,
        config: room.config,
        map: mapPayload
      });

      cb({
        ok: true,
        code,
        player: sanitizePlayer(player),
        config: room.config,
        map: mapPayload,
        players: playersList
      });

      console.log(`👤 ${player.name} se unió a ${code}`);
    } catch (e) {
      console.error(e);
      cb({ ok: false, error: 'Error al unirse' });
    }
  });

  // -------- ACTUALIZAR PERFIL EN LOBBY --------
  socket.on('update_profile', (profile) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'lobby') return;
    const player = room.players.get(socket.id);
    if (!player) return;
    if (profile.name) player.name = String(profile.name).slice(0, 12);
    if (profile.skin && BREAD_SKINS.includes(profile.skin)) player.skin = profile.skin;
    if (profile.hat && HATS.includes(profile.hat)) player.hat = profile.hat;
    if (profile.face && FACES.includes(profile.face)) player.face = profile.face;

    const mapPayload = getMapPayload(room);

    io.to(code).emit('lobby_update', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config,
      map: mapPayload
    });
  });

  // -------- INICIAR PARTIDA --------
  socket.on('start_game', () => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    if (room.players.size < 1) {
      socket.emit('error_msg', 'No hay jugadores en la sala');
      return;
    }
    startGame(room);
  });

  // -------- MOVIMIENTO --------
  socket.on('move', (data) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || (room.state !== 'playing' && room.state !== 'lobby')) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (!p.alive && room.state === 'playing' && !p.isGhost) return;
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return;

    const maxDist = 90; // margen seguro por tick
    const dx = data.x - p.x;
    const dy = data.y - p.y;
    if (Math.hypot(dx, dy) > maxDist) return;

    p.x = data.x;
    p.y = data.y;
    p.dir = data.dir || p.dir;
    p.moving = data.moving !== false;
    p.animTime = (p.animTime || 0) + 1;

    socket.to(code).emit('player_moved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      dir: p.dir,
      moving: p.moving,
      animTime: p.animTime
    });
  });

  // -------- MATAR (IMPOSTOR) --------
  socket.on('kill', ({ targetId }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const killer = room.players.get(socket.id);
    const target = room.players.get(targetId);
    if (!killer || !target) return;
    if (!killer.isImpostor || !killer.alive || !target.alive) return;
    if (Date.now() - (killer.lastKill || 0) < 25000) return;

    const dist = Math.hypot(killer.x - target.x, killer.y - target.y);
    if (dist > 90) return;

    target.alive = false;
    target.isGhost = true;
    target.deathX = target.x;
    target.deathY = target.y;
    target.deathTime = Date.now();
    killer.lastKill = Date.now();

    io.to(code).emit('player_killed', {
      killerId: socket.id,
      targetId,
      x: target.x,
      y: target.y
    });
    checkWinCondition(room);
  });

  // -------- REPORTAR CUERPO --------
  socket.on('report_body', ({ targetId }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const reporter = room.players.get(socket.id);
    const target = room.players.get(targetId);
    if (!reporter || !reporter.alive || !target || target.alive) return;
    if (typeof target.deathX !== 'number' || typeof target.deathY !== 'number') return;

    const dist = Math.hypot(reporter.x - target.deathX, reporter.y - target.deathY);
    if (dist > 140) return;

    startVoting(room, socket.id, target.name);
  });

  // -------- EMERGENCIA (REUNIÓN CENTRAL) --------
  socket.on('emergency', () => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.isGhost) return;
    const e = (room.map && room.map.emergency) || { x: 1000, y: 760 };
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    if (dist > 180) return;

    // Enfriamiento inicial al comenzar la partida (8 segundos)
    const timeSinceStart = Date.now() - (room.startTime || 0);
    if (timeSinceStart < 8000) {
      const waitSec = Math.ceil((8000 - timeSinceStart) / 1000);
      socket.emit('toast', { msg: `⏳ Espera ${waitSec}s para convocar una reunión` });
      return;
    }

    if (p.emergencyCount !== undefined && p.emergencyCount <= 0) {
      socket.emit('toast', { msg: '❌ Ya utilizaste tu reunión de emergencia en esta partida' });
      return;
    }

    p.emergencyCount = (p.emergencyCount !== undefined ? p.emergencyCount : 1) - 1;
    console.log(`🔔 ${p.name} convocó una reunión de emergencia en sala ${room.code}`);
    startVoting(room, socket.id, 'EMERGENCIA');
  });

  // -------- VOTAR --------
  socket.on('vote', ({ targetId }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'voting') return;
    const voter = room.players.get(socket.id);
    if (!voter || !voter.alive) return; // Muertos no votan
    if (room.votes[socket.id]) return; // Ya emitió su voto

    if (targetId !== 'skip') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return; // No se vota por muertos
    }

    room.votes[socket.id] = targetId;

    io.to(code).emit('vote_update', {
      votes: room.votes,
      voters: Object.keys(room.votes)
    });

    const aliveVoters = Array.from(room.players.values()).filter(p => p.alive);
    if (Object.keys(room.votes).length >= aliveVoters.length) {
      finishVoting(room);
    }
  });

  // -------- CHAT (FILTRADO FANTASMAS VS VIVOS) --------
  socket.on('chat', ({ msg }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const sender = room.players.get(socket.id);
    if (!sender) return;
    const cleanMsg = String(msg || '').trim().slice(0, 200);
    if (!cleanMsg) return;

    // Un emisor es fantasma si está en partida/votación y no está vivo
    const isSenderGhost = (room.state !== 'lobby') && (!sender.alive || sender.isGhost);

    const message = {
      senderId: socket.id,
      name: sender.name,
      msg: cleanMsg,
      ts: Date.now(),
      color: sender.color,
      skin: sender.skin,
      alive: sender.alive,
      isGhost: isSenderGhost
    };
    room.chat.push(message);
    if (room.chat.length > 100) room.chat.shift();

    if (isSenderGhost) {
      // 👻 Chat de fantasmas: SÓLO se envía a los sockets de jugadores que estén muertos/fantasmas
      for (const [targetSocketId, targetPlayer] of room.players) {
        if (!targetPlayer.alive || targetPlayer.isGhost) {
          io.to(targetSocketId).emit('chat', message);
        }
      }
    } else {
      // 🍞 Chat de vivos: Lo reciben TODOS (tanto vivos como fantasmas)
      io.to(code).emit('chat', message);
    }
  });

  // -------- COMPLETAR MISIÓN --------
  socket.on('task_complete', ({ taskId }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (p.completedTasks.includes(taskId)) return;
    p.completedTasks.push(taskId);

    io.to(code).emit('task_update', {
      playerId: socket.id,
      completed: p.completedTasks.length,
      total: room.config.taskCount,
      globalCompleted: Array.from(room.players.values())
        .reduce((sum, pl) => sum + (pl.isImpostor ? 0 : pl.completedTasks.length), 0),
      globalTotal: Array.from(room.players.values())
        .filter(pl => !pl.isImpostor)
        .reduce((sum, pl) => sum + room.config.taskCount, 0)
    });
    checkWinCondition(room);
  });

  // -------- HABILIDAD IMPOSTOR (INVISIBILIDAD) --------
  socket.on('invisibility', () => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.isImpostor || !p.alive) return;
    if (p.skin !== 'mohoso') return;
    if (Date.now() - (p.lastInvis || 0) < 25000) return;
    p.lastInvis = Date.now();
    p.invisible = true;
    io.to(code).emit('player_invisible', { playerId: socket.id, duration: 4000 });
    setTimeout(() => {
      p.invisible = false;
      io.to(code).emit('player_visible', { playerId: socket.id });
    }, 4000);
  });

  // -------- DESCONEXIÓN --------
  socket.on('disconnect', () => {
    const code = socketToRoom.get(socket.id);
    socketToRoom.delete(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.players.delete(socket.id);
    delete room.votes[socket.id];

    if (room.players.size === 0) {
      if (room.votingTimer) clearTimeout(room.votingTimer);
      rooms.delete(code);
      console.log(`🗑️ Sala eliminada: ${code}`);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }

    io.to(code).emit('player_left', { playerId: socket.id });

    // Si estábamos en votación, verificar si ya votaron todos los que quedan vivos
    if (room.state === 'voting') {
      const aliveVoters = Array.from(room.players.values()).filter(p => p.alive);
      if (aliveVoters.length === 0 || Object.keys(room.votes).length >= aliveVoters.length) {
        finishVoting(room);
      } else {
        io.to(code).emit('vote_update', {
          votes: room.votes,
          voters: Object.keys(room.votes)
        });
      }
    }

    const mapPayload = getMapPayload(room);
    io.to(code).emit('lobby_update', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config,
      map: mapPayload
    });
    checkWinCondition(room);
  });
});

// ============================================
// LÓGICA DE JUEGO
// ============================================
function createPlayer(id, profile = {}, room) {
  const idx = room.players.size;
  const colors = ['#f4c542', '#e8a87c', '#d4a373', '#c98b5e', '#e6b980',
                  '#f0d78c', '#d9a066', '#bf8040', '#a67c52', '#8b5a2b'];
  const spawnPos = room.map.spawns[idx % room.map.spawns.length] || { x: 1000, y: 760 };

  return {
    id,
    name: (profile.name || `Pan${idx + 1}`).slice(0, 12),
    skin: BREAD_SKINS.includes(profile.skin) ? profile.skin : BREAD_SKINS[idx % BREAD_SKINS.length],
    hat: HATS.includes(profile.hat) ? profile.hat : 'none',
    face: FACES.includes(profile.face) ? profile.face : 'none',
    color: colors[idx % colors.length],
    x: spawnPos.x,
    y: spawnPos.y,
    dir: 1,
    moving: false,
    animTime: 0,
    alive: true,
    isImpostor: false,
    isGhost: false,
    invisible: false,
    completedTasks: [],
    lastKill: 0,
    lastInvis: 0,
    deathX: null,
    deathY: null,
    role: 'panadero'
  };
}

function sanitizePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    skin: p.skin,
    hat: p.hat,
    face: p.face,
    color: p.color,
    x: p.x,
    y: p.y,
    dir: p.dir,
    alive: p.alive,
    isGhost: p.isGhost,
    role: p.role,
    moving: p.moving,
    animTime: p.animTime
  };
}

function startGame(room) {
  room.state = 'playing';
  room.startTime = Date.now();
  room.votes = {};
  room.chat = [];
  if (room.votingTimer) {
    clearTimeout(room.votingTimer);
    room.votingTimer = null;
  }

  const playerIds = Array.from(room.players.keys());
  const shuffled = shuffle(playerIds);
  const impostorCount = playerIds.length >= 2
    ? Math.min(room.config.impostors, Math.max(1, Math.floor(playerIds.length / 3)))
    : 0;
  const impostorIds = shuffled.slice(0, impostorCount);

  let spawnIdx = 0;
  const spawns = shuffle(room.map.spawns);
  for (const [id, p] of room.players) {
    p.alive = true;
    p.isGhost = false;
    p.isImpostor = impostorIds.includes(id);
    p.completedTasks = [];
    p.invisible = false;
    p.lastKill = 0;
    p.deathX = null;
    p.deathY = null;
    p.emergencyCount = 1;
    p.x = spawns[spawnIdx % spawns.length].x;
    p.y = spawns[spawnIdx % spawns.length].y;
    spawnIdx++;

    if (p.isImpostor) {
      p.role = p.skin === 'mohoso' ? 'Pan Infeccioso' : 'Impostor Básico';
    } else {
      p.role = Math.random() < 0.3 ? 'Maestro Harinero' : 'Panadero Estándar';
    }

    io.to(id).emit('role_assigned', {
      role: p.role,
      isImpostor: p.isImpostor,
      impostorIds: p.isImpostor ? impostorIds : [],
      tasks: p.isImpostor ? [] : room.map.tasks.slice(0, room.config.taskCount)
    });
  }

  const mapPayload = getMapPayload(room);

  io.to(room.code).emit('game_started', {
    config: room.config,
    map: mapPayload,
    players: Array.from(room.players.values()).map(sanitizePlayer)
  });

  console.log(`🎮 Partida iniciada en ${room.code} (${impostorCount} impostores)`);
}

function startVoting(room, reporterId, reportedName) {
  if (room.state !== 'playing') return;
  room.state = 'voting';
  room.votes = {};

  if (room.votingTimer) {
    clearTimeout(room.votingTimer);
    room.votingTimer = null;
  }

  io.to(room.code).emit('voting_started', {
    reporterId,
    reportedName,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      alive: p.alive,
      isGhost: p.isGhost,
      color: p.color
    }))
  });

  // Timer de 30s
  room.votingTimer = setTimeout(() => {
    finishVoting(room);
  }, 30000);
}

function finishVoting(room) {
  if (room.state !== 'voting') return;
  if (room.votingTimer) {
    clearTimeout(room.votingTimer);
    room.votingTimer = null;
  }

  // Contar votos
  const counts = {};
  for (const target of Object.values(room.votes)) {
    counts[target] = (counts[target] || 0) + 1;
  }

  let maxVotes = 0;
  let ejected = null;
  let tie = false;
  for (const [id, c] of Object.entries(counts)) {
    if (c > maxVotes) {
      maxVotes = c;
      ejected = id;
      tie = false;
    } else if (c === maxVotes) {
      tie = true;
    }
  }
  if (tie || maxVotes === 0 || ejected === 'skip') {
    ejected = null;
  }

  let ejectedPlayer = null;
  if (ejected) {
    const p = room.players.get(ejected);
    if (p) {
      p.alive = false;
      p.isGhost = true;
      ejectedPlayer = p;
    }
  }

  // Limpiar todos los cadáveres tras la reunión
  for (const p of room.players.values()) {
    p.deathX = null;
    p.deathY = null;
  }

  // Teletransportar a jugadores vivos alrededor de la mesa de emergencia
  let sIdx = 0;
  const spawns = room.map.spawns;
  for (const p of room.players.values()) {
    if (p.alive) {
      p.x = spawns[sIdx % spawns.length].x;
      p.y = spawns[sIdx % spawns.length].y;
      p.moving = false;
      sIdx++;
    }
  }

  io.to(room.code).emit('voting_result', {
    ejectedId: ejected,
    ejectedName: ejectedPlayer ? ejectedPlayer.name : null,
    wasImpostor: ejectedPlayer ? ejectedPlayer.isImpostor : false,
    votes: room.votes,
    tie: tie && maxVotes > 0
  });

  // Reanudar tras 3.5 segundos sincronizados con el cliente
  setTimeout(() => {
    if (rooms.has(room.code) && room.state === 'voting') {
      room.state = 'playing';
      room.votes = {};
      io.to(room.code).emit('round_resumed', {
        players: Array.from(room.players.values()).map(sanitizePlayer)
      });
      checkWinCondition(room);
    }
  }, 3500);
}

function checkWinCondition(room) {
  if (room.state === 'ended') return;

  const alive = Array.from(room.players.values()).filter(p => p.alive);
  const aliveImpostors = alive.filter(p => p.isImpostor);
  const aliveCrew = alive.filter(p => !p.isImpostor);

  // Misiones
  const totalTasks = Array.from(room.players.values())
    .filter(p => !p.isImpostor)
    .reduce((sum) => sum + room.config.taskCount, 0);
  const completedTasks = Array.from(room.players.values())
    .filter(p => !p.isImpostor)
    .reduce((sum, p) => sum + p.completedTasks.length, 0);

  // Modo solo / práctica
  if (room.players.size === 1) {
    if (totalTasks > 0 && completedTasks >= totalTasks) {
      endGame(room, 'crewmates');
    }
    return;
  }

  // Victoria impostores
  if (aliveImpostors.length > 0) {
    if (aliveCrew.length === 0 || (alive.length > 2 && aliveImpostors.length >= aliveCrew.length)) {
      endGame(room, 'impostors');
      return;
    }
  }

  // Victoria tripulantes si no quedan impostores
  const startedWithImpostors = Array.from(room.players.values()).some(p => p.isImpostor);
  if (startedWithImpostors && aliveImpostors.length === 0) {
    endGame(room, 'crewmates');
    return;
  }

  // Victoria por misiones
  if (totalTasks > 0 && completedTasks >= totalTasks) {
    endGame(room, 'crewmates');
  }
}

function endGame(room, winner) {
  room.state = 'ended';
  io.to(room.code).emit('game_ended', {
    winner,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      isImpostor: p.isImpostor,
      alive: p.alive
    }))
  });

  // Reiniciar a lobby tras 8 segundos
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.state = 'lobby';
    for (const p of room.players.values()) {
      p.alive = true;
      p.isGhost = false;
      p.isImpostor = false;
      p.completedTasks = [];
      p.deathX = null;
      p.deathY = null;
      p.role = 'panadero';
    }
    const mapPayload = getMapPayload(room);
    io.to(room.code).emit('back_to_lobby', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config,
      map: mapPayload
    });
  }, 8000);
}

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🍞 Among Breads Server corriendo en puerto ${PORT}`);
  console.log(`🌐 Local:   http://localhost:${PORT}`);
  console.log(`📱 Celular: http://192.168.155.101:${PORT} (en la misma red Wi-Fi)`);
});