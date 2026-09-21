# Coach Quality Hub

Quiero construir una app interna llamada QA Coaches E4K para que los coordinadores de English4Kids monitoreen la calidad de las clases de sus coaches. Stack: React + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (auth, base de datos, RLS). Idioma de toda la interfaz: español e ingles. Diseño limpio, tipo dashboard administrativo, mobile-friendly. No uses IA ni APIs externas en este prompt.

En este primer prompt construye SOLO la base: autenticación, roles, tablas, catálogo de coaches y catálogo de plantillas de monitoreo. No construyas todavía el formulario de monitoreo ni el análisis de transcript (vienen en prompts siguientes), pero deja las tablas listas.

1. Autenticación y roles
Login solo con email + código OTP (magic code de Supabase, sin contraseñas). Pantalla /login: campo de email → "Enviar código" → campo de 6 dígitos → entrar.
Tabla profiles (id uuid PK = auth.users.id, email text unique, full_name text, role text check in ('coordinador','senior','admin') default 'coordinador', active boolean default true, created_at). Crear el profile automáticamente con un trigger al registrarse un usuario en auth.users (role por defecto 'coordinador').
Solo pueden entrar emails que existan previamente en profiles con active = true (los admins dan de alta a los coordinadores; si alguien no está en la lista, mostrar "Tu correo no está autorizado. Pide acceso a tu senior").
Roles: coordinador ve y edita solo sus coaches y sus monitoreos; senior ve todo lo de los coordinadores que tiene asignados; admin ve y edita todo, administra usuarios, coaches, plantillas y configuración.
Semilla inicial: crear el profile admin english4callcenters@gmail.com, full_name "Rodrigo".
2. Tablas (con RLS activado en todas)
coaches
  id uuid PK, full_name text not null, email text null,
  coordinator_id uuid null references profiles(id),
  senior_name text null, lob text null, level text null, schedule text null,
  active boolean default true, notes text null, created_at, updated_at

templates                       -- tipos de monitoreo (plantillas de rúbrica)
  id uuid PK, code text unique not null, name text not null, source_sheet text,
  scoring text check in ('points_sum','area_weighted','checklist'),
  subject text default 'coach', active boolean default true,
  has_student_grid boolean default false, notes text, sort_order int

template_items                  -- filas de cada plantilla
  id uuid PK, template_id uuid references templates(id) on delete cascade,
  kind text check in ('item','checklist','penalty','bonus'),
  sort_order int, section text, area text, ss text, item_number text,
  short_label text, description text not null,
  points numeric null, area_points numeric null,
  penalty_kind text null    -- 'auto5' | 'needs_improve'

monitorings                     -- un monitoreo = una clase evaluada
  id uuid PK, coach_id uuid references coaches(id),
  coordinator_id uuid references profiles(id),
  template_id uuid references templates(id),
  qa_date date default current_date, class_date date, syllabus text, schedule text,
  level text, zoom_link text,
  status text check in ('borrador','enviado') default 'borrador',
  transcript_raw text null, transcript_metrics jsonb null,
  base_score numeric null, bonus_total numeric null, penalty_applied boolean default false,
  final_score numeric null, result_phrase text null, customer_expectation text null,
  kudos jsonb default '[]', aois jsonb default '[]', main_aoi text null,
  previous_aois jsonb default '[]', general_comments text null,
  created_at, updated_at

monitoring_answers
  id uuid PK, monitoring_id uuid references monitorings(id) on delete cascade,
  item_id uuid references template_items(id),
  result text check in ('si','no','na') default 'na',
  score numeric null, comment text null,
  unique (monitoring_id, item_id)

monitoring_students             -- grid de estudiantes (Friday QA / Monthly Evaluations)
  id uuid PK, monitoring_id uuid references monitorings(id) on delete cascade,
  student_number int, student_name text, gr numeric, pr numeric, fl numeric, co numeric, "in" numeric,
  score numeric, phrase text, goal boolean, coach_phrase text, comment text

app_config                      -- parámetros editables por admin
  key text PK, value jsonb, description text

Semilla de app_config:

monthly_target → 2 ("Monitoreos meta por coach al mes")
talk_time_green → 70 ("% mínimo de tiempo de alumnos para verde")
talk_time_yellow → 55 ("% mínimo de tiempo de alumnos para amarillo; abajo es rojo")
student_min_pct → 8 ("% mínimo del tiempo de alumnos que debería tener cada alumno")
bonus_points_each → 1 ("Puntos que suma cada bonus marcado")
penalty_cap → 5 ("Puntaje máximo si aplica una penalidad")
score_phrases → [{"min":10,"phrase":"Excellent Plus"},{"min":9,"phrase":"Excellent"},{"min":8,"phrase":"Well Done"},{"min":7,"phrase":"Almost There"},{"min":0,"phrase":"Needs Improvement"}]
expectation_phrases → [{"min":9,"phrase":"Exceeded expectations"},{"min":7,"phrase":"Met expectations"},{"min":0,"phrase":"Below expectations"}]
3. Políticas RLS
profiles: cada usuario lee su propio profile; senior y admin leen todos; solo admin escribe.
coaches: coordinador lee/escribe donde coordinator_id = auth.uid(); senior lee todos; admin todo.
templates, template_items, app_config: lectura para cualquier usuario autenticado; escritura solo admin.
monitorings, monitoring_answers, monitoring_students: coordinador lee/escribe donde coordinator_id = auth.uid() (para answers y students, vía join con monitorings); senior lee todos; admin todo.
Crear una función SQL current_role() que devuelva el role del usuario autenticado, para usarla en las políticas.
4. Pantallas de este prompt

Layout con barra lateral: Mis coaches · Monitoreos (vacío por ahora, deja placeholder) · Plantillas · Configuración (solo admin) · nombre y rol del usuario + cerrar sesión.

/coaches — Mis coaches

Tabla con: nombre, LOB, nivel, horario, coordinador (solo visible para senior/admin), activo, y una columna "Monitoreos este mes" (conteo de monitorings con status='enviado' cuyo qa_date esté en el mes actual) mostrada como X / meta con chip verde si X ≥ meta, amarillo si X ≥ 1, rojo si 0.
Buscador por nombre, filtro activo/inactivo.
Botón "Nuevo coach" (modal) y edición inline.
Botón "Importar CSV" (solo admin y senior): sube un CSV con columnas full_name, email, coordinator_email, senior_name, lob, level, schedule. Empareja coordinator_email con profiles.email; si no existe, deja coordinator_id null y lo reporta en un resumen al final ("12 importados, 3 sin coordinador asignado: …"). Si ya existe un coach con el mismo full_name, actualiza en vez de duplicar.

/plantillas — Plantillas

Lista de templates con: nombre, código, tipo de scoring, activa (switch, solo admin), número de ítems, penalidades y bonus.
Al abrir una plantilla: vista de solo lectura con sus ítems agrupados por sección/área, mostrando kind, puntos, área y descripción. Admin puede editar descripción y puntos de cada ítem y agregar/quitar ítems.
Deja lista una acción admin "Ejecutar seed de plantillas" que corra el contenido del archivo seed_templates.sql (yo lo voy a pegar como migración de Supabase; solo asegúrate de que el esquema de templates y template_items coincida exactamente con las columnas de arriba, porque el seed inserta por code y usa on conflict (code)).

/configuracion — Configuración (admin)

Editar cada app_config con su descripción.
Gestión de usuarios: lista de profiles, cambiar role, activar/desactivar, agregar por email (esto crea el profile en estado "pendiente" hasta que la persona entre por primera vez; el trigger de auth debe respetar un profile preexistente por email y solo enlazar el id).
5. Reglas de negocio que deben quedar como funciones reutilizables (en src/lib/scoring.ts)

Aunque el formulario llega en el prompt 3, implementa ya estas funciones puras con tests básicos:

computeBaseScore(template, items, answers):
points_sum: suma de points de los ítems kind='item' con result='si', reescalada a 10 sobre la suma de puntos de los ítems aplicables (result ≠ 'na'). Ejemplo: plantilla de 50 puntos → se normaliza a 10.
area_weighted: para cada area, area_points × (ítems 'si' / ítems aplicables); base = suma de áreas.
checklist: 10 × (checklist 'si' / checklist aplicables).
computeFinalScore(base, bonusCount, penaltyCount, config): final = min(10, base + bonusCount × bonus_points_each); si penaltyCount > 0, final = min(final, penalty_cap).
phraseFor(score, config.score_phrases) y expectationFor(score, config.expectation_phrases).

Redondear puntajes a 2 decimales. Todas las fechas en zona America/El_Salvador.

See task progress for longer tasks.

QA_Coaches_E4K_Prompt_2.md
QA_Coaches_E4K_Prompt_1.md

Track tools and referenced files used in this task.

Downloaded soporte-conectores-fix-v2.diff Show in Explorer

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://coach-q-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/151043ee-7875-4699-a430-8b68e95c6d3f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
