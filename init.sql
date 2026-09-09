-- init.sql
-- Esquema inicial para la Plataforma de Adopción y Gestión de Salud Animal
-- Crea tablas: usuarios, mascotas, solicitudes_adopcion, historial_clinico

-- Tabla: usuarios
-- Almacena los usuarios del sistema con roles ADMIN y ADOPTANTE
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'ADOPTANTE' CHECK (rol IN ('ADMIN','ADOPTANTE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla: mascotas
-- Almacena los datos de las mascotas disponibles para adopción
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

-- Tabla: solicitudes_adopcion
-- Almacena las solicitudes de adopción de usuarios
CREATE TABLE IF NOT EXISTS solicitudes_adopcion (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mascota_id BIGINT NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
  mensaje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla: historial_clinico
-- Almacena el historial clínico y registros médicos de las mascotas
CREATE TABLE IF NOT EXISTS historial_clinico (
  id BIGSERIAL PRIMARY KEY,
  mascota_id BIGINT NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  descripcion TEXT NOT NULL,
  veterinario VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
