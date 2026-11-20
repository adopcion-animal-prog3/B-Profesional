-- init.sql
-- Esquema compartido de la Plataforma de Adopción y Gestión de Salud Animal.
-- Lo usan los dos backends (B-Profesional y B-Personal) sobre la misma base.
-- Es idempotente: puede ejecutarse varias veces sin perder datos.
--
-- Roles:
--   ADMIN     -> cuenta profesional (refugio/veterinaria): publica mascotas.
--   ADOPTANTE -> cuenta personal: solicita adopciones.
--
-- La plataforma arranca vacía: cada persona se registra, publica y adopta.
-- (B-Profesional solo carga datos de demostración si SEED_DEMO_DATA=true.)

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'ADOPTANTE' CHECK (rol IN ('ADMIN','ADOPTANTE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mascotas (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  especie VARCHAR(100) NOT NULL,
  raza VARCHAR(120),
  edad INTEGER CHECK (edad IS NULL OR edad >= 0),
  sexo VARCHAR(20) CHECK (sexo IN ('M','F','OTRO')),
  descripcion TEXT,
  adoptada BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Las cuentas confirman su email con un código antes de poder usarse.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;

-- Imagen de la mascota como data URL (data:image/...;base64,...).
ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS imagen TEXT;

CREATE TABLE IF NOT EXISTS solicitudes_adopcion (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mascota_id BIGINT NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
  mensaje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS historial_clinico (
  id BIGSERIAL PRIMARY KEY,
  mascota_id BIGINT NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  descripcion TEXT NOT NULL,
  veterinario VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Mensajes directos entre cuentas (adoptante <-> publicador).
CREATE TABLE IF NOT EXISTS mensajes (
  id BIGSERIAL PRIMARY KEY,
  remitente_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mascota_id BIGINT REFERENCES mascotas(id) ON DELETE SET NULL,
  contenido TEXT NOT NULL CHECK (length(trim(contenido)) > 0),
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (remitente_id <> destinatario_id)
);

-- Códigos de verificación enviados por email (registro e inicio de sesión).
-- Se guarda un HMAC del código, nunca el código en texto plano.
CREATE TABLE IF NOT EXISTS codigos_verificacion (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proposito VARCHAR(20) NOT NULL CHECK (proposito IN ('REGISTRO','LOGIN')),
  codigo_hash VARCHAR(64) NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codigos_usuario ON codigos_verificacion (usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON mensajes (remitente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario ON mensajes (destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_creado_por ON mascotas (creado_por);
