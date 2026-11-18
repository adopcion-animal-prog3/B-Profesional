// Reglas de negocio de solicitudes para el portal profesional.
const { query } = require('../config/database');

const SOLICITUD_COLUMNS = 'id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at';
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// Una cuenta profesional gestiona las mascotas que publicó (o las que no tienen publicador).
const ownsMascota = (mascota, user) => Boolean(mascota) && (mascota.creado_por == null || sameId(mascota.creado_por, user.id));

async function loadLookups() {
  const [mascotas, usuarios] = await Promise.all([
    query('SELECT id, nombre, creado_por FROM mascotas'),
    query('SELECT id, nombre FROM usuarios'),
  ]);
  const byId = (rows) => new Map(rows.map((row) => [String(row.id), row]));
  return { mascotas: byId(mascotas.rows), usuarios: byId(usuarios.rows) };
}

const enrich = (solicitud, lookups) => ({
  ...solicitud,
  mascota_nombre: lookups.mascotas.get(String(solicitud.mascota_id))?.nombre ?? null,
  usuario_nombre: lookups.usuarios.get(String(solicitud.usuario_id))?.nombre ?? null,
});

async function listSolicitudes(user) {
  if (user.rol === 'ADOPTANTE') {
    const own = await query(
      `SELECT ${SOLICITUD_COLUMNS} FROM solicitudes_adopcion WHERE usuario_id = $1 ORDER BY created_at DESC`,
      [user.id],
    );
    return own.rows;
  }
  const all = await query(`SELECT ${SOLICITUD_COLUMNS} FROM solicitudes_adopcion ORDER BY created_at DESC`);
  const lookups = await loadLookups();
  return all.rows
    .filter((solicitud) => ownsMascota(lookups.mascotas.get(String(solicitud.mascota_id)), user))
    .map((solicitud) => enrich(solicitud, lookups));
}

async function findSolicitud(id) {
  const result = await query(`SELECT ${SOLICITUD_COLUMNS} FROM solicitudes_adopcion WHERE id = $1`, [id]);
  return result.rows?.[0] || null;
}

async function canAccess(solicitud, user) {
  if (user.rol === 'ADOPTANTE') return sameId(solicitud.usuario_id, user.id);
  const mascota = await query('SELECT id, creado_por FROM mascotas WHERE id = $1', [solicitud.mascota_id]);
  return ownsMascota(mascota.rows?.[0], user);
}

async function updateEstado(solicitud, estado) {
  const result = await query(
    `UPDATE solicitudes_adopcion SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING ${SOLICITUD_COLUMNS}`,
    [estado, solicitud.id],
  );
  if (estado === 'APROBADA') {
    await query('UPDATE mascotas SET adoptada = $1 WHERE id = $2 RETURNING id', [true, solicitud.mascota_id]);
  }
  return result.rows[0];
}

module.exports = { SOLICITUD_COLUMNS, listSolicitudes, findSolicitud, canAccess, updateEstado };
