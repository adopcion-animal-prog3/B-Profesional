const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { useMemoryApp } = require('../helpers/memoryApp');
const { outbox } = require('../../src/services/mailer.service');
const { query } = require('../../src/config/database');

const { request, lastCodeFor } = useMemoryApp();
const password = 'clave-segura-1';

const register = (email) => request('POST', '/api/auth/register', {
  body: { nombre: 'Refugio Verde', email, password },
});
const verify = (email, codigo) => request('POST', '/api/auth/verify', { body: { email, codigo } });
const wrongCode = (code) => String((Number(code) + 1) % 1000000).padStart(6, '0');

describe('verificación por código de email (base en memoria)', () => {
  it('registro: envía el código por email y al validarlo entrega el token', async () => {
    const email = 'verde@refugio.test';
    const res = await register(email);
    assert.equal(res.status, 201);

    const mail = outbox.at(-1);
    assert.equal(mail.to, email);
    assert.match(mail.subject, /código de verificación/);
    assert.match(mail.html, /Huellitas/);

    const ok = await verify(email, lastCodeFor(email));
    assert.equal(ok.status, 200);
    assert.equal(jwt.verify(ok.body.data.token, process.env.JWT_SECRET).rol, 'ADMIN');

    const usuario = await query('SELECT id, email_verificado FROM usuarios WHERE LOWER(email) = $1', [email]);
    assert.equal(usuario.rows[0].email_verificado, true);
    assert.equal((await verify(email, lastCodeFor(email))).status, 400, 'el código no se puede reutilizar');
  });

  it('login: la contraseña sola no alcanza, hace falta el código', async () => {
    const email = 'login@refugio.test';
    await register(email);
    const first = await request('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(first.status, 202);
    assert.equal(first.body.data.token, undefined);
    assert.equal(first.body.data.verificacion.proposito, 'LOGIN');

    const code = lastCodeFor(email);
    const bad = await verify(email, wrongCode(code));
    assert.equal(bad.status, 400);
    assert.equal((await verify(email, code)).status, 200);
  });

  it('bloquea el código después de 5 intentos fallidos', async () => {
    const email = 'intentos@refugio.test';
    await register(email);
    const code = lastCodeFor(email);
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await verify(email, wrongCode(code))).status, 400);
    }
    assert.equal((await verify(email, code)).status, 429);
  });

  it('reenvío: espera un minuto entre códigos y no revela si la cuenta existe', async () => {
    const email = 'reenvio@refugio.test';
    await register(email);
    const res = await request('POST', '/api/auth/resend-code', { body: { email } });
    assert.equal(res.status, 429);

    const unknown = await request('POST', '/api/auth/resend-code', { body: { email: 'nadie@refugio.test' } });
    assert.equal(unknown.status, 200);
  });

  it('valida el formato del código y rechaza cuentas del otro portal', async () => {
    assert.equal((await verify('verde@refugio.test', '12ab')).status, 400);
    assert.equal((await verify('adoptante@adopcion.test', '123456')).status, 400);
  });
});
