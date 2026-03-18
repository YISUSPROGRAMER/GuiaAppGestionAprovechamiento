# CODEX_CONTEXT

## Resumen

Aplicacion web progresiva (PWA) para gestionar entidades, recolecciones y materiales recuperados. El frontend corre con React + Vite + TypeScript y persiste localmente en IndexedDB usando Dexie. La sincronizacion remota se hace contra un Google Apps Script enlazado a una hoja de calculo.

## Stack

- Frontend: React 19, React Router 7, TypeScript, Tailwind CSS, Lucide.
- Persistencia local: Dexie + IndexedDB.
- UX: `react-hot-toast` para notificaciones.
- PWA: `vite-plugin-pwa`.
- Backend remoto: Google Apps Script en [backend/Code.js](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\backend\Code.js).

## Estructura principal

- App y rutas: [src/App.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\App.tsx)
- Layout principal: [src/layouts/MainLayout.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\layouts\MainLayout.tsx)
- Dashboard: [src/components/Dashboard.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\Dashboard.tsx)
- Entidades:
  - Lista: [src/components/EntidadesList.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\EntidadesList.tsx)
  - Formulario: [src/components/EntidadForm.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\EntidadForm.tsx)
- Recolecciones:
  - Lista: [src/components/RecoleccionesList.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\RecoleccionesList.tsx)
  - Formulario: [src/components/RecoleccionForm.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\RecoleccionForm.tsx)
- Ajustes: [src/components/SettingsPage.tsx](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\components\SettingsPage.tsx)
- Base local: [src/db/db.ts](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\db\db.ts)
- API y sync:
  - [src/services/api.ts](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\services\api.ts)
  - [src/services/sync.ts](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\services\sync.ts)
- Tipos de dominio: [src/types/index.ts](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\src\types\index.ts)

## Funcionalidades actuales

### 1. Dashboard

- Calcula metricas con datos locales.
- Lee `meta_trimestral` desde `localStorage`.
- Muestra total recolectado, porcentaje de cumplimiento, total de entidades y recolecciones.
- Permite lanzar sincronizacion manual.

### 2. Gestion de entidades

- Crear entidad con nombre, tipo, fecha de visita y link opcional de Drive.
- Editar entidad existente.
- Eliminar entidad con borrado logico y cascada hacia recolecciones y detalles relacionados.
- Marcar cambios como pendientes de sincronizacion con `sync: 1`.

### 3. Gestion de recolecciones

- Crear recoleccion asociada a una entidad.
- Registrar multiples materiales con peso en kg.
- Editar recoleccion y actualizar detalles asociados.
- Eliminar recoleccion con borrado logico en cascada de sus detalles.

### 4. Ajustes / conectividad

- Guardar URL y token del Apps Script en `localStorage`.
- Probar conexion con accion `health`.
- Forzar re-subida marcando todos los registros como pendientes de sincronizacion.

## Modelo de datos

### Entidad

- `id`: tipo `ENT001`
- `nombre`
- `tipo`
- `fechaVisitaGestion`
- `linkCarpetaDrive`
- `sync`
- `deleted`

### Recoleccion

- `id`: tipo `REC001`
- `idEntidad`
- `nombreEntidad`
- `fechaRecoleccion`
- `sync`
- `deleted`

### DetalleMaterial

- `id`: tipo `DET001`
- `idRecoleccion`
- `idEntidad`
- `nombreEntidad`
- `fechaRecoleccion`
- `material`
- `pesoKg`
- `sync`
- `deleted`

## Flujo de sincronizacion

### Subida

1. El frontend toma todos los registros con `sync = 1`.
2. Los envia al Apps Script con accion `sync`.
3. El backend hace upsert o borrado fisico por fila en Sheets.
4. Si el servidor confirma el ID, el frontend marca `sync = 0` o elimina localmente si estaba marcado como `deleted = 1`.

### Descarga

1. El frontend pide `GET_DATA`.
2. Inserta o actualiza localmente cuando no hay cambios locales pendientes.
3. Guarda `metrics.metaTrimestral` en `localStorage`.

## Contrato esperado del backend

El Apps Script trabaja con estas hojas:

- `Entidades`
- `Recolecciones`
- `Detalle Materiales`
- `Dashboard`

Acciones soportadas:

- `health`
- `GET_DATA`
- `sync`

## Comandos utiles

- `npm run dev`
- `npm run build`
- `npm run lint`

## Estado de revision tecnica

### Hallazgos importantes detectados

1. La definicion de versiones de Dexie parece incompleta y puede dejar fuera object stores en instalaciones nuevas o migraciones.
2. El dashboard guarda la meta en `localStorage`, pero ese cambio no es reactivo y puede dejar la cifra visible desactualizada tras `syncDown`.
3. La lista de recolecciones convierte fechas `YYYY-MM-DD` con `new Date(...)`, lo que puede mostrar un dia incorrecto en zonas horarias negativas.
4. La navegacion inferior marca activo solo por igualdad exacta y no resalta la seccion al entrar a rutas hijas como crear o editar.

### Calidad actual

- `npm run build`: exitoso.
- `npm run lint`: falla actualmente por 3 errores.
- No hay suite de tests automatizados en el repo.

## Notas para futuras sesiones de Codex

- Si se toca sincronizacion, revisar juntos frontend y [backend/Code.js](C:\Users\jesus\Documents\Guia\GuiaAppGestionAprovechamiento\backend\Code.js).
- Si se corrige Dexie, validar migraciones reales y no solo TypeScript.
- Si se corrigen fechas, evitar `new Date('YYYY-MM-DD')` para render de fechas locales.
- Si se agregan nuevas entidades del dominio, mantener consistencia entre IndexedDB, tipos y columnas de Sheets.
