// Validaciones de entrada para mascotas (alta y edición parcial).
const SEXOS_VALIDOS = ['M', 'F', 'OTRO'];
const MAX_EDAD = 2147483647;
// La imagen viaja como data URL base64; 3 MB de texto ≈ 2,2 MB de imagen.
const MAX_IMAGEN_LENGTH = 3 * 1024 * 1024;
const IMAGEN_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const has = (data, field) => Object.prototype.hasOwnProperty.call(data, field);
const textLength = (value) => [...value].length;

function validateRequiredText(data, partial) {
  for (const [field, maxLength] of [['nombre', 150], ['especie', 100]]) {
    if (partial && !has(data, field)) continue;
    const value = data[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return `Field "${field}" is required and must be a non-empty string`;
    }
    if (textLength(value) > maxLength) {
      return `Field "${field}" must not exceed ${maxLength} characters`;
    }
  }
  return null;
}

function validateRaza(data) {
  if (!has(data, 'raza') || data.raza === null) return null;
  if (typeof data.raza !== 'string') return 'Field "raza" must be a string or null';
  return textLength(data.raza) > 120 ? 'Field "raza" must not exceed 120 characters' : null;
}

function validateEdad(data) {
  if (!has(data, 'edad') || data.edad === null) return null;
  const valid = Number.isInteger(data.edad) && data.edad >= 0 && data.edad <= MAX_EDAD;
  return valid ? null : 'Field "edad" must be a non-negative integer within the supported range';
}

function validateImagen(data) {
  if (!has(data, 'imagen') || data.imagen === null) return null;
  if (typeof data.imagen !== 'string' || !IMAGEN_PATTERN.test(data.imagen)) {
    return 'Field "imagen" must be a base64 data URL of a PNG, JPEG, WEBP or GIF image';
  }
  return data.imagen.length > MAX_IMAGEN_LENGTH ? 'Field "imagen" exceeds the maximum size' : null;
}

function validateSimpleFields(data) {
  if (has(data, 'sexo') && data.sexo !== null && !SEXOS_VALIDOS.includes(data.sexo)) {
    return 'Field "sexo" must be one of M, F, OTRO, or null';
  }
  if (has(data, 'descripcion') && data.descripcion !== null && typeof data.descripcion !== 'string') {
    return 'Field "descripcion" must be a string or null';
  }
  if (has(data, 'adoptada') && typeof data.adoptada !== 'boolean') {
    return 'Field "adoptada" must be boolean';
  }
  return null;
}

function validateMascota(data, partial = false) {
  const validators = [
    () => validateRequiredText(data, partial),
    () => validateRaza(data),
    () => validateEdad(data),
    () => validateSimpleFields(data),
    () => validateImagen(data),
  ];
  for (const validate of validators) {
    const error = validate();
    if (error) return error;
  }
  return null;
}

module.exports = { validateMascota, MAX_IMAGEN_LENGTH };
