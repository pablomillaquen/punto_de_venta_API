# 🛠️ POS API - Backend Service

Este es el servicio backend para el Sistema POS Multisucursal. Construido con focus en la velocidad, seguridad y escalabilidad.

## 🏗️ Arquitectura
El proyecto sigue una estructura modular para facilitar el mantenimiento:

- `controllers/`: Lógica de control para cada recurso.
- `models/`: Esquemas de Mongoose para MongoDB.
- `routes/`: Definición de endpoints API REST.
- `middlewares/`: Validaciones, autenticación JWT y manejo de errores.
- `services/`: Lógica de negocio reutilizable e integraciones externas.
- `sockets/`: Configuración de Socket.io para tiempo real.
- `config/`: Configuraciones de base de datos y entorno.

## 🚀 Tecnologías
- **Node.js**: Entorno de ejecución.
- **Express.js**: Framework web.
- **Mongoose**: Modelado de datos para MongoDB.
- **Socket.io**: Comunicación en tiempo real.
- **Transbank SDK**: Procesamiento de pagos.
- **JWT**: Seguridad de endpoints.

## 📡 Endpoints Principales
- `POST /api/auth/login`: Autenticación de usuarios.
- `GET /api/products`: Catálogo de productos.
- `POST /api/sales`: Registro de ventas.
- `POST /api/transbank/payment`: Inicio de transacción de pago.
- `GET /api/branches`: Gestión de sucursales.

## 🛠️ Configuración de Desarrollo
1. `npm install`
2. Crear un archivo `.env` basado en las variables requeridas.
3. `npm run dev` para iniciar con Nodemon.

---
**API Versión 1.0.0**
