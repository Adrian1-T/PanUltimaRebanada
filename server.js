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
    width: 2000,
    height: 1500,
    emergency: { x: 1000, y: 760 },
    spawns: [
      { x: 1000, y: 670 }, { x: 1080, y: 710 }, { x: 1090, y: 790 },
      { x: 1000, y: 850 }, { x: 910, y: 790 }, { x: 920, y: 710 },
      { x: 960, y: 680 }, { x: 1040, y: 680 }, { x: 960, y: 840 },
      { x: 1040, y: 840 }, { x: 880, y: 760 }, { x: 1120, y: 760 },
      { x: 860, y: 700 }, { x: 1140, y: 700 }, { x: 1000, y: 760 }
    ],
    rooms: [
      { id: 'cafeteria', name: 'Cafetería & Salón Principal', x: 670, y: 550, w: 660, h: 420, floor: 'wood', label: 'CAFETERÍA' },
      { id: 'horno', name: 'Gran Salón de Hornos', x: 670, y: 30, w: 660, h: 440, floor: 'stone', label: 'EL GRAN HORNO' },
      { id: 'cocina', name: 'Cocina & Amasadero', x: 30, y: 30, w: 540, h: 580, floor: 'tile', label: 'COCINA & AMASADO' },
      { id: 'despensa', name: 'Almacén de Harina & Silos', x: 30, y: 780, w: 540, h: 690, floor: 'rustic', label: 'DESPENSA' },
      { id: 'reposteria', name: 'Repostería & Glaseados', x: 1430, y: 30, w: 540, h: 580, floor: 'tile_pink', label: 'REPOSTERÍA' },
      { id: 'ventas', name: 'Mostrador & Vitrinas de Venta', x: 1430, y: 780, w: 540, h: 690, floor: 'wood_dark', label: 'RECEPCIÓN & VENTAS' },
      { id: 'enfriamiento', name: 'Cuarto de Enfriamiento & Limpieza', x: 670, y: 1050, w: 660, h: 420, floor: 'metal', label: 'ENFRIAMIENTO' }
    ],
    walls: [
      // Perímetro exterior
      { x: 0, y: 0, w: 2000, h: 30 },
      { x: 0, y: 1470, w: 2000, h: 30 },
      { x: 0, y: 0, w: 30, h: 1500 },
      { x: 1970, y: 0, w: 30, h: 1500 },

      // Cocina (NW)
      { x: 30, y: 610, w: 540, h: 25 },
      { x: 570, y: 30, w: 25, h: 250 },
      { x: 570, y: 400, w: 25, h: 235 }, // puerta y: 280-400

      // Despensa (SW)
      { x: 30, y: 780, w: 540, h: 25 },
      { x: 570, y: 780, w: 25, h: 140 },
      { x: 570, y: 1040, w: 25, h: 430 }, // puerta y: 920-1040

      // Repostería (NE)
      { x: 1430, y: 610, w: 540, h: 25 },
      { x: 1430, y: 30, w: 25, h: 250 },
      { x: 1430, y: 400, w: 25, h: 235 }, // puerta y: 280-400

      // Recepción (SE)
      { x: 1430, y: 780, w: 540, h: 25 },
      { x: 1430, y: 780, w: 25, h: 140 },
      { x: 1430, y: 1040, w: 25, h: 430 }, // puerta y: 920-1040

      // Cafetería Central
      { x: 670, y: 550, w: 25, h: 150 },
      { x: 670, y: 820, w: 25, h: 150 }, // puerta Oeste y: 700-820
      { x: 1330, y: 550, w: 25, h: 150 },
      { x: 1330, y: 820, w: 25, h: 150 }, // puerta Este y: 700-820
      { x: 670, y: 550, w: 270, h: 25 },
      { x: 1060, y: 550, w: 295, h: 25 }, // puerta Norte x: 940-1060
      { x: 670, y: 970, w: 270, h: 25 },
      { x: 1060, y: 970, w: 295, h: 25 }, // puerta Sur x: 940-1060

      // Gran Horno (Norte)
      { x: 670, y: 30, w: 25, h: 440 },
      { x: 1330, y: 30, w: 25, h: 440 },
      { x: 670, y: 470, w: 270, h: 25 },
      { x: 1060, y: 470, w: 295, h: 25 }, // puerta a pasillo

      // Enfriamiento (Sur)
      { x: 670, y: 1050, w: 25, h: 420 },
      { x: 1330, y: 1050, w: 25, h: 420 },
      { x: 670, y: 1050, w: 270, h: 25 },
      { x: 1060, y: 1050, w: 295, h: 25 }
    ],
    decorations: [
      // Hornos
      { type: 'oven_block', x: 800, y: 80, w: 400, h: 90, label: 'HORNO INDUSTRIAL' },
      { type: 'fire_logs', x: 720, y: 220, count: 5 },
      { type: 'fire_logs', x: 1240, y: 220, count: 5 },
      // Cocina
      { type: 'table_prep', x: 180, y: 180, w: 160, h: 90 },
      { type: 'flour_sacks', x: 80, y: 90, count: 6 },
      { type: 'table_prep', x: 180, y: 380, w: 160, h: 80 },
      // Despensa
      { type: 'shelves', x: 80, y: 830, w: 200, h: 50 },
      { type: 'flour_sacks', x: 100, y: 1100, count: 8 },
      { type: 'wooden_crates', x: 380, y: 1150, count: 4 },
      // Repostería
      { type: 'glass_showcase', x: 1540, y: 120, w: 260, h: 70 },
      { type: 'donut_stand', x: 1820, y: 340 },
      // Recepción
      { type: 'checkout_counter', x: 1540, y: 840, w: 260, h: 60 },
      { type: 'bread_rack', x: 1820, y: 1100, w: 60, h: 160 },
      // Cafetería
      { type: 'cafe_table', x: 820, y: 640 },
      { type: 'cafe_table', x: 1180, y: 640 },
      { type: 'cafe_table', x: 820, y: 880 },
      { type: 'cafe_table', x: 1180, y: 880 },
      // Enfriamiento
      { type: 'cooling_racks', x: 800, y: 1200, w: 140, h: 70 },
      { type: 'fan_vent', x: 1180, y: 1200 }
    ],
    tasks: [
      { id: 1, name: 'Amasar la Masa', room: 'Cocina', x: 260, y: 230, type: 'amasar' },
      { id: 2, name: 'Moler Trigo', room: 'Cocina', x: 180, y: 440, type: 'moler' },
      { id: 3, name: 'Meter Panes al Horno', room: 'Hornos', x: 1000, y: 190, type: 'horno' },
      { id: 4, name: 'Ajustar Temperatura', room: 'Hornos', x: 1220, y: 270, type: 'temperatura' },
      { id: 5, name: 'Decorar Donas', room: 'Repostería', x: 1720, y: 220, type: 'donas' },
      { id: 6, name: 'Acomodar Panes', room: 'Repostería', x: 1680, y: 460, type: 'acomodar' },
      { id: 7, name: 'Ordenar Sacos', room: 'Despensa', x: 220, y: 980, type: 'sacos' },
      { id: 8, name: 'Vaciar Mermelada', room: 'Despensa', x: 450, y: 1280, type: 'mermelada' },
      { id: 9, name: 'Limpiar Migajas', room: 'Recepción', x: 1620, y: 980, type: 'limpiar' },
      { id: 10, name: 'Enfriar Baguettes', room: 'Enfriamiento', x: 1000, y: 1280, type: 'abanicar' }
    ]
  },

  'La Masadería': {
    width: 2200,
    height: 1600,
    emergency: { x: 1100, y: 800 },
    spawns: [
      { x: 1100, y: 700 }, { x: 1180, y: 750 }, { x: 1190, y: 830 },
      { x: 1100, y: 890 }, { x: 1010, y: 830 }, { x: 1020, y: 750 },
      { x: 1060, y: 710 }, { x: 1140, y: 710 }, { x: 1060, y: 880 },
      { x: 1140, y: 880 }, { x: 970, y: 800 }, { x: 1230, y: 800 },
      { x: 950, y: 740 }, { x: 1250, y: 740 }, { x: 1100, y: 800 }
    ],
    rooms: [
      { id: 'salon', name: 'Salón Rústico de Catas', x: 770, y: 580, w: 660, h: 440, floor: 'rustic', label: 'LA GRAN MESA' },
      { id: 'horno_artesanal', name: 'Horno de Piedra Tradicional', x: 770, y: 30, w: 660, h: 450, floor: 'stone', label: 'HORNO DE PIEDRA' },
      { id: 'fermentacion', name: 'Cámara de Fermentación', x: 30, y: 30, w: 600, h: 620, floor: 'tile_dark', label: 'FERMENTACIÓN' },
      { id: 'bodega', name: 'Bodega de Semillas y Levadura', x: 30, y: 820, w: 600, h: 750, floor: 'rustic', label: 'BODEGA DE LEVADURA' },
      { id: 'pasteleria', name: 'Taller de Confitería', x: 1570, y: 30, w: 600, h: 620, floor: 'tile_pink', label: 'CONFITERÍA' },
      { id: 'envasado', name: 'Despacho & Envasado de Pan', x: 1570, y: 820, w: 600, h: 750, floor: 'wood', label: 'DESPACHO' },
      { id: 'lavanderia', name: 'Taller de Limpieza & Utensilios', x: 770, y: 1120, w: 660, h: 450, floor: 'metal', label: 'LIMPIEZA' }
    ],
    walls: [
      // Perímetro exterior
      { x: 0, y: 0, w: 2200, h: 30 },
      { x: 0, y: 1570, w: 2200, h: 30 },
      { x: 0, y: 0, w: 30, h: 1600 },
      { x: 2170, y: 0, w: 30, h: 1600 },

      // Fermentación (NW)
      { x: 30, y: 650, w: 600, h: 25 },
      { x: 630, y: 30, w: 25, h: 280 },
      { x: 630, y: 430, w: 25, h: 245 },

      // Bodega (SW)
      { x: 30, y: 820, w: 600, h: 25 },
      { x: 630, y: 820, w: 25, h: 160 },
      { x: 630, y: 1100, w: 25, h: 470 },

      // Confitería (NE)
      { x: 1570, y: 650, w: 600, h: 25 },
      { x: 1570, y: 30, w: 25, h: 280 },
      { x: 1570, y: 430, w: 25, h: 245 },

      // Envasado (SE)
      { x: 1570, y: 820, w: 600, h: 25 },
      { x: 1570, y: 820, w: 25, h: 160 },
      { x: 1570, y: 1100, w: 25, h: 470 },

      // Salón Central
      { x: 770, y: 580, w: 25, h: 160 },
      { x: 770, y: 860, w: 25, h: 160 },
      { x: 1430, y: 580, w: 25, h: 160 },
      { x: 1430, y: 860, w: 25, h: 160 },
      { x: 770, y: 580, w: 270, h: 25 },
      { x: 1160, y: 580, w: 295, h: 25 },
      { x: 770, y: 1020, w: 270, h: 25 },
      { x: 1160, y: 1020, w: 295, h: 25 },

      // Horno Artesanal (N)
      { x: 770, y: 30, w: 25, h: 450 },
      { x: 1430, y: 30, w: 25, h: 450 },
      { x: 770, y: 480, w: 270, h: 25 },
      { x: 1160, y: 480, w: 295, h: 25 },

      // Limpieza (S)
      { x: 770, y: 1120, w: 25, h: 450 },
      { x: 1430, y: 1120, w: 25, h: 450 },
      { x: 770, y: 1120, w: 270, h: 25 },
      { x: 1160, y: 1120, w: 295, h: 25 }
    ],
    decorations: [
      { type: 'stone_oven', x: 920, y: 80, w: 360, h: 110 },
      { type: 'flour_sacks', x: 120, y: 120, count: 8 },
      { type: 'table_prep', x: 260, y: 260, w: 180, h: 90 },
      { type: 'wooden_crates', x: 120, y: 920, count: 6 },
      { type: 'shelves', x: 380, y: 860, w: 200, h: 50 },
      { type: 'glass_showcase', x: 1680, y: 140, w: 260, h: 80 },
      { type: 'checkout_counter', x: 1680, y: 900, w: 260, h: 70 },
      { type: 'bread_rack', x: 1980, y: 1150, w: 70, h: 180 },
      { type: 'cafe_table', x: 920, y: 680 },
      { type: 'cafe_table', x: 1280, y: 680 },
      { type: 'cafe_table', x: 920, y: 920 },
      { type: 'cafe_table', x: 1280, y: 920 }
    ],
    tasks: [
      { id: 1, name: 'Amasar la Masa', room: 'Fermentación', x: 300, y: 260, type: 'amasar' },
      { id: 2, name: 'Moler Trigo', room: 'Fermentación', x: 200, y: 480, type: 'moler' },
      { id: 3, name: 'Meter Panes al Horno', room: 'Horno de Piedra', x: 1100, y: 200, type: 'horno' },
      { id: 4, name: 'Ajustar Temperatura', room: 'Horno de Piedra', x: 1320, y: 300, type: 'temperatura' },
      { id: 5, name: 'Decorar Donas', room: 'Confitería', x: 1860, y: 240, type: 'donas' },
      { id: 6, name: 'Acomodar Panes', room: 'Confitería', x: 1820, y: 500, type: 'acomodar' },
      { id: 7, name: 'Ordenar Sacos', room: 'Bodega', x: 240, y: 1040, type: 'sacos' },
      { id: 8, name: 'Vaciar Mermelada', room: 'Bodega', x: 500, y: 1360, type: 'mermelada' },
      { id: 9, name: 'Limpiar Migajas', room: 'Limpieza', x: 920, y: 1340, type: 'limpiar' },
      { id: 10, name: 'Enfriar Baguettes', room: 'Despacho', x: 1860, y: 1060, type: 'abanicar' }
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