-- Esquema de base de datos para la plataforma de adopción
-- Compatible con PostgreSQL y pg-mem (modo desarrollo en memoria)

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'ADOPTANTE',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mascotas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  especie VARCHAR(100) NOT NULL,
  raza VARCHAR(120),
  edad INTEGER,
  sexo VARCHAR(10),
  descripcion TEXT,
  adoptada BOOLEAN DEFAULT FALSE,
  creado_por INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historial_clinico (
  id SERIAL PRIMARY KEY,
  mascota_id INTEGER NOT NULL REFERENCES mascotas(id),
  fecha_registro TIMESTAMP NOT NULL DEFAULT NOW(),
  descripcion TEXT NOT NULL,
  veterinario VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes_adopcion (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mascota_id INTEGER NOT NULL REFERENCES mascotas(id),
  estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
  mensaje TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
