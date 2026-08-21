# Casa

PWA de organización familiar. Notas en la heladera, planner semanal, tareas de la casa y listas de
compras — todo compartido entre los integrantes, instalable en el teléfono y con avisos push.

## Qué tiene

- **La heladera** — notas en vivo que ven todos, como papelitos pegados.
- **La semana** — planner con eventos y tareas de la casa, con recurrencia
  ("cada 15 días", "lunes y jueves") y rotación automática de responsables.
- **Compras** — seis listas, tachado en tiempo real, artículos frecuentes.
- **Familia** — expediente de salud de cada integrante (medicamentos, vacunas,
  consultas, peso y talla, hitos, talles), caja fuerte de documentos y contactos.
- **Emergencia** — grupo sanguíneo, alergias y medicación actual, en una
  pantalla que abre sin internet.
- **Finanzas** — ingresos, reparto del fondo común por porcentajes y
  vencimientos ordenados por fecha. Solo para los adultos.
- **Comidas** — menú semanal, recetas y despensa, con un botón que arma la
  lista del súper con lo que falta.

## Puesta en marcha

```bash
npm install
```

### 1. Supabase

Crear un proyecto **dedicado** en [supabase.com](https://supabase.com) (no reusar el de otro
proyecto: la base y el storage quedan aislados). Después, copiar `.env.example` a `.env.local` y
completar con los datos de Project Settings → API y Settings → Database.

### 2. Claves de notificaciones

```bash
npm run push:keys
```

Pegar las tres líneas que imprime en `.env.local`.

### 3. Base de datos

```bash
npm run db:push
```

### 4. Habilitar el hook de sesión

En el Dashboard de Supabase: **Authentication → Hooks → Custom Access Token** y elegir
`public.custom_access_token_hook`.

> Este paso es manual y es el que más se olvida. Sin él la app entra pero todas las pantallas se
> ven vacías, sin ningún mensaje de error.

También conviene apagar **Authentication → Providers → Email → Confirm email**: son unas pocas
cuentas creadas por la propia familia y el mail de confirmación solo agrega un paso donde alguien
se traba.

### 5. Arrancar

```bash
npm run dev
```

Entrar a `http://localhost:3000`, crear una cuenta y después la familia. El código de invitación
que aparece en **Familia** es lo que se comparte con el resto.

## Instalarla en el teléfono

- **Android**: Chrome muestra el aviso de instalar solo. Si no aparece, menú → "Instalar app".
- **iPhone**: botón Compartir → "Agregar a inicio". **Los avisos push solo funcionan con la app
  instalada así** — es una limitación de Apple, no de la app.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run typecheck    # tipos
npm run lint         # eslint
npm run test:unit    # lógica pura (recurrencia, plata, fechas)
npm run test:rls     # aislamiento entre familias — pega contra el proyecto real
npm run test:e2e     # recorrido completo en viewport de teléfono
npm run db:push      # aplicar migraciones
npm run db:seed      # sembrar dos familias de prueba (BORRA los usuarios de prueba)
npm run icons        # regenerar los íconos de la PWA
```

## Deploy

Vercel, con las mismas variables de `.env.local` cargadas en el proyecto (menos
`SUPABASE_DB_PASSWORD`, que solo se usa localmente). `vercel.json` ya deja configurado el cron del
resumen semanal; hay que definir `CRON_SECRET` en Vercel para que la ruta no quede abierta.

## Cómo está armado

Next 16 · React 19 · Supabase (Postgres + Auth + Storage + Realtime) · Tailwind 4 · Serwist.

Los detalles de arquitectura y las decisiones que no son obvias están en [CLAUDE.md](CLAUDE.md).
