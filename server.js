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
  'La Mansión en L': {
    width: 3400,
    height: 2600,
    emergency: { x: 700, y: 1650 },
    exterior: 'night_sky',
    spawns: [
      { x: 700, y: 1540 }, { x: 780, y: 1580 }, { x: 820, y: 1650 },
      { x: 780, y: 1720 }, { x: 700, y: 1760 }, { x: 620, y: 1720 },
      { x: 580, y: 1650 }, { x: 620, y: 1580 }, { x: 740, y: 1600 },
      { x: 660, y: 1600 }, { x: 740, y: 1700 }, { x: 660, y: 1700 }
    ],
    rooms: [
      { id: 'molino', name: 'Molino Imperial de Viento', x: 60, y: 60, w: 620, h: 600, floor: 'stone', label: 'MOLINO IMPERIAL' },
      { id: 'granero', name: 'Granero de Trigo Dorado', x: 740, y: 60, w: 600, h: 600, floor: 'wood_dark', label: 'GRANERO DORADO' },
      { id: 'fermentacion', name: 'Cámara de Fermentación', x: 60, y: 720, w: 620, h: 580, floor: 'tile', label: 'FERMENTACIÓN' },
      { id: 'arcadas', name: 'Pasillo de las Arcadas', x: 740, y: 720, w: 600, h: 580, floor: 'wood', label: 'PASILLO ARCADAS' },
      { id: 'salon_central', name: 'Salón de la Campana Central', x: 60, y: 1360, w: 1280, h: 580, floor: 'marble', label: 'SALÓN DE LA CAMPANA' },
      { id: 'cava', name: 'Cava de Vinos & Levaduras', x: 60, y: 2000, w: 620, h: 540, floor: 'stone', label: 'CAVA DE LEVADURAS' },
      { id: 'pasillo_sur', name: 'Pasillo de los Carruajes', x: 740, y: 2000, w: 600, h: 540, floor: 'wood', label: 'PASILLO SUR' },
      { id: 'obrador', name: 'El Gran Obrador Real', x: 1400, y: 1360, w: 920, h: 580, floor: 'tile_pink', label: 'OBRADOR REAL' },
      { id: 'hornos', name: 'Cocina de Horneado & Fuego', x: 1400, y: 2000, w: 920, h: 540, floor: 'stone', label: 'HORNOS REALES' },
      { id: 'salon_te', name: 'Salón de Té & Degustación', x: 2380, y: 1360, w: 960, h: 580, floor: 'marble', label: 'SALÓN DE TÉ' },
      { id: 'despacho', name: 'Despacho Real de Cestas', x: 2380, y: 2000, w: 960, h: 540, floor: 'wood_dark', label: 'DESPACHO REAL' },
      { id: 'patio_exterior', name: 'Patio Exterior de Medianoche', x: 1400, y: 60, w: 1940, h: 1240, floor: 'cobblestone', label: 'PATIO EXTERIOR DE MEDIANOCHE' }
    ],
    walls: [
      { x: 30, y: 30, w: 30, h: 2540 },
      { x: 30, y: 30, w: 3340, h: 30 },
      { x: 3340, y: 30, w: 30, h: 2540 },
      { x: 30, y: 2540, w: 3340, h: 30 },
      { x: 1370, y: 30, w: 25, h: 750 },
      { x: 1370, y: 980, w: 25, h: 350 },
      { x: 1370, y: 1330, w: 430, h: 25 },
      { x: 2000, y: 1330, w: 1340, h: 25 },
      { x: 710, y: 60, w: 25, h: 220 },
      { x: 710, y: 440, w: 25, h: 220 },
      { x: 60, y: 690, w: 200, h: 25 },
      { x: 420, y: 690, w: 480, h: 25 },
      { x: 1100, y: 690, w: 270, h: 25 },
      { x: 710, y: 720, w: 25, h: 180 },
      { x: 710, y: 1080, w: 25, h: 220 },
      { x: 60, y: 1330, w: 200, h: 25 },
      { x: 440, y: 1330, w: 460, h: 25 },
      { x: 1120, y: 1330, w: 250, h: 25 },
      { x: 1370, y: 1360, w: 25, h: 140 },
      { x: 1370, y: 1760, w: 25, h: 180 },
      { x: 60, y: 1970, w: 200, h: 25 },
      { x: 440, y: 1970, w: 460, h: 25 },
      { x: 1120, y: 1970, w: 250, h: 25 },
      { x: 710, y: 2000, w: 25, h: 160 },
      { x: 710, y: 2340, w: 25, h: 200 },
      { x: 1400, y: 1970, w: 300, h: 25 },
      { x: 1900, y: 1970, w: 450, h: 25 },
      { x: 2350, y: 1360, w: 25, h: 140 },
      { x: 2350, y: 1740, w: 25, h: 200 },
      { x: 2350, y: 2000, w: 25, h: 160 },
      { x: 2350, y: 2340, w: 25, h: 200 }
    ],
    decorations: [
      { type: 'stone_oven', x: 1550, y: 2060, w: 600, h: 120 },
      { type: 'flour_sacks', x: 800, y: 120, count: 12 },
      { type: 'wooden_crates', x: 2500, y: 2150, count: 8 },
      { type: 'table_prep', x: 1550, y: 1500, w: 300, h: 100 },
      { type: 'cafe_table', x: 2600, y: 1500 },
      { type: 'cafe_table', x: 2900, y: 1500 },
      { type: 'cafe_table', x: 2750, y: 1750 },
      { type: 'street_lamp', x: 1600, y: 300 },
      { type: 'street_lamp', x: 2400, y: 300 },
      { type: 'street_lamp', x: 3100, y: 300 },
      { type: 'street_lamp', x: 2000, y: 900 },
      { type: 'street_lamp', x: 2800, y: 900 },
      { type: 'bench', x: 1800, y: 320, w: 80, h: 26 },
      { type: 'bench', x: 2600, y: 320, w: 80, h: 26 },
      { type: 'garden_tree', x: 1600, y: 700, r: 55 },
      { type: 'garden_tree', x: 3000, y: 700, r: 55 },
      { type: 'garden_tree', x: 2300, y: 1100, r: 60 }
    ],
    tasks: [
      { id: 1, name: 'Moler Trigo Dorado', room: 'Molino Imperial', x: 360, y: 360, type: 'moler' },
      { id: 2, name: 'Ajustar Humedad del Grano', room: 'Granero Dorado', x: 1050, y: 360, type: 'temperatura' },
      { id: 3, name: 'Cultivar Levaduras Especiales', room: 'Cámara de Fermentación', x: 360, y: 1000, type: 'amasar' },
      { id: 4, name: 'Pulir Campana de Plata', room: 'Salón de la Campana', x: 700, y: 1500, type: 'limpiar' },
      { id: 5, name: 'Descorchar Cava Real', room: 'Cava de Levaduras', x: 360, y: 2260, type: 'mermelada' },
      { id: 6, name: 'Glasear Donas Reales', room: 'El Gran Obrador Real', x: 1860, y: 1650, type: 'donas' },
      { id: 7, name: 'Atizar Leña en Hornos', room: 'Cocina de Horneado', x: 1860, y: 2260, type: 'horno' },
      { id: 8, name: 'Servir Té Gourmet', room: 'Salón de Té', x: 2860, y: 1650, type: 'abanicar' },
      { id: 9, name: 'Estibar Cajas de Pan', room: 'Despacho Real', x: 2860, y: 2260, type: 'acomodar' },
      { id: 10, name: 'Revisar Farolas de Medianoche', room: 'Patio Exterior', x: 2400, y: 650, type: 'limpiar' }
    ]
  },

  'El Claustro del Monasterio': {
    width: 3300,
    height: 2500,
    emergency: { x: 1650, y: 1250 },
    exterior: 'dark_soil',
    spawns: [
      { x: 1650, y: 1120 }, { x: 1750, y: 1160 }, { x: 1780, y: 1250 },
      { x: 1750, y: 1340 }, { x: 1650, y: 1380 }, { x: 1550, y: 1340 },
      { x: 1520, y: 1250 }, { x: 1550, y: 1160 }, { x: 1690, y: 1200 },
      { x: 1610, y: 1200 }, { x: 1690, y: 1300 }, { x: 1610, y: 1300 }
    ],
    rooms: [
      { id: 'patio_central', name: 'El Gran Patio del Claustro', x: 1050, y: 750, w: 1200, h: 1000, floor: 'grass', label: 'EL GRAN PATIO MONACAL' },
      { id: 'galeria_norte', name: 'Galería Norte del Claustro', x: 1050, y: 610, w: 1200, h: 140, floor: 'stone', label: 'GALERÍA NORTE' },
      { id: 'galeria_sur', name: 'Galería Sur del Claustro', x: 1050, y: 1750, w: 1200, h: 140, floor: 'stone', label: 'GALERÍA SUR' },
      { id: 'galeria_oeste', name: 'Galería Oeste del Claustro', x: 910, y: 610, w: 140, h: 1280, floor: 'stone', label: 'GALERÍA OESTE' },
      { id: 'galeria_este', name: 'Galería Este del Claustro', x: 2250, y: 610, w: 140, h: 1280, floor: 'stone', label: 'GALERÍA ESTE' },
      { id: 'catedral', name: 'Catedral de la Espiga', x: 60, y: 60, w: 1540, h: 520, floor: 'marble', label: 'CATEDRAL DE LA ESPIGA' },
      { id: 'scriptorium', name: 'Scriptorium de Recetas', x: 1660, y: 60, w: 1580, h: 520, floor: 'wood_dark', label: 'SCRIPTORIUM DE RECETAS' },
      { id: 'granero', name: 'Granero de Cebada', x: 60, y: 640, w: 820, h: 580, floor: 'wood', label: 'GRANERO DE CEBADA' },
      { id: 'molino', name: 'Molino de Piedra Fluvial', x: 60, y: 1280, w: 820, h: 580, floor: 'stone', label: 'MOLINO FLUVIAL' },
      { id: 'refectorio', name: 'El Gran Refectorio', x: 60, y: 1920, w: 1540, h: 520, floor: 'wood_dark', label: 'GRAN REFECTORIO' },
      { id: 'despensa_fria', name: 'Cripta de Enfriamiento', x: 1660, y: 1920, w: 1580, h: 520, floor: 'tile_dark', label: 'CRIPTA DE ENFRIAMIENTO' },
      { id: 'cava', name: 'Cava de Vinos & Mermeladas', x: 2420, y: 640, w: 820, h: 580, floor: 'tile', label: 'CAVA DE VINO & MERMELADAS' },
      { id: 'hornos', name: 'Bóveda de Hornos de Leña', x: 2420, y: 1280, w: 820, h: 580, floor: 'stone', label: 'HORNOS DE LEÑA' }
    ],
    walls: [
      { x: 30, y: 30, w: 3240, h: 30 },
      { x: 30, y: 2440, w: 3240, h: 30 },
      { x: 30, y: 30, w: 30, h: 2440 },
      { x: 3240, y: 30, w: 30, h: 2440 },
      { x: 1050, y: 750, w: 450, h: 25 },
      { x: 1800, y: 750, w: 450, h: 25 },
      { x: 1050, y: 1750, w: 450, h: 25 },
      { x: 1800, y: 1750, w: 450, h: 25 },
      { x: 1050, y: 750, w: 25, h: 350 },
      { x: 1050, y: 1400, w: 25, h: 350 },
      { x: 2250, y: 750, w: 25, h: 350 },
      { x: 2250, y: 1400, w: 25, h: 350 },
      { x: 60, y: 580, w: 680, h: 25 },
      { x: 940, y: 580, w: 1400, h: 25 },
      { x: 2540, y: 580, w: 700, h: 25 },
      { x: 1600, y: 60, w: 25, h: 520 },
      { x: 60, y: 1890, w: 680, h: 25 },
      { x: 940, y: 1890, w: 1400, h: 25 },
      { x: 2540, y: 1890, w: 700, h: 25 },
      { x: 1600, y: 1920, w: 25, h: 520 },
      { x: 880, y: 640, w: 25, h: 180 },
      { x: 880, y: 1040, w: 25, h: 420 },
      { x: 880, y: 1680, w: 25, h: 180 },
      { x: 60, y: 1240, w: 820, h: 25 },
      { x: 2390, y: 640, w: 25, h: 180 },
      { x: 2390, y: 1040, w: 25, h: 420 },
      { x: 2390, y: 1680, w: 25, h: 180 },
      { x: 2420, y: 1240, w: 820, h: 25 }
    ],
    decorations: [
      { type: 'fountain', x: 1650, y: 1250, r: 85 },
      { type: 'garden_tree', x: 1200, y: 900, r: 55 },
      { type: 'garden_tree', x: 2100, y: 900, r: 55 },
      { type: 'garden_tree', x: 1200, y: 1600, r: 55 },
      { type: 'garden_tree', x: 2100, y: 1600, r: 55 },
      { type: 'bench', x: 1350, y: 1240, w: 80, h: 26 },
      { type: 'bench', x: 1870, y: 1240, w: 80, h: 26 },
      { type: 'stone_oven', x: 2550, y: 1340, w: 550, h: 120 },
      { type: 'flour_sacks', x: 150, y: 720, count: 12 },
      { type: 'shelves', x: 1800, y: 120, w: 400, h: 60 },
      { type: 'table_prep', x: 450, y: 2050, w: 320, h: 90 }
    ],
    tasks: [
      { id: 1, name: 'Tocar Campana de la Fuente', room: 'El Gran Patio', x: 1650, y: 1120, type: 'limpiar' },
      { id: 2, name: 'Encender Velas de la Espiga', room: 'Catedral de la Espiga', x: 800, y: 320, type: 'horno' },
      { id: 3, name: 'Catalogar Pergaminos', room: 'Scriptorium de Recetas', x: 2450, y: 320, type: 'acomodar' },
      { id: 4, name: 'Separar Grano de Cebada', room: 'Granero de Cebada', x: 470, y: 920, type: 'sacos' },
      { id: 5, name: 'Girar Rueda de Molino', room: 'Molino Fluvial', x: 470, y: 1570, type: 'moler' },
      { id: 6, name: 'Bendecir Hogazas del Refectorio', room: 'Gran Refectorio', x: 800, y: 2180, type: 'amasar' },
      { id: 7, name: 'Regular Ventilación de Cripta', room: 'Cripta de Enfriamiento', x: 2450, y: 2180, type: 'abanicar' },
      { id: 8, name: 'Embotellar Mermelada Monacal', room: 'Cava de Vinos', x: 2830, y: 920, type: 'mermelada' },
      { id: 9, name: 'Hornear Pan Bendito', room: 'Hornos de Leña', x: 2830, y: 1570, type: 'horno' },
      { id: 10, name: 'Recoger Hojas del Claustro', room: 'Galería Norte', x: 1650, y: 680, type: 'limpiar' }
    ]
  },

  'La Rotonda de Cristal': {
    width: 3200,
    height: 2600,
    emergency: { x: 1600, y: 1300 },
    exterior: 'night_sky',
    spawns: [
      { x: 1600, y: 1180 }, { x: 1700, y: 1220 }, { x: 1720, y: 1300 },
      { x: 1700, y: 1380 }, { x: 1600, y: 1420 }, { x: 1500, y: 1380 },
      { x: 1480, y: 1300 }, { x: 1500, y: 1220 }, { x: 1650, y: 1250 },
      { x: 1550, y: 1250 }, { x: 1650, y: 1350 }, { x: 1550, y: 1350 }
    ],
    rooms: [
      { id: 'rotonda', name: 'La Gran Rotonda de Cristal', x: 1100, y: 800, w: 1000, h: 1000, floor: 'marble_circle', label: 'LA GRAN ROTONDA' },
      { id: 'cupula_norte', name: 'Cúpula de Esculturas de Azúcar', x: 1100, y: 60, w: 1000, h: 710, floor: 'marble', label: 'CÚPULA DE AZÚCAR' },
      { id: 'camara_sur', name: 'Cámara de Chocolate & Calderas', x: 1100, y: 1830, w: 1000, h: 710, floor: 'tile_dark', label: 'CÁMARA DE CHOCOLATE' },
      { id: 'laboratorio_oeste', name: 'Laboratorio de Masa Madre', x: 60, y: 800, w: 1010, h: 1000, floor: 'tile_pink', label: 'LABORATORIO DE MASAS' },
      { id: 'galeria_este', name: 'Salón de Degustación & Té', x: 2130, y: 800, w: 1010, h: 1000, floor: 'wood', label: 'ALTA REPOSTERÍA' },
      { id: 'atrio_nw', name: 'Atrio Noroeste', x: 260, y: 180, w: 810, h: 590, floor: 'stone', label: 'ATRIO NOROESTE' },
      { id: 'atrio_ne', name: 'Atrio Noreste', x: 2130, y: 180, w: 810, h: 590, floor: 'stone', label: 'ATRIO NORESTE' },
      { id: 'atrio_sw', name: 'Bóveda Suroeste', x: 260, y: 1830, w: 810, h: 590, floor: 'metal', label: 'BÓVEDA SUROESTE' },
      { id: 'atrio_se', name: 'Muelle Sureste', x: 2130, y: 1830, w: 810, h: 590, floor: 'wood_dark', label: 'MUELLE SURESTE' }
    ],
    walls: [
      { x: 30, y: 30, w: 3140, h: 30 },
      { x: 30, y: 2540, w: 3140, h: 30 },
      { x: 30, y: 30, w: 30, h: 2540 },
      { x: 3140, y: 30, w: 30, h: 2540 },
      { x: 1100, y: 770, w: 360, h: 25 },
      { x: 1740, y: 770, w: 360, h: 25 },
      { x: 1100, y: 1800, w: 360, h: 25 },
      { x: 1740, y: 1800, w: 360, h: 25 },
      { x: 1070, y: 800, w: 25, h: 360 },
      { x: 1070, y: 1440, w: 25, h: 360 },
      { x: 2100, y: 800, w: 25, h: 360 },
      { x: 2100, y: 1440, w: 25, h: 360 },
      { x: 260, y: 770, w: 280, h: 25 },
      { x: 740, y: 770, w: 330, h: 25 },
      { x: 2130, y: 770, w: 330, h: 25 },
      { x: 2660, y: 770, w: 280, h: 25 },
      { x: 260, y: 1800, w: 280, h: 25 },
      { x: 740, y: 1800, w: 330, h: 25 },
      { x: 2130, y: 1800, w: 330, h: 25 },
      { x: 2660, y: 1800, w: 280, h: 25 }
    ],
    decorations: [
      { type: 'rotunda_dome', x: 1600, y: 1300, r: 420 },
      { type: 'crystal_table', x: 1400, y: 350, w: 400, h: 90 },
      { type: 'crystal_table', x: 2450, y: 1250, w: 320, h: 90 },
      { type: 'glass_showcase', x: 2350, y: 350, w: 350, h: 80 },
      { type: 'bread_rack', x: 2750, y: 1400, w: 80, h: 250 },
      { type: 'cafe_table', x: 1350, y: 1100 },
      { type: 'cafe_table', x: 1850, y: 1100 },
      { type: 'cafe_table', x: 1350, y: 1500 },
      { type: 'cafe_table', x: 1850, y: 1500 }
    ],
    tasks: [
      { id: 1, name: 'Lustrar Campana de Cristal', room: 'Gran Rotonda', x: 1600, y: 1180, type: 'limpiar' },
      { id: 2, name: 'Modelar Cisne de Azúcar', room: 'Cúpula de Azúcar', x: 1600, y: 420, type: 'donas' },
      { id: 3, name: 'Mezclar Chocolate Fundido', room: 'Cámara de Chocolate', x: 1600, y: 2180, type: 'amasar' },
      { id: 4, name: 'Calibrar pH de Masa Madre', room: 'Laboratorio de Masas', x: 560, y: 1300, type: 'temperatura' },
      { id: 5, name: 'Acomodar Macarons Gourmet', room: 'Alta Repostería', x: 2630, y: 1300, type: 'acomodar' },
      { id: 6, name: 'Recibir Cajas de Vainilla', room: 'Atrio Noroeste', x: 660, y: 470, type: 'sacos' },
      { id: 7, name: 'Limpiar Vitrinas de Cristal', room: 'Atrio Noreste', x: 2530, y: 470, type: 'limpiar' },
      { id: 8, name: 'Enfriar Merengues', room: 'Bóveda Suroeste', x: 660, y: 2120, type: 'abanicar' },
      { id: 9, name: 'Envolver Pasteles para Envío', room: 'Muelle Sureste', x: 2530, y: 2120, type: 'acomodar' },
      { id: 10, name: 'Calentar Baño María', room: 'Cámara de Chocolate', x: 1350, y: 2200, type: 'horno' }
    ]
  },

  'La Fábrica en U': {
    width: 3400,
    height: 2600,
    emergency: { x: 1700, y: 1550 },
    exterior: 'industrial_dark',
    spawns: [
      { x: 1700, y: 1420 }, { x: 1780, y: 1470 }, { x: 1820, y: 1550 },
      { x: 1780, y: 1630 }, { x: 1700, y: 1680 }, { x: 1620, y: 1630 },
      { x: 1580, y: 1550 }, { x: 1620, y: 1470 }, { x: 1740, y: 1500 },
      { x: 1660, y: 1500 }, { x: 1740, y: 1600 }, { x: 1660, y: 1600 }
    ],
    rooms: [
      { id: 'bahia_central', name: 'Bahía de Maniobras al Aire Libre', x: 1180, y: 650, w: 1040, h: 1870, floor: 'asphalt', label: 'BAHÍA INDUSTRIAL EXTERIOR' },
      { id: 'puente_cintas', name: 'Puente Aéreo de Cintas', x: 1100, y: 60, w: 1200, h: 560, floor: 'metal', label: 'PUENTE AÉREO DE CINTAS' },
      { id: 'generadores', name: 'Generadores Eléctricos', x: 60, y: 60, w: 1010, h: 720, floor: 'caution', label: 'GENERADORES ELÉCTRICOS' },
      { id: 'mezcladoras', name: 'Mezcladoras Industriales', x: 60, y: 810, w: 1010, h: 790, floor: 'metal', label: 'MEZCLADORAS PESADAS' },
      { id: 'horno_tunel', name: 'Hornos de Túnel Continuo', x: 60, y: 1630, w: 1010, h: 890, floor: 'stone', label: 'HORNOS DE TÚNEL' },
      { id: 'control', name: 'Centro de Control Automatizado', x: 2330, y: 60, w: 1010, h: 720, floor: 'tile', label: 'CENTRO DE CONTROL' },
      { id: 'robotica', name: 'Línea Robótica de Envasado', x: 2330, y: 810, w: 1010, h: 790, floor: 'metal', label: 'LÍNEA ROBÓTICA' },
      { id: 'almacen', name: 'Almacén de Palets & Cajas', x: 2330, y: 1630, w: 1010, h: 890, floor: 'wood_dark', label: 'ALMACÉN & PALETS' }
    ],
    walls: [
      { x: 30, y: 30, w: 3340, h: 30 },
      { x: 30, y: 2540, w: 3340, h: 30 },
      { x: 30, y: 30, w: 30, h: 2540 },
      { x: 3340, y: 30, w: 30, h: 2540 },
      { x: 1070, y: 60, w: 25, h: 420 },
      { x: 1070, y: 680, w: 25, h: 440 },
      { x: 1070, y: 1340, w: 25, h: 580 },
      { x: 1070, y: 2140, w: 25, h: 400 },
      { x: 2300, y: 60, w: 25, h: 420 },
      { x: 2300, y: 680, w: 25, h: 440 },
      { x: 2300, y: 1340, w: 25, h: 580 },
      { x: 2300, y: 2140, w: 25, h: 400 },
      { x: 1100, y: 620, w: 420, h: 25 },
      { x: 1880, y: 620, w: 420, h: 25 },
      { x: 60, y: 780, w: 1010, h: 25 },
      { x: 60, y: 1600, w: 1010, h: 25 },
      { x: 2330, y: 780, w: 1010, h: 25 },
      { x: 2330, y: 1600, w: 1010, h: 25 }
    ],
    decorations: [
      { type: 'conveyor_belt', x: 1250, y: 220, w: 900, h: 80 },
      { type: 'conveyor_belt', x: 200, y: 1150, w: 700, h: 70 },
      { type: 'silo', x: 1400, y: 900, r: 75 },
      { type: 'silo', x: 2000, y: 900, r: 75 },
      { type: 'silo', x: 1400, y: 2200, r: 75 },
      { type: 'silo', x: 2000, y: 2200, r: 75 },
      { type: 'wooden_crates', x: 2500, y: 1800, count: 12 },
      { type: 'table_prep', x: 400, y: 250, w: 320, h: 80 },
      { type: 'table_prep', x: 2650, y: 250, w: 320, h: 80 }
    ],
    tasks: [
      { id: 1, name: 'Calibrar Sirena de la Bahía', room: 'Bahía Industrial', x: 1700, y: 1420, type: 'limpiar' },
      { id: 2, name: 'Arrancar Generador Diesel', room: 'Generadores Eléctricos', x: 560, y: 420, type: 'temperatura' },
      { id: 3, name: 'Lubricar Rodillos de la Cinta', room: 'Puente de Cintas', x: 1700, y: 340, type: 'limpiar' },
      { id: 4, name: 'Desatascar Tolva de Mezclado', room: 'Mezcladoras Pesadas', x: 560, y: 1200, type: 'moler' },
      { id: 5, name: 'Calibrar Temperatura del Túnel', room: 'Hornos de Túnel', x: 560, y: 2070, type: 'temperatura' },
      { id: 6, name: 'Reiniciar Servidores de Control', room: 'Centro de Control', x: 2830, y: 420, type: 'acomodar' },
      { id: 7, name: 'Recargar Bolsas de Empaque', room: 'Línea Robótica', x: 2830, y: 1200, type: 'sacos' },
      { id: 8, name: 'Flejar Palets de Cajas', room: 'Almacén de Palets', x: 2830, y: 2070, type: 'acomodar' },
      { id: 9, name: 'Presurizar Silo Exterior Norte', room: 'Bahía Industrial', x: 1400, y: 1100, type: 'sacos' },
      { id: 10, name: 'Activar Ventiladores Industriales', room: 'Bahía Industrial', x: 2000, y: 1800, type: 'abanicar' }
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
    exterior: room.map.exterior || 'night_sky',
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
      const mapKeys = ['La Mansión en L', 'El Claustro del Monasterio', 'La Rotonda de Cristal', 'La Fábrica en U'];
      const isRandom = config.map === 'random';
      const mapName = isRandom ? 'random' : (MAPS[config.map] ? config.map : 'La Mansión en L');
      const mapData = isRandom ? MAPS[mapKeys[Math.floor(Math.random() * mapKeys.length)]] : MAPS[mapName];

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

  // Selección de mapa aleatorio dinámico
  if (room.config.map === 'random') {
    const mapKeys = ['La Mansión en L', 'El Claustro del Monasterio', 'La Rotonda de Cristal', 'La Fábrica en U'];
    const chosenKey = mapKeys[Math.floor(Math.random() * mapKeys.length)];
    room.map = MAPS[chosenKey];
  }
  // Barajar tareas para variedad en cada partida
  room.map = {
    ...room.map,
    tasks: shuffle(room.map.tasks)
  };

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