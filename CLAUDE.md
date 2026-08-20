# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Qué es esto

**Casa** (`family-hub`): PWA mobile-first para la organización de un hogar. Una familia = un
tenant. Tablero de notas tipo heladera en tiempo real, planner semanal con tareas recurrentes
rotativas, listas de compras compartidas, el expediente de salud de cada integrante con su caja
fuerte documental, y —en fases siguientes— finanzas del hogar y menú semanal. Se instala en el
teléfono y manda Web Push.

Está en castellano rioplatense, de punta a punta: la UI, los mensajes de error, los nombres de
las rutas (`/ingresar`, `/planner`, `/compras`) y los comentarios. El código (identificadores,
tablas, columnas) está en inglés.

## Comandos

```bash
npm run dev              # next dev --webpack (ver "Por qué --webpack")
npm run build            # build de producción
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test:unit        # vitest run tests/unit — lógica pura, sin red
npm run test:rls         # vitest run tests/rls — pega contra el proyecto REAL
npm run test:e2e         # playwright — también contra el proyecto real
npm run db:push          # aplica supabase/migrations/ al proyecto hosteado
npm run db:seed          # BORRA y resiembra las dos familias de prueba
npm run icons            # regenera los íconos de la PWA
npm run push:keys        # genera un par de claves VAPID nuevo
```

Un solo archivo: `npx vitest run tests/unit/recurrence.test.ts` o
`npx playwright test tests/e2e/rutina-diaria.spec.ts`.

**`test:rls` y `test:e2e` no están mockeados.** No hay Docker en esta máquina, así que no hay
Supabase local: las dos suites corren contra el proyecto hosteado usando `.env.local`, y
`db:seed` borra usuarios. No correrlas contra un proyecto con los datos reales de la familia.

**Migraciones**: escribir un archivo nuevo en `supabase/migrations/` (nunca editar uno ya
aplicado) y correr `npm run db:push`. Como no hay Docker, `supabase start`, `supabase db reset` y
`supabase gen types` no funcionan acá: **`src/types/database.ts` se mantiene a mano** y hay que
actualizarlo en el mismo commit que la migración.

## Puesta en marcha

1. Crear un proyecto de Supabase **dedicado** (no compartirlo con otros proyectos).
2. Copiar `.env.example` a `.env.local` y completar las claves.
3. `npm run push:keys` y pegar las dos claves VAPID en `.env.local`.
4. `npm run db:push`.
5. **Habilitar el hook a mano**: Dashboard → Authentication → Hooks → Custom Access Token →
   `public.custom_access_token_hook`. Sin esto todos los usuarios ven todo vacío y no hay ningún
   error visible que explique por qué.
6. Apagar "Confirm email" (Authentication → Providers → Email). Son cuatro cuentas creadas por la
   propia familia; el mail de confirmación solo agrega un paso donde alguien se traba.

## Arquitectura

### La frontera de seguridad es RLS, no el código

Cada tabla de tenant tiene `family_id` y policies. **El código de aplicación nunca filtra por
`family_id`** — ni en las queries ni en los inserts. Un `custom_access_token_hook`
(`20260820120100_auth_claims.sql`) estampa `family_id` y `user_role` como claims del JWT al
emitirlo, y las policies leen `auth.jwt()` directo, sin subconsulta por fila y sin recursar sobre
`profiles`.

El claim se llama `user_role` y **no `role`**: PostgREST reserva `role` para elegir el rol de
Postgres con el que conecta, y poner `parent` ahí intentaría un `SET ROLE parent`.

En los inserts, `family_id` lo pone un trigger (`set_family_id`, `20260820121100`), no el cliente.
Un trigger `BEFORE INSERT` corre antes del chequeo de `NOT NULL`, así que la columna sigue siendo
obligatoria y el front puede omitirla. Lo mismo con la autoría (`set_author_member`).

`src/proxy.ts` es el middleware (Next 16 renombró el archivo, no es una convención de acá) y es
**solo una compuerta de UX**. Quien lo saltee no lee ni una fila.

El admin client (`src/lib/supabase/admin.ts`, service role) se usa únicamente donde RLS no puede
aplicar: mandar Web Push a *otros* integrantes y el cron del resumen semanal, que corre sin
sesión.

### Integrantes ≠ usuarios

- `profiles` — alguien que puede iniciar sesión. Solo lleva lo que decide **permisos**
  (`role`, `is_active`).
- `family_members` — toda persona de la casa, tenga cuenta o no. Julián no tiene login pero sí
  ficha, talles y tareas asignadas.

**Todo lo que pertenece a una persona apunta a `family_member_id`, nunca a `profile_id`.** Es lo
que hace que el expediente de la Fase 2 sirva igual para mamá y papá sin ninguna migración.

Quien se une con el código de invitación entra **siempre como `child`**, incluso el otro adulto de
la pareja. Si el rol lo eligiera quien se une, cualquiera con el código se auto-promovería a
administrador. Un `parent` lo asciende con un toque desde `/familia`.

### Tareas: dos niveles, y no se negocia

```
tasks           = la REGLA      ("lavar sábanas cada 15 días, rotando")
task_instances  = la OCURRENCIA ("el 3/9 le toca a papá")
```

Calcular las fechas al vuelo parece más simple hasta que hace falta posponer *una* semana,
reasignar *una* vez, o saber quién limpió el baño en julio. Una tarea puntual es una regla con
`recurrence = null` y una sola ocurrencia (trigger `tasks_seed_one_off`), así el planner nunca
mira dos tablas.

`ensure_task_instances()` es idempotente — el `unique (task_id, due_date)` absorbe lo ya
generado — y se llama en cada carga del planner y del inicio.

**`src/lib/tasks/recurrence.ts` y `ensure_task_instances()` son la misma lógica escrita dos
veces** (la de SQL materializa, la de TS previsualiza). **Cambian juntas o no cambian.**
`tests/unit/recurrence.test.ts` cubre los casos que se rompen solos: fin de mes, el 31 en febrero,
el `from` que no corre el ancla, el techo de horizonte colgado de *hoy* y no de `starts_on`.

### El expediente es la excepción de permisos

Casi toda la app la usan por igual adultos y chicos. El expediente NO: las nueve
tablas de la Fase 2 (`member_details`, `documents`, `medications`, `vaccines`,
`medical_visits`, `growth_records`, `milestones`, `member_sizes`) exigen
`is_parent()` en sus policies, y las policies se generan en un bucle
(`20260820130100_rls_records.sql`) justamente para que no exista la que se
escribió a mano y se olvidó el chequeo.

`contacts` es la única de ese grupo que lee toda la casa: el teléfono del
pediatra sirve sobre todo cuando el adulto no está.

La otra puerta es `emergency_card()`, una función SECURITY DEFINER que le
devuelve a cualquier integrante un subconjunto acotado —grupo sanguíneo,
alergias, condiciones y medicación activa— y nada más. Devuelve **columnas
explícitas y no `select *`** a propósito: agregar una columna sensible a
`member_details` no la filtra por accidente. `tests/rls/isolation.test.ts`
verifica la lista exacta de columnas que devuelve.

### Finanzas: porcentajes en basis points, y la suma NO tiene constraint

Los porcentajes del reparto se guardan como enteros en basis points
(`10000` = 100%), nunca como decimales: con `0.35` y compañía, seis rubros que
"suman 100%" terminan sumando 99.99 y el reparto muestra una diferencia
inexplicable.

Deliberadamente **no hay un CHECK que obligue a que sumen 10000**. Un constraint
así haría imposible editar: bajar un rubro del 35% al 30% dejaría el total en
9500 y la base rechazaría el UPDATE antes de poder subir otro. La validación
vive en la pantalla, que muestra cuánto falta o cuánto sobra mientras se edita.

`summarizeBudget()` reparte sobre 10000 bp y **no sobre la suma real**: si los
rubros suman 90%, el 10% restante queda visible como "sin asignar" en vez de
inflarse entre los rubros existentes. Es la diferencia entre "te falta asignar
plata" y "la plata se fue sola a algún lado".

El estado de un vencimiento (`pagado` / `vencido` / `por-vencer` / `pendiente`)
se **deriva** de `paid_on` y de la fecha; no hay columna `status`. Una columna
editable a mano dejaría filas "pagadas" sin fecha de pago.

### Los tres canales redundantes de Realtime

`use-notes-realtime.ts` y `use-shopping-realtime.ts` combinan Realtime + poll de 30s + refetch al
recuperar el foco. **Leer el comentario de `use-notes-realtime.ts` antes de "simplificarlo" a
solo Realtime**: cada canal tapa un agujero que los otros dos no ven, y el síntoma de que falten
es un tablero que miente sin avisar.

### Por qué `next build --webpack`

Next 16 usa Turbopack por defecto, pero `@serwist/next` es un plugin de webpack sin soporte
estable todavía. La alternativa genera `public/sw.js` en un paso posterior al build, que es un
modo de falla peor para un deploy. Revisar cuando Serwist soporte Turbopack.

## Convenciones no obvias

- **La plata es siempre centavos enteros** (`est_price_cents`, etc.), nunca float ni `numeric`.
  `src/lib/money.ts` tiene la única lógica de formato y parseo. `splitByBasisPoints()` reparte por
  porcentajes sin perder centavos por redondeo — es lo que va a usar el motor de presupuesto.
- **Los porcentajes se guardan en basis points enteros** (10000 = 100%), no en decimales.
- **Las columnas tipo enum son `text` + `CHECK`**, nunca `ENUM` de Postgres: agregar una categoría
  es una migración de una línea en vez de un `ALTER TYPE`.
- **Las filas de `src/types/database.ts` usan `type`, nunca `interface`.** supabase-js exige
  compatibilidad con `Record<string, unknown>`; una `interface` no tiene índice implícito y los
  tipos `Insert` se resuelven a `never` en silencio, sin ningún error que apunte a la causa. Cada
  tabla además necesita `Relationships` o los selects embebidos no tipan.
- **`refreshSession()` después de `create_family` / `join_family`.** Los claims se estampan al
  emitir el token, así que justo después de la RPC el token en mano todavía dice que el usuario no
  tiene familia. Sin esa línea todo compila, todo "anda", y la pantalla queda vacía. Ver
  `src/lib/auth/onboarding.ts`.
- **Argentina no tiene horario de verano desde 2009**, así que `src/lib/dates.ts` asume un offset
  fijo de `-03:00` y no usa librería de husos. Toda la aritmética de fechas es en UTC para que no
  dependa de dónde corra el proceso. Si esto se reusa para otra región, ese archivo se rehace
  entero — no alcanza con cambiar la constante.
- **La semana del planner arranca el lunes.** El domingo pertenece a la semana que *termina*, no a
  la que empieza: el domingo a la noche, cuando se mira el resumen, la semana en curso es la que
  arrancó el lunes anterior.
- **La bottom nav tiene cinco destinos, no seis.** Finanzas vive dentro de "Más". Seis pestañas en
  un teléfono de 360px dan celdas de 60px donde el texto se corta y el pulgar erra.
- **El service worker nunca cachea datos** — solo el app shell y las fuentes. Una lista de compras
  cacheada hace que dos personas compren lo mismo dos veces.
- **Push en iPhone solo funciona con la PWA instalada en la pantalla de inicio.** Es un límite de
  Apple. `pushSupport()` en `src/lib/push/client.ts` distingue "no se puede" de "hay que
  instalarla primero" justamente para poder decirlo; sin ese matiz el usuario toca el botón, no
  pasa nada, y concluye que la app está rota.
- **El cron de Vercel corre todos los días y filtra el domingo en el código.** El plan hobby
  permite una ejecución diaria, y pagar un plan por un push semanal no tiene sentido.
- **Los buckets de Storage son privados y se leen por URL firmada de corta duración.** La
  convención de ruta es `{family_id}/{member_id}/{uuid}.{ext}` y el primer segmento es lo que la
  policy compara. Vale también para `avatars`, aunque una foto de perfil no sea un documento
  legal: un solo patrón evita que alguien copie el de avatares creyendo que sirve para un carnet
  de vacunas.
- **Las escrituras rápidas van directo del cliente a Supabase**, sin Server Action: RLS ya
  autoriza cada fila y el viaje corto es lo que hace que tildar se sienta instantáneo.
- **En un insert de VARIAS filas, todas tienen que llevar las mismas claves.** PostgREST arma
  un solo `INSERT` con la unión de las claves y manda `NULL` explícito donde falte una, en vez
  de dejar actuar al `DEFAULT`. Con una columna `NOT NULL DEFAULT`, omitirla en una sola fila
  hace fallar el lote entero. Costó encontrarlo una vez (`is_pinned` en `notes`); no vale la
  pena una segunda.
- **Borrar una cuenta NO borra al integrante.** `family_members` sobrevive con `kind` pasado a
  `dependent` (trigger de `20260820140000`), porque de esa fila cuelgan las tareas que hizo y
  su expediente. Antes de ese trigger, el `on delete set null` sobre `profile_id` violaba el
  CHECK de la tabla y hacía que borrar un usuario fallara con un
  "Database error deleting user" que no explicaba nada.
- **Peso y talla van en enteros de la unidad más chica** (gramos, milímetros), igual que la
  plata en centavos. `src/lib/records/measures.ts` tiene el parseo y el formato, y acepta coma
  decimal porque es como se tipea acá.
- **Los adjuntos se comprimen en el cliente antes de subir** (WebP, tope 2000px). Sin eso, veinte
  fotos de celular sin tocar se comen medio free tier de Storage sin que nadie note la
  diferencia al mirarlas. Los PDF pasan tal cual: recomprimirlos los rompe o los agranda.
- **Si el insert de `documents` falla después de subir el archivo, el archivo se borra.** Al
  revés quedaría un huérfano invisible ocupando espacio que nadie puede eliminar desde la app.
- **`npm run db:seed` corta ante cualquier error.** Una versión anterior los ignoraba y decía
  "Listo" con media base vacía; los tests de RLS fallaban por falta de datos y parecía un
  problema de policies.

## Estado del proyecto

**Fase 1 (MVP) — implementada.** Auth, alta de familia con código de invitación, heladera con
notas en vivo, planner semanal con tareas recurrentes y rotación, compras con tachado en tiempo
real, PWA instalable, Web Push y resumen del domingo.

**Fase 2 (expediente) — implementada.** Datos personales y legales, medicamentos, vacunas,
consultas, peso/talla, hitos y talles; caja fuerte documental con bucket privado y subida desde
la cámara; contactos; y la ficha de emergencia offline (`/emergencia`), que es la única pantalla
con datos que el service worker cachea.

**Fase 3 (finanzas) — implementada.** Ingresos por integrante y por mes, motor de reparto por
porcentajes configurables con los seis rubros sembrados al crear la familia, y vencimientos
ordenados cronológicamente con estado derivado. Solo la ven los adultos, como el expediente.

**Falta:** menú semanal y despensa (Fase 4). El plan completo está en
`C:\Users\gaato\.claude\plans\quiero-desarrollar-una-web-keen-sunbeam.md`.
