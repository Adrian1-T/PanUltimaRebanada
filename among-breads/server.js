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

// CORS totalmente abierto para permitir conexiones desde cualquier dominio
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

const BREAD_SKINS = ['baguette', 'bolillo', 'donut', 'concha', 'mohoso', 'quemado'];
const HATS = ['none', 'chef', 'butter', 'candle'];
const FACES = ['none', 'sunglasses', 'mustache', 'monocle'];

// Mapa de posiciones iniciales por mapa
const MAPS = {
  'El Horno Central': {
    width: 2000,
    height: 1500,
    spawns: [
      { x: 400, y: 400 }, { x: 1600, y: 400 },
      { x: 400, y: 1100 }, { x: 1600, y: 1100 },
      { x: 1000, y: 750 }, { x: 700, y: 750 },
      { x: 1300, y: 750 }, { x: 1000, y: 400 },
      { x: 1000, y: 1100 }, { x: 300, y: 750 },
      { x: 1700, y: 750 }, { x: 700, y: 200 },
      { x: 1300, y: 200 }, { x: 700, y: 1300 },
      { x: 1300, y: 1300 }
    ],
    tasks: [
      { id: 1, name: 'Amasar la Masa', x: 300, y: 300, type: 'amasar' },
      { id: 2, name: 'Acomodar Panes', x: 1700, y: 300, type: 'acomodar' },
      { id: 3, name: 'Limpiar Migajas', x: 300, y: 1200, type: 'limpiar' },
      { id: 4, name: 'Meter Panes al Horno', x: 1700, y: 1200, type: 'horno' },
      { id: 5, name: 'Decorar Donas', x: 1000, y: 200, type: 'donas' },
      { id: 6, name: 'Ajustar Temperatura', x: 1000, y: 1300, type: 'temperatura' },
      { id: 7, name: 'Moler Trigo', x: 200, y: 750, type: 'moler' },
      { id: 8, name: 'Ordenar Sacos', x: 1800, y: 750, type: 'sacos' },
      { id: 9, name: 'Enfriar Baguettes', x: 1000, y: 750, type: 'abanicar' },
      { id: 10, name: 'Vaciar Mermelada', x: 500, y: 1000, type: 'mermelada' }
    ],
    emergency: { x: 1000, y: 750 }
  },
  'La Masadería': {
    width: 2200,
    height: 1600,
    spawns: [
      { x: 300, y: 300 }, { x: 1900, y: 300 },
      { x: 300, y: 1300 }, { x: 1900, y: 1300 },
      { x: 1100, y: 800 }, { x: 800, y: 800 },
      { x: 1400, y: 800 }, { x: 1100, y: 400 },
      { x: 1100, y: 1200 }, { x: 400, y: 800 },
      { x: 1800, y: 800 }, { x: 800, y: 200 },
      { x: 1400, y: 200 }, { x: 800, y: 1400 },
      { x: 1400, y: 1400 }
    ],
    tasks: [
      { id: 1, name: 'Amasar la Masa', x: 250, y: 250, type: 'amasar' },
      { id: 2, name: 'Acomodar Panes', x: 1950, y: 250, type: 'acomodar' },
      { id: 3, name: 'Limpiar Migajas', x: 250, y: 1350, type: 'limpiar' },
      { id: 4, name: 'Meter Panes al Horno', x: 1950, y: 1350, type: 'horno' },
      { id: 5, name: 'Decorar Donas', x: 1100, y: 150, type: 'donas' },
      { id: 6, name: 'Ajustar Temperatura', x: 1100, y: 1450, type: 'temperatura' },
      { id: 7, name: 'Moler Trigo', x: 150, y: 800, type: 'moler' },
      { id: 8, name: 'Ordenar Sacos', x: 2050, y: 800, type: 'sacos' },
      { id: 9, name: 'Enfriar Baguettes', x: 1100, y: 800, type: 'abanicar' },
      { id: 10, name: 'Vaciar Mermelada', x: 600, y: 1100, type: 'mermelada' }
    ],
    emergency: { x: 1100, y: 800 }
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
          maxPlayers: Math.min(15, Math.max(4, config.maxPlayers || 8)),
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

      cb({ ok: true, code, player: sanitizePlayer(player), config: room.config });
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

      // Notificar a todos
      io.to(code).emit('lobby_update', {
        players: Array.from(room.players.values()).map(sanitizePlayer),
        hostId: room.hostId,
        config: room.config
      });

      cb({ ok: true, code, player: sanitizePlayer(player), config: room.config });
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
    io.to(code).emit('lobby_update', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config
    });
  });

  // -------- INICIAR PARTIDA --------
  socket.on('start_game', () => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    if (room.players.size < 4) {
      socket.emit('error_msg', 'Se necesitan al menos 4 jugadores');
      return;
    }
    startGame(room);
  });

  // -------- MOVIMIENTO --------
  socket.on('move', (data) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    // Validación básica anti-cheat
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
    const maxDist = 60; // por tick
    const dx = data.x - p.x;
    const dy = data.y - p.y;
    if (Math.hypot(dx, dy) > maxDist) return;
    p.x = data.x;
    p.y = data.y;
    p.dir = data.dir || p.dir;
    p.moving = data.moving !== false;
    p.animTime = (p.animTime || 0) + 1;
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
    if (dist > 80) return;

    target.alive = false;
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
    const dist = Math.hypot(reporter.x - target.deathX, reporter.y - target.deathY);
    if (dist > 120) return;

    startVoting(room, socket.id, target.name);
  });

  // -------- EMERGENCIA --------
  socket.on('emergency', () => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    const e = room.map.emergency;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    if (dist > 150) return;
    startVoting(room, socket.id, 'EMERGENCIA');
  });

  // -------- VOTAR --------
  socket.on('vote', ({ targetId }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'voting') return;
    const voter = room.players.get(socket.id);
    if (!voter || !voter.alive) return;
    if (room.votes[socket.id]) return;
    room.votes[socket.id] = targetId;

    io.to(code).emit('vote_update', {
      votes: room.votes,
      voters: Object.keys(room.votes)
    });

    // Si todos votaron, terminar
    const aliveVoters = Array.from(room.players.values()).filter(p => p.alive);
    if (Object.keys(room.votes).length >= aliveVoters.length) {
      finishVoting(room);
    }
  });

  // -------- CHAT --------
  socket.on('chat', ({ msg }) => {
    const code = socketToRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    const message = {
      name: p.name,
      msg: String(msg).slice(0, 200),
      ts: Date.now(),
      color: p.color
    };
    room.chat.push(message);
    if (room.chat.length > 100) room.chat.shift();
    io.to(code).emit('chat', message);
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
    if (p.skin !== 'mohoso') return; // solo Pan Infeccioso
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
      rooms.delete(code);
      console.log(`🗑️ Sala eliminada: ${code}`);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }

    io.to(code).emit('player_left', { playerId: socket.id });
    io.to(code).emit('lobby_update', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config
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
  return {
    id,
    name: (profile.name || `Pan${idx + 1}`).slice(0, 12),
    skin: BREAD_SKINS.includes(profile.skin) ? profile.skin : BREAD_SKINS[idx % BREAD_SKINS.length],
    hat: HATS.includes(profile.hat) ? profile.hat : 'none',
    face: FACES.includes(profile.face) ? profile.face : 'none',
    color: colors[idx % colors.length],
    x: room.map.spawns[idx % room.map.spawns.length].x,
    y: room.map.spawns[idx % room.map.spawns.length].y,
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
    moving: p.moving,
    animTime: p.animTime
  };
}

function startGame(room) {
  room.state = 'playing';
  room.votes = {};
  room.chat = [];

  const playerIds = Array.from(room.players.keys());
  const shuffled = shuffle(playerIds);
  const impostorCount = Math.min(room.config.impostors, Math.floor(playerIds.length / 3) || 1);
  const impostorIds = shuffled.slice(0, impostorCount);

  // Asignar posiciones iniciales y resetear
  let spawnIdx = 0;
  const spawns = shuffle(room.map.spawns);
  for (const [id, p] of room.players) {
    p.alive = true;
    p.isGhost = false;
    p.isImpostor = impostorIds.includes(id);
    p.completedTasks = [];
    p.invisible = false;
    p.lastKill = 0;
    p.x = spawns[spawnIdx % spawns.length].x;
    p.y = spawns[spawnIdx % spawns.length].y;
    spawnIdx++;

    // Rol específico
    if (p.isImpostor) {
      p.role = p.skin === 'mohoso' ? 'Pan Infeccioso' : 'Impostor Básico';
    } else {
      p.role = Math.random() < 0.3 ? 'Maestro Harinero' : 'Panadero Estándar';
    }

    // Enviar rol privado
    io.to(id).emit('role_assigned', {
      role: p.role,
      isImpostor: p.isImpostor,
      impostorIds: p.isImpostor ? impostorIds : [],
      tasks: p.isImpostor ? [] : room.map.tasks.slice(0, room.config.taskCount)
    });
  }

  io.to(room.code).emit('game_started', {
    config: room.config,
    map: {
      width: room.map.width,
      height: room.map.height,
      tasks: room.map.tasks.slice(0, room.config.taskCount),
      emergency: room.map.emergency
    },
    players: Array.from(room.players.values()).map(sanitizePlayer)
  });

  console.log(`🎮 Partida iniciada en ${room.code} (${impostorCount} impostores)`);
}

function startVoting(room, reporterId, reportedName) {
  if (room.state !== 'playing') return;
  room.state = 'voting';
  room.votes = {};

  io.to(room.code).emit('voting_started', {
    reporterId,
    reportedName,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      alive: p.alive,
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
  clearTimeout(room.votingTimer);

  // Contar votos
  const counts = {};
  for (const target of Object.values(room.votes)) {
    counts[target] = (counts[target] || 0) + 1;
  }

  let maxVotes = 0;
  let ejected = null;
  let tie = false;
  for (const [id, c] of Object.entries(counts)) {
    if (c > maxVotes) { maxVotes = c; ejected = id; tie = false; }
    else if (c === maxVotes) { tie = true; }
  }
  if (tie || maxVotes === 0) ejected = null;

  if (ejected && ejected !== 'skip') {
    const p = room.players.get(ejected);
    if (p) {
      p.alive = false;
      p.isGhost = true;
    }
  }

  io.to(room.code).emit('voting_result', {
    ejectedId: ejected,
    ejectedName: ejected && room.players.get(ejected) ? room.players.get(ejected).name : null,
    wasImpostor: ejected && room.players.get(ejected) ? room.players.get(ejected).isImpostor : false,
    votes: room.votes
  });

  // Reset
  room.votes = {};
  setTimeout(() => {
    if (rooms.has(room.code) && room.state === 'voting') {
      room.state = 'playing';
      checkWinCondition(room);
    }
  }, 5000);
}

function checkWinCondition(room) {
  if (room.state === 'ended') return;

  const alive = Array.from(room.players.values()).filter(p => p.alive);
  const aliveImpostors = alive.filter(p => p.isImpostor);
  const aliveCrew = alive.filter(p => !p.isImpostor);

  // Victoria impostores
  if (aliveImpostors.length > 0 && aliveImpostors.length >= aliveCrew.length) {
    endGame(room, 'impostors');
    return;
  }
  // Victoria tripulantes
  if (aliveImpostors.length === 0) {
    endGame(room, 'crewmates');
    return;
  }
  // Victoria por misiones
  const totalTasks = Array.from(room.players.values())
    .filter(p => !p.isImpostor)
    .reduce((sum) => sum + room.config.taskCount, 0);
  const completedTasks = Array.from(room.players.values())
    .filter(p => !p.isImpostor)
    .reduce((sum, p) => sum + p.completedTasks.length, 0);
  if (completedTasks >= totalTasks) {
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
      p.role = 'panadero';
    }
    io.to(room.code).emit('back_to_lobby', {
      players: Array.from(room.players.values()).map(sanitizePlayer),
      hostId: room.hostId,
      config: room.config
    });
  }, 8000);
}

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🍞 Among Breads Server corriendo en puerto ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});