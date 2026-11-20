// Mensajes directos entre cuentas. La tabla es compartida con B-Personal,
// por eso un adoptante y un publicador conversan aunque usen portales distintos.
const { query } = require('../config/database');

const MENSAJE_COLUMNS = 'id, remitente_id, destinatario_id, mascota_id, contenido, leido, created_at';
const MAX_CONTENIDO = 2000;
const byId = (a, b) => Number(a.id) - Number(b.id);
const publicUser = (row) => ({ id: Number(row.id), nombre: row.nombre, rol: row.rol });

async function findUsuario(id) {
  const result = await query('SELECT id, nombre, rol FROM usuarios WHERE id = $1', [id]);
  return result.rows?.[0] ? publicUser(result.rows[0]) : null;
}

async function mensajesDe(userId) {
  const [enviados, recibidos] = await Promise.all([
    query(`SELECT ${MENSAJE_COLUMNS} FROM mensajes WHERE remitente_id = $1`, [userId]),
    query(`SELECT ${MENSAJE_COLUMNS} FROM mensajes WHERE destinatario_id = $1`, [userId]),
  ]);
  return [...enviados.rows, ...recibidos.rows].sort(byId);
}

// Agrupa los mensajes por la otra cuenta y resume cada conversación.
function buildConversaciones(mensajes, userId, usuarios) {
  const conversaciones = new Map();
  for (const mensaje of mensajes) {
    const propio = String(mensaje.remitente_id) === String(userId);
    const otroId = String(propio ? mensaje.destinatario_id : mensaje.remitente_id);
    const actual = conversaciones.get(otroId) || { usuario: usuarios.get(otroId), no_leidos: 0 };
    actual.ultimo_mensaje = mensaje;
    if (!propio && !mensaje.leido) actual.no_leidos += 1;
    conversaciones.set(otroId, actual);
  }
  return [...conversaciones.values()]
    .filter((item) => item.usuario)
    .sort((a, b) => byId(b.ultimo_mensaje, a.ultimo_mensaje));
}

async function listConversaciones(userId) {
  const [mensajes, usuarios] = await Promise.all([
    mensajesDe(userId),
    query('SELECT id, nombre, rol FROM usuarios'),
  ]);
  const usuariosMap = new Map(usuarios.rows.map((row) => [String(row.id), publicUser(row)]));
  return buildConversaciones(mensajes, userId, usuariosMap);
}

async function getConversacion(userId, otroId) {
  const filter = 'WHERE remitente_id = $1 AND destinatario_id = $2';
  const [enviados, recibidos] = await Promise.all([
    query(`SELECT ${MENSAJE_COLUMNS} FROM mensajes ${filter}`, [userId, otroId]),
    query(`SELECT ${MENSAJE_COLUMNS} FROM mensajes ${filter}`, [otroId, userId]),
  ]);
  return [...enviados.rows, ...recibidos.rows].sort(byId);
}

async function marcarLeidos(userId, otroId) {
  const result = await query(
    'UPDATE mensajes SET leido = $1 WHERE remitente_id = $2 AND destinatario_id = $3 RETURNING id',
    [true, otroId, userId],
  );
  return result.rows.length;
}

async function crearMensaje({ remitenteId, destinatarioId, mascotaId, contenido }) {
  const result = await query(
    `INSERT INTO mensajes (remitente_id, destinatario_id, mascota_id, contenido, leido) VALUES ($1, $2, $3, $4, $5) RETURNING ${MENSAJE_COLUMNS}`,
    [remitenteId, destinatarioId, mascotaId, contenido, false],
  );
  return result.rows[0];
}

module.exports = {
  MAX_CONTENIDO,
  findUsuario,
  buildConversaciones,
  listConversaciones,
  getConversacion,
  marcarLeidos,
  crearMensaje,
};
