<!-- calidad:inicio -->
![Calidad](https://img.shields.io/badge/Calidad-39%2F100-red) ![Aprobado](https://img.shields.io/badge/Aprobado-NO-red) ![Cumple](https://img.shields.io/badge/Cumple-11%2F15-yellow) ![Duplicación](https://img.shields.io/badge/Duplicaci%C3%B3n-19.1%25-yellow) ![SEC](https://img.shields.io/badge/SEC-0-green) ![SQL](https://img.shields.io/badge/SQL-1-red) ![DBG](https://img.shields.io/badge/DBG-0-green) ![Capas](https://img.shields.io/badge/Capas-3-green) ![Tests](https://img.shields.io/badge/Tests-0-red) ![Cob](https://img.shields.io/badge/Cob-sin%20medir-lightgrey) ![EP](https://img.shields.io/badge/EP-21-green)

**Calidad de servicios (heurístico):** índice **39/100** · cumple **11/15** · aprobado **NO** · capas **3**
Detalle completo en [`docs/EVALUACION.md`](docs/EVALUACION.md).
<!-- calidad:fin -->

# adopcionanimalbackend2
## Pruebas automatizadas

Usan el runner nativo de Node (`node:test`, Node 22+), sin dependencias nuevas.

```bash
npm test                # ejecuta todas las pruebas
npm run test:coverage   # pruebas + cobertura (genera coverage/lcov.info)
```

Las pruebas del CRUD de mascotas están en `tests/mascotas/` y usan los helpers de `tests/helpers/`.

**Alcance y limitaciones:** la capa de base de datos se reemplaza por un doble de prueba, por lo que estos tests verifican rutas, validaciones, parámetros SQL y códigos HTTP. **No comprueban persistencia real en PostgreSQL**; eso requiere una prueba de integración contra una base de pruebas dedicada (nunca la de producción).
