<!-- calidad:inicio -->
![Calidad](https://img.shields.io/badge/Calidad-50%2F100-orange) ![Aprobado](https://img.shields.io/badge/Aprobado-NO-red) ![Cumple](https://img.shields.io/badge/Cumple-13%2F15-green) ![Duplicación](https://img.shields.io/badge/Duplicaci%C3%B3n-16.3%25-yellow) ![SEC](https://img.shields.io/badge/SEC-0-green) ![SQL](https://img.shields.io/badge/SQL-0-green) ![DBG](https://img.shields.io/badge/DBG-0-green) ![Capas](https://img.shields.io/badge/Capas-3-green) ![Tests](https://img.shields.io/badge/Tests-13-green) ![Cob](https://img.shields.io/badge/Cob-61.3%25-yellow) ![EP](https://img.shields.io/badge/EP-21-green)

**Calidad de servicios (heurístico):** índice **50/100** · cumple **13/15** · aprobado **NO** · capas **3**
Detalle completo en [`docs/EVALUACION.md`](docs/EVALUACION.md).
<!-- calidad:fin -->

# B-personal

En este repositorio se realizara el backend para todos aquellos usuarios libres 

# INFO:
## Pruebas automatizadas

Usan el runner nativo de Node (`node:test`, Node 18+), sin dependencias nuevas.

```bash
npm test                # ejecuta todas las pruebas
npm run test:coverage   # pruebas + cobertura (genera coverage/lcov.info)
```

Las pruebas están organizadas por funcionalidad en `tests/mascotas/`, `tests/auth/`, `tests/solicitudes/`, `tests/historial/` y `tests/health/`, y usan los helpers de `tests/helpers/`. Los tokens y usuarios de autenticación son ficticios y se firman con un secreto exclusivo de pruebas.

**Alcance y limitaciones:** la capa de base de datos se reemplaza por un doble de prueba, por lo que estos tests verifican rutas, validaciones, parámetros SQL y códigos HTTP. **No comprueban persistencia real en PostgreSQL**; eso requiere una prueba de integración contra una base de pruebas dedicada (nunca la de producción).

El historial clínico está implementado para usuarios ADMIN y tiene pruebas de lectura, creación, actualización, eliminación, validación y autorización. La API permite iniciar sesión, pero actualmente **no cuenta con una ruta de registro de usuarios**.

El resultado y las limitaciones de la verificación integral están en [`docs/VERIFICACION_API_EXPRESS.md`](docs/VERIFICACION_API_EXPRESS.md).
