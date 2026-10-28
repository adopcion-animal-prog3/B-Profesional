// Datos de prueba reutilizables para los tests de mascotas (ficticios).
const mascotaRow = (overrides = {}) => ({
  id: 1,
  nombre: 'Luna',
  especie: 'Perro',
  raza: 'Labrador',
  edad: 2,
  sexo: 'F',
  descripcion: 'Perra sociable',
  adoptada: false,
  creado_por: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const validMascotaPayload = (overrides = {}) => ({
  nombre: 'Luna',
  especie: 'Perro',
  raza: 'Labrador',
  edad: 2,
  sexo: 'F',
  descripcion: 'Perra sociable',
  adoptada: false,
  ...overrides,
});

module.exports = { mascotaRow, validMascotaPayload };
