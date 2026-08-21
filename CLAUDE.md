# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Qué es esto

**Hornero** (`hornero`): PWA para la organización de un hogar. Una familia = un tenant. Tablero
de notas tipo heladera en tiempo real, vista diaria con bloques de horarios, planner semanal con
tareas recurrentes rotativas, objetivos partidos en pasos, listas de compras compartidas, el
expediente de salud de cada integrante con su caja fuerte documental, finanzas del hogar y menú
semanal. Se instala en el teléfono y manda Web Push.

**El nombre.** El hornero construye su nido de barro, y lo construye en pareja: los dos levantan
la casa capa por capa. De ahí sale también la paleta — el nido es de barro, y por eso el color
que da órdenes en toda la app es terracota. El nombre vive en `src/lib/brand.ts` y no repetido
por veinte archivos, justamente para que cambiarlo sea una línea.

**Mobile-first pero no mobile-only.** Quien administra la casa trabaja en una pantalla grande y
el resto de la familia usa el teléfono. Las dos formas están en el mismo shell
(`src/app/(app)/layout.tsx`): barra lateral con los doce destinos en `lg`, barra de cinco
pestañas abajo en el teléfono. Ver "El escritorio no es el teléfono estirado".

Está en castellano rioplatense, de punta a punta: la UI, los mensajes de error, los nombres de
las rutas (`/ingresar`, `/dia`, `/planner`, `/compras`) y los comentarios. El código
(identificadores, tablas, columnas) está en inglés.

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

### Comidas: la cadena que justifica el módulo

El módulo no existe para "tener recetas", sino para que del menú de la semana
salga sola la lista del súper:

```
meal_plan -> recipe_ingredients -> (descontar pantry_items) -> shopping_items
```

Todo el modelo está armado alrededor de esa cadena. Por eso
`recipe_ingredients.name` es texto libre y `pantry_item_id` es OPCIONAL:
escribir "2 cebollas" tiene que funcionar sin dar de alta "cebolla" como
producto primero. Un catálogo obligatorio es lo que hace que nadie cargue
nunca una receta.

`generate_shopping_from_meals()` corre entera en Postgres, en una transacción.
Agrupa por nombre normalizado (dos recetas con cebolla no dan dos renglones),
**solo descuenta la despensa si el ingrediente está vinculado Y las unidades
coinciden** —restar "200 g" de "1 paquete" daría un número inventado, y una
lista del súper que miente es peor que no tenerla—, y no duplica lo que ya está
sin tildar, así que se puede correr dos veces sin miedo.

`meal_plan` acepta receta O texto libre, nunca las dos ni ninguna (CHECK): la
mitad de las cenas de una casa son "sobras" o "pizza", y obligar a cargar una
receta para cada una dejaría el menú a medio llenar.

A diferencia del expediente y de finanzas, estas tablas **no** exigen
`is_parent()`. Que un chico anote que quiere milanesas el jueves, o avise que
se acabó la leche, es el punto.

### Bloques de horarios: la cuarta cosa, y no una tarea más

Hay cuatro entidades de tiempo y conviene no confundirlas:

```
tasks        = lo que HAY QUE HACER y se tilda   ("lavar sábanas")
events       = lo que PASA en un momento          ("dentista 14:00")
goals        = a dónde QUIERE LLEGAR la casa      ("ordenar el garage")
time_blocks  = la FORMA del día, lo que ya está   ("mamá trabaja 9 a 18")
```

Un bloque **no se tilda y no se cumple**: describe dónde está cada uno. Es lo que contesta "¿puedo
pedirle a papá que lo lleve al club a las 17?" sin preguntar.

Por eso, y a diferencia de las tareas, **los bloques no se materializan**. Una casa tiene veinte o
treinta bloques en total; expandirlos a la fecha que se está mirando cuesta menos que una query, y
así hay UNA sola implementación de la regla (`src/lib/agenda/blocks.ts`) en vez de dos que se
pueden desincronizar — que es justo el problema que arrastran `ensure_task_instances()` y
`recurrence.ts`.

Un bloque es recurrente por día de semana (`weekdays`, ISO 1..7) **o** puntual de una fecha
(`on_date`), nunca las dos cosas: un CHECK lo impide, porque una fila que sea las dos no tiene
forma de mostrarse. `starts_on` / `ends_on` acotan al recurrente, así "mamá cambió de horario en
marzo" se resuelve cerrando el bloque viejo en vez de borrarlo y el planner de febrero sigue
siendo cierto.

**Los bloques no cruzan la medianoche** (`ends_at > starts_at`). Un turno noche de 22 a 06 se carga
como dos bloques. Permitir el cruce obligaría a que toda la aritmética de la vista diaria maneje
bloques que empiezan ayer, y el 99% de los bloques de una casa no cruzan nada.

`assignLanes()` reparte los solapados en columnas, y el ancho lo decide el **racimo** de solapados
y no el día entero: si a las 9 hay tres cosas en paralelo pero a las 21 hay una sola, la de las 21
ocupa todo el ancho. Es lo único de la línea de tiempo que se rompe en silencio —el bloque de
abajo simplemente desaparece— así que está cubierto en `tests/unit/blocks.test.ts`.

### Objetivos: el estado NO se deriva de los pasos

Al revés de lo que hace `expenses` con `paid_on`, `goals.status` es una columna que pone una
persona. La diferencia es real: un vencimiento está pagado o no lo está, pero un objetivo se puede
dar por logrado con dos pasos sin tildar (se resolvió de otra forma) o seguir abierto con todos
tildados (faltaba algo que nadie anotó). Derivarlo obligaría a inventar pasos para poder cerrarlo.

Lo que sí sella la base es la **fecha**: `goals_stamp_achieved` pone `achieved_on` al pasar a
"logrado" y la borra al reabrir — un objetivo reabierto con fecha de logro es una fila que se
contradice a sí misma. Igual que `goal_steps_stamp_done` con quién tildó cada paso.

Un paso **no es una `task`**: no se repite, no rota, no genera ocurrencias. Meterlos en `tasks`
habría contaminado el planner con cincuenta filas que no son del día a día de la casa.

Y las policies de objetivos **no** piden `is_parent()`: el valor del módulo es que alguien agarre
un paso que no es suyo, y pedir permiso para ayudar no tiene sentido.

### El escritorio no es el teléfono estirado

Estirar el layout de 360px a 1600px deja una columna flaca en el medio y dos desiertos a los
costados. Peor: deja "Más" —un menú que existe solo porque en el teléfono no entran seis
pestañas— en una pantalla donde entran veinte. Entonces:

- En `lg`, barra lateral con **los doce destinos a la vista**; la barra inferior no existe.
- El contenido llega a `max-w-6xl` y **no más**: una lista de tareas de 1800px es ilegible, el ojo
  pierde el renglón. Las pantallas que aprovechan el ancho (el panel, la semana, objetivos) abren
  su propia grilla adentro de ese contenedor; las que son una lista y nada más (compras) se acotan
  todavía más con `lg:max-w-3xl`.
- `SheetContent` cambia de forma: hoja inferior en el teléfono, **diálogo centrado** en `lg`. Es el
  mismo componente porque es el mismo formulario — duplicarlo garantiza que en tres meses el de
  escritorio no tenga el campo nuevo.
- `/mas` sigue existiendo en escritorio aunque sea redundante con la barra lateral: quien viene del
  teléfono busca las cosas ahí, y esconderlas según el tamaño de pantalla obliga a aprender dos
  mapas de la misma app.

### La hora que se mueve sola

La franja de "ahora / lo que sigue" mentiría si se calculara una sola vez: una pestaña abierta
desde la mañana diría "ahora" con la información de hace tres horas.

`src/lib/agenda/now-store.ts` es un store externo que late cada 30 segundos, y los componentes lo
leen con `useSyncExternalStore`. **El snapshot del servidor lo pasa la pantalla** (`serverNowMinutes`,
el mismo valor con el que renderizó), así que el HTML del servidor y el primer render del cliente
coinciden y recién después empieza a latir. Un `setInterval` con `setState` adentro de un efecto
haría lo mismo pero con un render extra en la hidratación — y lo prohíbe
`react-hooks/set-state-in-effect`, que es la misma regla que ya obligó a `theme.ts` y a
`emergency-cache.ts`.

### Los tres canales redundantes de Realtime

`use-notes-realtime.ts` y `use-shopping-realtime.ts` combinan Realtime + poll de 30s + refetch al
recuperar el foco. **Leer el comentario de `use-notes-realtime.ts` antes de "simplificarlo" a
solo Realtime**: cada canal tapa un agujero que los otros dos no ven, y el síntoma de que falten
es un tablero que miente sin avisar.

### El sistema visual: la jerarquía la hacen las sombras, no los bordes

Tres reglas sostienen todo lo demás, y están en el encabezado de `globals.css`:

1. **La terracota manda.** Es el único color que da órdenes: botones primarios, pestaña activa, lo
   que hay que tocar. Si algo es terracota, se toca.
2. **El azul informa y el verde confirma.** Nunca al revés: un verde en un botón de acción hace que
   "listo" y "hacelo" se parezcan demasiado.
3. **Los bordes duros aplanan.** Veinte rectángulos con la misma línea gris alrededor no tienen
   jerarquía, tienen empate. `Card` no lleva borde: la separación la hace la sombra, y el borde
   queda reservado para las tarjetas que avisan algo (`tone`).

Los grises son **cálidos a propósito** (tiran a marrón, no a azul): un gris frío sobre un naranja
lo ensucia.

Dos tipografías y no una: **Quicksand** para títulos (redondeada, amable) y **Nunito Sans** para
cuerpo (mantiene la redondez pero se lee a 13px, que es donde vive casi toda la app). Los `h1`,
`h2` y `h3` toman `font-display` desde `@layer base`, así que no hay que acordarse en cada
pantalla. Caveat sigue siendo solo para los papelitos de la heladera.

Todo color nuevo va como variable en `:root` **y** en `.dark`, y se expone en `@theme inline`.
Un color escrito directo en una clase se olvida del modo oscuro el mismo día que se escribe.

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
- **La barra inferior tiene cinco destinos, no seis.** Seis pestañas en un teléfono de 360px dan
  celdas de 60px donde el texto se corta y el pulgar erra. Lo que no entra vive en "Más" — y en la
  barra lateral de escritorio, donde entra todo junto. "Hoy" se ganó su lugar sacando a "Familia":
  el expediente se abre dos veces por mes y el día se mira ocho veces por día.
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
  pena una segunda. Vale también para los ingredientes de una receta y para el volcado de la
  despensa a la lista.
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
- **La semana se guarda en ISO: 1 = lunes ... 7 = domingo.** `getUTCDay()` devuelve 0 el domingo,
  que además de no ser ISO lo pone al principio de la semana. La conversión vive en `isoWeekday()`
  y en ningún otro lado: un bloque de domingo guardado como 7 y leído como 0 desaparece del
  calendario entero sin ningún error que lo explique.
- **`formatTime` fuerza `hour12: false`.** `es-AR` por defecto da "08:58 p. m.", que ocupa el doble
  de ancho y no es como se dice la hora acá — y no coincidiría con las horas de los bloques, que
  salen de un `time` de Postgres.
- **Los bloques de horarios trabajan en minutos desde la medianoche**, no en `Date`. Es la unidad
  con la que se dibuja (una posición en píxeles es una regla de tres) y evita crear veinte objetos
  `Date` por render.
- **Un objetivo sin pasos vale 0, nunca `NaN`.** `NaN` se propaga a un `width: NaN%` y la barra
  desaparece sin error. Mismo criterio en `summarizeGoals`, que promedia sobre **los pasos** y no
  sobre los objetivos: uno de un paso no puede pesar lo mismo que uno de veinte.
- **El destino nuevo se agrega en `src/lib/nav.ts` y en ningún otro lado.** De ahí salen la barra
  lateral, la barra inferior y la grilla de `/mas`. Agregarlo en uno solo es cómo se consigue que
  la app tenga dos mapas distintos según la pantalla.
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

**Fase 4 (comidas) — implementada.** Menú semanal por almuerzo y cena, recetas con
ingredientes, despensa con vencimientos y mínimos de reposición, y el botón que vuelca a la
lista del súper lo que falta.

**Fase 5 (identidad, escritorio, objetivos y bloques) — implementada.** La app pasó a llamarse
Hornero y tiene sistema visual propio; barra lateral y diálogos centrados en escritorio; vista
diaria con línea de tiempo, "ahora / lo que sigue" y bloques solapados en columnas; vista semanal
de horarios dentro del planner; objetivos con pasos asignables; y un panel de control reordenado
por la pregunta que contesta cada franja en vez de por orden de aparición.

**Ideas anotadas y todavía no construidas:** vencimientos del hogar y el auto (VTV, seguro,
service, garrafa), álbum de recuerdos con cumpleaños, y un panel de equidad que muestre el reparto
real de tareas. El plan original está en
`C:\Users\gaato\.claude\plans\quiero-desarrollar-una-web-keen-sunbeam.md`.
