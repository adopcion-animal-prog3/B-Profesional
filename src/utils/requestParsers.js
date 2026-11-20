// Helpers comunes para interpretar parámetros y cuerpos de las peticiones.
const parsePositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const isJsonObject = (body) => Boolean(body) && typeof body === 'object' && !Array.isArray(body);

module.exports = { parsePositiveId, isJsonObject };
