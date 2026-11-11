/**
 * Motor de base de datos en memoria simple.
 * Soporta las consultas SQL parametrizadas usadas por la aplicación
 * sin necesidad de PostgreSQL externo.
 */

const { parse } = require('path');

const tables = {};
let sequences = {};

function reset() {
  for (const name of Object.keys(tables)) {
    tables[name] = [];
  }
  sequences = {};
}

function nextSeq(table) {
  if (!sequences[table]) sequences[table] = 0;
  sequences[table] += 1;
  return sequences[table];
}

function ensureTable(table, columns) {
  if (!tables[table]) {
    tables[table] = [];
    sequences[table] = 0;
  }
}

function insertRow(table, row) {
  ensureTable(table);
  if (!row.id) row.id = nextSeq(table);
  row.created_at = row.created_at || new Date().toISOString();
  row.updated_at = row.updated_at || row.created_at;
  tables[table].push(row);
  return { ...row };
}

function findRows(table, whereFn) {
  ensureTable(table);
  return tables[table].filter(whereFn);
}

function findOne(table, whereFn) {
  const rows = findRows(table, whereFn);
  return rows.length > 0 ? rows[0] : null;
}

function updateRows(table, whereFn, updates) {
  ensureTable(table);
  let count = 0;
  for (const row of tables[table]) {
    if (whereFn(row)) {
      Object.assign(row, updates);
      row.updated_at = new Date().toISOString();
      count++;
    }
  }
  return count;
}

function deleteRows(table, whereFn) {
  ensureTable(table);
  const before = tables[table].length;
  tables[table] = tables[table].filter(row => !whereFn(row));
  return before - tables[table].length;
}

/**
 * Ejecuta una consulta SQL parametrizada simplificada.
 * Soporta SELECT, INSERT, UPDATE, DELETE con parámetros $1, $2, ...
 * Retorna { rows: [...], rowCount: N }
 */
async function query(sql, params = []) {
  const normalized = sql.trim();
  const upper = normalized.toUpperCase();

  // Reemplazar parámetros $1, $2, etc. en el SQL para depuración (no se usa en ejecución)
  const paramValues = params;

  // ---------- SELECT ----------
  if (upper.startsWith('SELECT')) {
    // Health check: SELECT 1 AS ok, NOW() AS current_time
    if (upper.includes('AS OK') && upper.includes('NOW()')) {
      return { rows: [{ ok: 1, current_time: new Date().toISOString() }], rowCount: 1 };
    }
    if (upper === 'SELECT 1' || upper === 'SELECT 1 AS OK') {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    return handleSelect(normalized, paramValues);
  }

  // ---------- INSERT ----------
  if (upper.startsWith('INSERT')) {
    return handleInsert(normalized, paramValues);
  }

  // ---------- UPDATE ----------
  if (upper.startsWith('UPDATE')) {
    return handleUpdate(normalized, paramValues);
  }

  // ---------- DELETE ----------
  if (upper.startsWith('DELETE')) {
    return handleDelete(normalized, paramValues);
  }

  throw new Error(`Tipo de consulta no soportado: ${normalized.substring(0, 60)}`);
}

function handleSelect(sql, params) {
  // Normalizar saltos de línea y espacios
  sql = sql.replace(/\s+/g, ' ').trim();
  const upper = sql.toUpperCase();

  // SELECT COUNT(*) AS count FROM tabla
  const countMatch = upper.match(/SELECT\s+COUNT\(\*\)\s+AS\s+(\w+)\s+FROM\s+(\w+)/);
  if (countMatch) {
    const table = countMatch[2];
    ensureTable(table);
    const rows = tables[table] || [];
    return { rows: [{ [countMatch[1]]: rows.length }], rowCount: 1 };
  }

  // SELECT ... FROM tabla WHERE id = $1
  const selectById = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
  if (selectById) {
    const columns = selectById[1].split(',').map(c => c.trim());
    const table = selectById[2];
    const idCol = selectById[3];
    const paramIdx = Number(selectById[4]) - 1;
    const idValue = params[paramIdx];
    ensureTable(table);
    const row = findOne(table, r => r[idCol] == idValue);
    if (!row) return { rows: [], rowCount: 0 };
    const projected = projectColumns(row, columns);
    return { rows: [projected], rowCount: 1 };
  }

  // SELECT ... FROM tabla WHERE columna = $1 ORDER BY ...
  const selectWhere = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?$/i);
  if (selectWhere) {
    const columns = selectWhere[1].split(',').map(c => c.trim());
    const table = selectWhere[2];
    const whereClause = selectWhere[3];
    const orderBy = selectWhere[4];
    ensureTable(table);
    let rows = tables[table] || [];
    if (whereClause) {
      rows = rows.filter(r => evaluateWhere(r, whereClause, params));
    }
    if (orderBy) {
      const [orderCol, orderDir] = orderBy.trim().split(/\s+/);
      rows = [...rows].sort((a, b) => {
        const av = a[orderCol.trim()];
        const bv = b[orderCol.trim()];
        if (av < bv) return orderDir === 'DESC' ? 1 : -1;
        if (av > bv) return orderDir === 'DESC' ? -1 : 1;
        return 0;
      });
    }
    const projected = rows.map(r => projectColumns(r, columns));
    return { rows: projected, rowCount: projected.length };
  }

  // SELECT ... FROM tabla (sin WHERE)
  const selectAll = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)\s*$/i);
  if (selectAll) {
    const columns = selectAll[1].split(',').map(c => c.trim());
    const table = selectAll[2];
    ensureTable(table);
    const rows = tables[table] || [];
    const projected = rows.map(r => projectColumns(r, columns));
    return { rows: projected, rowCount: projected.length };
  }

  throw new Error(`SELECT no soportado: ${sql.substring(0, 100)}`);
}

function evaluateWhere(row, whereClause, params) {
  // Soporta: columna = $n, columna LIKE $n, LOWER(columna) = $n, NOT $n
  const andParts = whereClause.split(/\s+AND\s+/i);
  for (const part of andParts) {
    const trimmed = part.trim();
    if (!evaluateCondition(row, trimmed, params)) return false;
  }
  return true;
}

function evaluateCondition(row, condition, params) {
  // NOT $n
  const notParam = condition.match(/^NOT\s+\$(\d+)$/i);
  if (notParam) {
    const idx = Number(notParam[1]) - 1;
    return !params[idx];
  }

  // columna = $n
  const eqParam = condition.match(/^(\w+)\s*=\s*\$(\d+)$/i);
  if (eqParam) {
    const col = eqParam[1];
    const idx = Number(eqParam[2]) - 1;
    return row[col] == params[idx];
  }

  // columna LIKE $n
  const likeParam = condition.match(/^(\w+)\s+LIKE\s+\$(\d+)$/i);
  if (likeParam) {
    const col = likeParam[1];
    const idx = Number(likeParam[2]) - 1;
    const pattern = String(params[idx] || '').toLowerCase();
    const value = String(row[col] || '').toLowerCase();
    // Convertir % a .* y _ a .
    const regexPattern = pattern.replace(/[%]/g, '.*').replace(/[_]/g, '.');
    return new RegExp('^' + regexPattern + '$').test(value);
  }

  // LOWER(columna) = $n
  const lowerEq = condition.match(/^LOWER\((\w+)\)\s*=\s*\$(\d+)$/i);
  if (lowerEq) {
    const col = lowerEq[1];
    const idx = Number(lowerEq[2]) - 1;
    return String(row[col] || '').toLowerCase() === String(params[idx] || '').toLowerCase();
  }

  return true;
}

function projectColumns(row, columns) {
  const result = {};
  for (const col of columns) {
    const trimmed = col.trim();
    if (trimmed === '*') {
      return { ...row };
    }
    // Soportar alias: columna AS alias
    const aliasMatch = trimmed.match(/^(\w+)\s+AS\s+(\w+)$/i);
    if (aliasMatch) {
      result[aliasMatch[2]] = row[aliasMatch[1]];
    } else {
      result[trimmed] = row[trimmed];
    }
  }
  return result;
}

function handleInsert(sql, params) {
  // Normalizar saltos de línea y espacios
  sql = sql.replace(/\s+/g, ' ').trim();

  // INSERT ... RETURNING ...
  const returningMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)\s+RETURNING\s+(.+)/i);
  if (returningMatch) {
    const table = returningMatch[1];
    const columns = returningMatch[2].split(',').map(c => c.trim());
    const placeholders = returningMatch[3].split(',').map(c => c.trim());
    const returningCols = returningMatch[4].split(',').map(c => c.trim());

    ensureTable(table);
    const row = {};
    for (let i = 0; i < columns.length; i++) {
      let ph = placeholders[i];
      if (ph.startsWith('$')) {
        const idx = Number(ph.substring(1)) - 1;
        row[columns[i]] = params[idx];
      } else if (ph === "NOW()") {
        row[columns[i]] = new Date().toISOString();
      } else if (ph.startsWith("'") && ph.endsWith("'")) {
        row[columns[i]] = ph.slice(1, -1);
      } else {
        row[columns[i]] = ph;
      }
    }
    const inserted = insertRow(table, row);
    const projected = projectColumns(inserted, returningCols);
    return { rows: [projected], rowCount: 1 };
  }

  // INSERT ... (sin RETURNING)
  const simpleMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)\s*$/i);
  if (simpleMatch) {
    const table = simpleMatch[1];
    const columns = simpleMatch[2].split(',').map(c => c.trim());
    const placeholders = simpleMatch[3].split(',').map(c => c.trim());

    ensureTable(table);
    const row = {};
    for (let i = 0; i < columns.length; i++) {
      let ph = placeholders[i];
      if (ph.startsWith('$')) {
        const idx = Number(ph.substring(1)) - 1;
        row[columns[i]] = params[idx];
      } else if (ph === "NOW()") {
        row[columns[i]] = new Date().toISOString();
      } else if (ph.startsWith("'") && ph.endsWith("'")) {
        row[columns[i]] = ph.slice(1, -1);
      } else {
        row[columns[i]] = ph;
      }
    }
    const inserted = insertRow(table, row);
    return { rows: [inserted], rowCount: 1 };
  }

  throw new Error('INSERT no soportado: ' + sql.substring(0, 100));
}

function handleUpdate(sql, params) {
  // Normalizar saltos de línea y espacios
  sql = sql.replace(/\s+/g, ' ').trim();
  // UPDATE tabla SET col1 = $1, col2 = $2, ... WHERE id = $N RETURNING ...
  const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)\s+RETURNING\s+(.+)/i);
  if (!match) {
    throw new Error('UPDATE no soportado: ' + sql.substring(0, 100));
  }
  const table = match[1];
  const setClause = match[2];
  const whereClause = match[3];
  const returningCols = match[4].split(',').map(c => c.trim());

  ensureTable(table);
  const rows = findRows(table, r => evaluateWhere(r, whereClause, params));
  const updated = [];

  // Parsear SET col = val, col2 = val2
  const setParts = setClause.split(',');
  const updates = {};
  for (const part of setParts) {
    const [col, ...valParts] = part.trim().split('=');
    let val = valParts.join('=').trim();
    if (val.startsWith('$')) {
      const idx = Number(val.substring(1)) - 1;
      updates[col.trim()] = params[idx];
    } else if (val === "NOW()") {
      updates[col.trim()] = new Date().toISOString();
    } else if (val.startsWith("'") && val.endsWith("'")) {
      updates[col.trim()] = val.slice(1, -1);
    } else {
      updates[col.trim()] = val;
    }
  }

  for (const row of rows) {
    Object.assign(row, updates);
    row.updated_at = new Date().toISOString();
    updated.push(projectColumns(row, returningCols));
  }

  return { rows: updated, rowCount: updated.length };
}

function handleDelete(sql, params) {
  // Normalizar saltos de línea y espacios
  sql = sql.replace(/\s+/g, ' ').trim();
  // DELETE FROM tabla WHERE condicion RETURNING ...
  const match = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\s+RETURNING\s+(.+)/i);
  if (!match) {
    throw new Error('DELETE no soportado: ' + sql.substring(0, 100));
  }
  const table = match[1];
  const whereClause = match[2];
  const returningCols = match[3].split(',').map(c => c.trim());

  ensureTable(table);
  const rows = findRows(table, r => evaluateWhere(r, whereClause, params));
  const deleted = rows.map(r => projectColumns({ ...r }, returningCols));
  deleteRows(table, r => evaluateWhere(r, whereClause, params));
  return { rows: deleted, rowCount: deleted.length };
}

module.exports = {
  query,
  reset,
  tables,
  seed: (table, rows) => {
    tables[table] = rows.map(r => ({ ...r }));
    // Actualizar secuencia
    const maxId = Math.max(...rows.map(r => r.id || 0), 0);
    sequences[table] = maxId;
  },
};
