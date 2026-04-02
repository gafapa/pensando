# AulaFlux

AulaFlux es una pizarra colaborativa local-first para clases, workshops y dinámicas de grupo. Está pensada para montarse rápido, funcionar sin backend de aplicación y permitir sesiones en tiempo real entre profesor y alumnos usando red local o internet.

## Qué es

El proyecto implementa un tablero visual tipo Miro/Padlet con dos modos de trabajo:

- `Free-form`: libertad total para mover elementos por el lienzo.
- `Grid-snap`: zonas tipo columnas o contenedores donde las tarjetas e imágenes se ordenan automáticamente.

La sesión sigue un modelo `Host / Peer`:

- El `Host` crea la sala, mantiene el estado principal del lienzo y redistribuye cambios.
- Los `Peers` se conectan a la sala, editan el tablero y reciben actualizaciones en tiempo real.

## MVP incluido

- Creación de sala con ID compartible
- Enlace de invitación con QR
- Sticky notes editables
- Zonas visuales con auto-layout
- Conectores dinámicos entre objetos
- Drag & drop de imágenes pequeñas `< 2MB`
- Cursores remotos con nombre
- Exportación e importación de sesiones con `canvas.toJSON()`
- PeerServer local opcional para redes totalmente offline

## Stack final

Se mantuvo la idea original del documento, ajustando algunas piezas para ganar velocidad de desarrollo y una UI más actual:

- `React 19`
- `TypeScript`
- `Vite 8`
- `Tailwind CSS 4`
- `Fabric.js 7` para el lienzo y los objetos serializables
- `PeerJS` para conectividad P2P
- `peer` para levantar un `PeerServer` local opcional
- `qrcode` para generar el QR de entrada a la sala
- `motion` para animaciones
- `lucide-react` para iconografía
- `sonner` para feedback visual y notificaciones
- `@fontsource-variable/space-grotesk` para una tipografía más cuidada

## Arquitectura rápida

### Host

- Genera el ID de sala
- Inicializa la conexión P2P
- Sincroniza snapshots completos cuando entra un nuevo peer
- Retransmite mensajes de actualización al resto de clientes

### Peer

- Se conecta al ID del host
- Envía cambios locales
- Recibe objetos, cursores y cambios de layout

### Protocolo de mensajes

La app usa mensajes JSON con acciones como:

- `HELLO`
- `SYNC_SNAPSHOT`
- `UPSERT_OBJECT`
- `REMOVE_OBJECT`
- `UPDATE_META`
- `CURSOR`

## Experiencia de uso

### Profesor / Host

1. Abre la app.
2. Elige rol `Profesor / Host`.
3. Inicia la sala.
4. Comparte el QR o el enlace.
5. Crea notas, zonas, conexiones y exporta la sesión al terminar.

### Alumno / Peer

1. Abre el enlace compartido.
2. Entra con el rol `Alumno / Peer`.
3. Se conecta al host.
4. Colabora sobre el tablero en tiempo real.

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicación se levanta con Vite y queda accesible por defecto en:

```bash
http://localhost:5173
```

## Build de producción

```bash
npm run build
```

## Red local sin internet

Si el aula está en una red totalmente aislada y los navegadores no pueden usar señalización pública, ejecuta un PeerServer local en la máquina del profesor:

```bash
npm run peer-server
```

Después, en la interfaz:

- activa `Señalización local`
- indica la IP o hostname del profesor
- revisa puerto y path
- comparte el enlace generado con esos parámetros

## Estructura del proyecto

```text
src/
  App.tsx           UI principal y flujo de sesión
  main.tsx          bootstrap de React
  index.css         estilos globales y look visual
  lib/board.ts      utilidades de canvas, mensajes y serialización

scripts/
  peer-server.mjs   servidor local opcional de PeerJS
```

## Decisiones de implementación

- Se priorizó un MVP estable y demostrable.
- Se mantuvo la sincronización con un modelo `host-authoritative`, que simplifica conflictos para una primera versión.
- `Yjs` quedó fuera por ahora para reducir complejidad inicial; sería la siguiente mejora natural si se quiere edición concurrente más fina.
- Se reemplazó `qrious` por `qrcode`, que hoy tiene mejor mantenimiento práctico para este caso.

## Próximas mejoras recomendadas

- Añadir `Yjs` para sincronización CRDT real
- Selección múltiple más avanzada
- Persistencia automática local
- Permisos por rol
- Minimap del lienzo
- Comentarios o votaciones para dinámicas de clase
- Code splitting para reducir el bundle de `Fabric`

## Scripts disponibles

```bash
npm run dev
npm run build
npm run preview
npm run peer-server
```

## Estado actual

La app compila correctamente en producción con:

```bash
npm run build
```
