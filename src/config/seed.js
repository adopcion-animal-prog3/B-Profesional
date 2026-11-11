const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'Demo1234!';

const demoUsers = [
  { nombre: 'Administrador Demo', email: 'admin@adopcion.test', rol: 'ADMIN' },
  { nombre: 'Adoptante Demo', email: 'adoptante@adopcion.test', rol: 'ADOPTANTE' },
  { nombre: 'Ana Martínez', email: 'ana@adopcion.test', rol: 'ADOPTANTE' },
];

const demoPets = [
  {
    nombre: 'Luna',
    especie: 'Perro',
    raza: 'Labrador',
    edad: 2,
    sexo: 'F',
    descripcion: 'Perra sociable, muy activa y amigable. Ideal para familias con patio.',
    ubicacion: 'Córdoba',
    estado: 'Disponible',
    adoptada: false,
    creado_por: null,
  },
  {
    nombre: 'Simón',
    especie: 'Gato',
    raza: 'Siamés',
    edad: 1,
    sexo: 'M',
    descripcion: 'Gato tranquilo y cariñoso, ideal para departamentos pequeños.',
    ubicacion: 'Mendoza',
    estado: 'Disponible',
    adoptada: false,
    creado_por: null,
  },
  {
    nombre: 'Nina',
    especie: 'Conejo',
    raza: 'Mini Lop',
    edad: 1,
    sexo: 'F',
    descripcion: 'Conejita juguetona y dulce.',
    ubicacion: 'Rosario',
    estado: 'Disponible',
    adoptada: false,
    creado_por: null,
  },
  {
    nombre: 'Rocky',
    especie: 'Perro',
    raza: 'Mestizo',
    edad: 3,
    sexo: 'M',
    descripcion: 'Perro grande y protector, muy leal con su familia.',
    ubicacion: 'Buenos Aires',
    estado: 'En tratamiento',
    adoptada: false,
    creado_por: null,
  },
  {
    nombre: 'Michi',
    especie: 'Gato',
    raza: 'Angora',
    edad: 2,
    sexo: 'F',
    descripcion: 'Gata elegante y tranquila.',
    ubicacion: 'Córdoba',
    estado: 'Reservado',
    adoptada: false,
    creado_por: null,
  },
  {
    nombre: 'Lola',
    especie: 'Perro',
    raza: 'Golden Retriever',
    edad: 4,
    sexo: 'F',
    descripcion: 'Perra muy dócil y entrenada.',
    ubicacion: 'Mendoza',
    estado: 'Adoptado',
    adoptada: true,
    creado_por: null,
  },
];

const demoHistorial = [
  { mascotaNombre: 'Luna', descripcion: 'Vacunación anual y desparasitación.', veterinario: 'Dra. Sofía Torres' },
  { mascotaNombre: 'Simón', descripcion: 'Chequeo general: saludable.', veterinario: 'Dr. Martín Ruiz' },
  { mascotaNombre: 'Rocky', descripcion: 'Control de herida en pata.', veterinario: 'Dra. Sofía Torres' },
];

async function seedDatabase(queryFn) {
  // Verificar si ya hay datos
  const countResult = await queryFn('SELECT COUNT(*) AS count FROM usuarios');
  const count = Number(countResult.rows[0]?.count || 0);
  if (count > 0) {
    return { seeded: false };
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = {};

  for (const user of demoUsers) {
    const result = await queryFn(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      [user.nombre, user.email, passwordHash, user.rol]
    );
    userIds[user.email] = result.rows[0].id;
  }

  const petIds = {};
  for (const pet of demoPets) {
    const result = await queryFn(
      `INSERT INTO mascotas (nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [pet.nombre, pet.especie, pet.raza, pet.edad, pet.sexo, pet.descripcion, pet.adoptada, pet.creado_por]
    );
    petIds[pet.nombre] = result.rows[0].id;
  }

  for (const record of demoHistorial) {
    const petId = petIds[record.mascotaNombre];
    if (petId) {
      await queryFn(
        `INSERT INTO historial_clinico (mascota_id, descripcion, veterinario)
         VALUES ($1, $2, $3)`,
        [petId, record.descripcion, record.veterinario]
      );
    }
  }

  return { seeded: true, demoPassword: DEMO_PASSWORD };
}

module.exports = { seedDatabase, demoUsers, demoPets };
