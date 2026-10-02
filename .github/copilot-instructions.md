# GitHub Copilot Instructions — F-profesional

## 1. Contexto general del proyecto

Este repositorio forma parte del proyecto integrador final de Programación 3:

**“Plataforma de Adopción y Gestión de Salud Animal”**

El objetivo general es desarrollar una plataforma web para gestionar mascotas, adopciones y su historial clínico.

El proyecto está dividido en 4 repositorios independientes:

- `B-personal`: Backend con Python + FastAPI.
- `F-personal`: Frontend con React + Vite.
- `B-profesional`: Backend con Node.js + Express.
- `F-profesional`: Frontend con Vue.js.

Este repositorio corresponde a:

**F-profesional → Frontend con Vue.js**

---

## 2. Requisito principal de diversidad tecnológica

Uno de los objetivos principales del proyecto es demostrar el uso de diferentes frameworks para resolver el mismo problema.

Por eso:

- `B-personal` y `B-profesional` deben implementar el mismo servicio con distintos frameworks.
- `F-personal` y `F-profesional` deben implementar la misma aplicación con distintos frameworks.

En este repositorio se debe utilizar:

**Vue.js**

El frontend Vue debe mantener equivalencia funcional con el frontend React.

Esto significa que ambas aplicaciones deben:

- tener las mismas funcionalidades principales;
- manejar los mismos recursos;
- utilizar las mismas rutas o equivalentes funcionales;
- consumir los mismos endpoints;
- respetar el mismo contrato de API;
- mantener flujos de usuario equivalentes;
- manejar autenticación y autorización de forma equivalente;
- mostrar estados de carga, errores y éxitos;
- permitir realizar las operaciones CRUD requeridas.

No se debe agregar una funcionalidad exclusiva de Vue que no exista en React salvo que sea estrictamente necesaria para la implementación técnica.

---

## 3. Tecnologías

Este repositorio utiliza:

- Vue.js
- Vite
- Vue Router
- Cliente HTTP mediante Axios o la solución ya utilizada en el proyecto
- JavaScript, salvo que el proyecto existente utilice TypeScript
- HTML
- CSS

No introducir nuevas tecnologías innecesarias.

Antes de instalar una nueva dependencia, comprobar si existe una solución utilizando las dependencias actuales del proyecto.

---

## 4. Base de datos y backend

La aplicación utiliza un backend compartido conceptualmente por las dos implementaciones:

### Backend Express

`B-profesional`

- Node.js
- Express

### Backend FastAPI

`B-personal`

- Python
- FastAPI

Ambos backends trabajan con:

**PostgreSQL 18.6**

La base de datos se ejecuta mediante Docker y utiliza persistencia mediante volumen.

El frontend nunca debe conectarse directamente a PostgreSQL.

El frontend debe comunicarse exclusivamente con el backend mediante HTTP/REST.

---

# 5. Entidades principales

La plataforma trabaja principalmente con estas entidades:

## Usuarios

Campos principales:

- `id`
- `nombre`
- `email`
- `password_hash`
- `rol`
- `created_at`

Roles permitidos:

- `ADMIN`
- `ADOPTANTE`

El frontend no debe almacenar ni mostrar `password_hash`.

---

## Mascotas

Campos actuales:

- `id`
- `nombre`
- `especie`
- `raza`
- `edad`
- `sexo`
- `descripcion`
- `adoptada`
- `creado_por`
- `created_at`

Valores permitidos para `sexo`:

- `M`
- `F`
- `OTRO`

La edad puede ser nula, pero cuando exista debe ser mayor o igual a 0.

No inventar campos que no existan en el contrato actual.

Por ejemplo, no utilizar `estado` para mascotas si el backend actual no lo devuelve.

---

## Solicitudes de adopción

Campos principales:

- `id`
- `usuario_id`
- `mascota_id`
- `estado`
- `mensaje`
- `created_at`
- `updated_at`

Estados permitidos:

- `PENDIENTE`
- `APROBADA`
- `RECHAZADA`

---

## Historial clínico

Campos principales:

- `id`
- `mascota_id`
- `fecha_registro`
- `descripcion`
- `veterinario`
- `created_at`
- `updated_at`

---

# 6. Contrato de API

El frontend debe consumir los endpoints definidos por el proyecto.

## Health

```http
GET /health