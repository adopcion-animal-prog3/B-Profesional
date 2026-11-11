/* Smoke test end-to-end contra una instancia real de la API. */
require('dotenv').config();

const crypto = require('crypto');

const BASE = process.env.SMOKE_BASE || 'http://localhost:3000';

const DEMO_EMAIL = process.env.SMOKE_DEMO_EMAIL || 'admin@adopcion.test';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  process.stderr.write('Falta DEMO_PASSWORD en el entorno (.env) para el smoke test\n');
  process.exitCode = 1;
  process.exit(1);
}

let passed = 0;
const failures = [];

const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
    process.stdout.write(`  ok  ${label}\n`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    process.stdout.write(`  FAIL ${label}${detail ? ` — ${detail}` : ''}\n`);
  }
};

const waitForServer = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El servidor no respondió en /health');
};

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let payload = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: res.status, payload, data: payload?.data };
};

const main = async () => {
  await waitForServer();
  process.stdout.write(`\nSmoke test contra ${BASE}\n`);

  process.stdout.write('Salud y base de datos\n');
  const health = await api('GET', '/health');
  check('GET /health responde 200', health.status === 200);
  const dbInfo = await api('GET', '/api/db-check');
  check('GET /api/db-check responde 200', dbInfo.status === 200);

  process.stdout.write('\nAutenticación\n');
  const login = await api('POST', '/api/auth/login', {
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD }
  });
  check('login admin devuelve 200', login.status === 200, `status ${login.status}`);
  check('login admin entrega token', Boolean(login.data?.token));
  check('login admin entrega rol ADMIN', login.data?.user?.rol === 'ADMIN');
  const adminToken = login.data?.token;

  const badLogin = await api('POST', '/api/auth/login', {
    body: { email: DEMO_EMAIL, password: 'incorrecta' }
  });
  check('login inválido devuelve 401', badLogin.status === 401);

  const me = await api('GET', '/api/auth/me', { token: adminToken });
  check('GET /api/auth/me responde 200', me.status === 200);
  check('me devuelve el correo correcto', me.data?.email === DEMO_EMAIL);

  const stamp = Date.now();
  const newEmail = `smoke.${stamp}@adopcion.test`;
  const registerPassword = crypto.randomBytes(8).toString('base64url');
  const register = await api('POST', '/api/auth/register', {
    body: { nombre: 'Usuario Smoke', email: newEmail, password: registerPassword }
  });
  check('registro devuelve 201', register.status === 201, `status ${register.status}`);
  check('registro devuelve rol ADOPTANTE', register.data?.user?.rol === 'ADOPTANTE');
  const userToken = register.data?.token;

  const profile = await api('PUT', '/api/auth/me', {
    token: userToken,
    body: { nombre: 'Usuario Smoke Actualizado' }
  });
  check('actualizar perfil responde 200', profile.status === 200);
  check('perfil guarda el nombre', profile.data?.nombre === 'Usuario Smoke Actualizado');

  const newPassword = crypto.randomBytes(8).toString('base64url');
  const passwordChange = await api('PUT', '/api/auth/me', {
    token: userToken,
    body: { currentPassword: registerPassword, newPassword }
  });
  check('cambiar contraseña responde 200', passwordChange.status === 200);

  const reLogin = await api('POST', '/api/auth/login', {
    body: { email: newEmail, password: newPassword }
  });
  check('login con la nueva contraseña funciona', reLogin.status === 200);

  process.stdout.write('\nCatálogo de mascotas\n');
  const list = await api('GET', '/api/mascotas');
  check('GET /api/mascotas responde 200', list.status === 200);
  check('el catálogo trae mascotas sembradas', Array.isArray(list.data) && list.data.length >= 5);

  const filtered = await api('GET', '/api/mascotas?especie=Perro&disponible=true');
  check('filtro por especie y disponibilidad responde 200', filtered.status === 200);
  check(
    'el filtro devuelve solo perros disponibles',
    Array.isArray(filtered.data) && filtered.data.every((p) => p.especie === 'Perro' && !p.adoptada)
  );

  const createdPet = await api('POST', '/api/mascotas', {
    token: adminToken,
    body: {
      nombre: `Smoke Mascota ${stamp}`,
      especie: 'Perro',
      raza: 'Mestizo',
      edad: 1.5,
      sexo: 'F',
      estado: 'Disponible',
      ubicacion: 'Córdoba',
      descripcion: 'Mascota creada por el smoke test.'
    }
  });
  check('crear mascota devuelve 201', createdPet.status === 201, `status ${createdPet.status}`);
  const petId = createdPet.data?.id;
  check('la mascota creada tiene id', Number.isInteger(petId));
  check('la edad decimal se conserva', Number(createdPet.data?.edad) === 1.5);

  const forbidden = await api('POST', '/api/mascotas', {
    token: userToken,
    body: { nombre: 'No autorizado', especie: 'Gato' }
  });
  check('ADOPTANTE no puede crear mascotas (403)', forbidden.status === 403);

  const updatedPet = await api('PUT', `/api/mascotas/${petId}`, {
    token: adminToken,
    body: { descripcion: 'Descripción actualizada por el smoke test.', estado: 'Reservado' }
  });
  check('editar mascota responde 200', updatedPet.status === 200);
  check('editar mascota actualiza el estado', updatedPet.data?.estado === 'Reservado');

  const detail = await api('GET', `/api/mascotas/${petId}`);
  check('GET mascota por id responde 200', detail.status === 200);

  process.stdout.write('\nHistorial clínico\n');
  const historyCreate = await api('POST', `/api/mascotas/${petId}/historial`, {
    token: adminToken,
    body: { descripcion: 'Control general satisfactorio.', veterinario: 'Dra. Smoke' }
  });
  check('crear registro clínico devuelve 201', historyCreate.status === 201, `status ${historyCreate.status}`);
  const historyId = historyCreate.data?.id;

  const historyList = await api('GET', `/api/mascotas/${petId}/historial`, { token: adminToken });
  check('listar historial responde 200', historyList.status === 200);
  check('el historial contiene el registro', historyList.data?.some((r) => r.id === historyId));

  const historyUpdate = await api('PUT', `/api/historial/${historyId}`, {
    token: adminToken,
    body: { descripcion: 'Control general satisfactorio (revisado).' }
  });
  check('actualizar registro clínico responde 200', historyUpdate.status === 200);

  const historyDelete = await api('DELETE', `/api/historial/${historyId}`, { token: adminToken });
  check('eliminar registro clínico responde 200', historyDelete.status === 200);

  process.stdout.write('\nSolicitudes de adopción\n');
  const availableList = await api('GET', '/api/mascotas?disponible=true');
  const target = availableList.data?.[0];
  check('hay una mascota disponible para solicitar', Boolean(target));

  const request = await api('POST', '/api/solicitudes', {
    token: userToken,
    body: {
      mascota_id: target.id,
      mensaje: 'Solicitud generada por el smoke test.',
      telefono: '+54 351 555 9999',
      contacto_nombre: 'Usuario Smoke Actualizado',
      contacto_email: newEmail
    }
  });
  check('crear solicitud devuelve 201', request.status === 201, `status ${request.status}`);
  const solicitudId = request.data?.id;
  check('la solicitud guarda el contacto', request.data?.contactoEmail === newEmail);

  const duplicate = await api('POST', '/api/solicitudes', {
    token: userToken,
    body: { mascota_id: target.id, mensaje: 'Duplicada' }
  });
  check('solicitud duplicada devuelve 409', duplicate.status === 409);

  const mine = await api('GET', '/api/solicitudes', { token: userToken });
  check('el adoptante ve sus solicitudes', mine.status === 200 && mine.data.every((s) => s.usuario_id === register.data.user.id));

  const allRequests = await api('GET', '/api/solicitudes', { token: adminToken });
  check('el admin ve todas las solicitudes', allRequests.status === 200);
  check('la nueva solicitud aparece para el admin', allRequests.data?.some((s) => s.id === solicitudId));

  const approve = await api('PUT', `/api/solicitudes/${solicitudId}`, {
    token: adminToken,
    body: { estado: 'APROBADA' }
  });
  check('aprobar solicitud responde 200', approve.status === 200);
  check('la solicitud queda aprobada', approve.data?.estado === 'APROBADA');

  const adoptedPet = await api('GET', `/api/mascotas/${target.id}`);
  check('aprobar marca la mascota como adoptada', adoptedPet.data?.estado === 'Adoptado');

  const forbiddenState = await api('PUT', `/api/solicitudes/${solicitudId}`, {
    token: userToken,
    body: { estado: 'RECHAZADA' }
  });
  check('ADOPTANTE no puede cambiar el estado (403)', forbiddenState.status === 403);

  process.stdout.write('\nEstadísticas y usuarios\n');
  const stats = await api('GET', '/api/stats', { token: adminToken });
  check('GET /api/stats responde 200', stats.status === 200);
  check('las estadísticas incluyen mascotas', Boolean(stats.data?.mascotas));

  const statsUser = await api('GET', '/api/stats', { token: userToken });
  check('stats del adoptante responde 200', statsUser.status === 200);

  const users = await api('GET', '/api/usuarios', { token: adminToken });
  check('GET /api/usuarios responde 200', users.status === 200);
  check('el listado incluye el usuario registrado', users.data?.some((u) => u.email === newEmail));

  const forbiddenUsers = await api('GET', '/api/usuarios', { token: userToken });
  check('ADOPTANTE no puede listar usuarios (403)', forbiddenUsers.status === 403);

  const promote = await api('PUT', `/api/usuarios/${register.data.user.id}/rol`, {
    token: adminToken,
    body: { rol: 'ADMIN' }
  });
  check('cambiar rol responde 200', promote.status === 200);
  check('el rol se actualiza a ADMIN', promote.data?.rol === 'ADMIN');

  const selfDemote = await api('PUT', `/api/usuarios/${login.data.user.id}/rol`, {
    token: adminToken,
    body: { rol: 'ADOPTANTE' }
  });
  check('el admin no puede quitarse su propio rol', selfDemote.status === 400 || selfDemote.status === 403);

  process.stdout.write('\nLimpieza\n');
  const deletePet = await api('DELETE', `/api/mascotas/${petId}`, { token: adminToken });
  check('eliminar mascota responde 200', deletePet.status === 200);

  const missing = await api('GET', `/api/mascotas/${petId}`);
  check('la mascota eliminada devuelve 404', missing.status === 404);

  const spa = await fetch(`${BASE}/mascotas`);
  const spaHtml = await spa.text();
  check('el SPA sirve index.html en rutas del cliente', spa.status === 200 && spaHtml.includes('<div id="app">'));

  process.stdout.write(`\nResultado: ${passed} comprobaciones correctas, ${failures.length} fallidas.\n`);
  if (failures.length > 0) {
    for (const failure of failures) process.stdout.write(` - ${failure}\n`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  process.stderr.write(`Smoke test abortado: ${error.message}\n`);
  process.exitCode = 1;
});
