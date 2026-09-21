import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "es" | "en";

type Dict = Record<string, { es: string; en: string }>;

const dict: Dict = {
  app_name: { es: "QA Coaches E4K", en: "QA Coaches E4K" },
  app_tagline: { es: "Monitoreo de calidad de clases", en: "Class quality monitoring" },

  // nav
  nav_coaches: { es: "Mis coaches", en: "My coaches" },
  nav_monitorings: { es: "Monitoreos", en: "Monitorings" },
  nav_templates: { es: "Plantillas", en: "Templates" },
  nav_settings: { es: "Configuración", en: "Settings" },
  sign_out: { es: "Cerrar sesión", en: "Sign out" },
  menu: { es: "Menú", en: "Menu" },

  // roles
  role_coordinador: { es: "Coordinador", en: "Coordinator" },
  role_senior: { es: "Senior", en: "Senior" },
  role_admin: { es: "Admin", en: "Admin" },

  // login
  login_title: { es: "Entrar", en: "Sign in" },
  login_subtitle: {
    es: "Acceso solo para el equipo de English4Kids.",
    en: "Access for the English4Kids team only.",
  },
  email: { es: "Correo", en: "Email" },
  send_code: { es: "Enviar código", en: "Send code" },
  sending: { es: "Enviando…", en: "Sending…" },
  code_label: { es: "Código de 6 dígitos (opcional)", en: "6-digit code (optional)" },
  code_sent: {
    es: "Te enviamos un correo. Haz clic en el enlace de acceso para entrar (revisa también tu spam). Si tu correo incluye un código de 6 dígitos, también puedes escribirlo aquí.",
    en: "We sent you an email. Click the sign-in link to enter (check spam too). If your email includes a 6-digit code, you can type it here instead.",
  },
  enter: { es: "Entrar", en: "Enter" },
  verifying: { es: "Verificando…", en: "Verifying…" },
  use_other_email: { es: "Usar otro correo", en: "Use another email" },
  resend_code: { es: "Reenviar código", en: "Resend code" },
  not_authorized: {
    es: "Tu correo no está autorizado. Pide acceso a tu senior.",
    en: "Your email is not authorized. Ask your senior for access.",
  },
  invalid_code: { es: "El código no es válido o ya expiró.", en: "The code is invalid or expired." },

  // common
  search: { es: "Buscar", en: "Search" },
  save: { es: "Guardar", en: "Save" },
  cancel: { es: "Cancelar", en: "Cancel" },
  edit: { es: "Editar", en: "Edit" },
  delete: { es: "Eliminar", en: "Delete" },
  add: { es: "Agregar", en: "Add" },
  loading: { es: "Cargando…", en: "Loading…" },
  saved: { es: "Guardado", en: "Saved" },
  error: { es: "Ocurrió un error", en: "Something went wrong" },
  none: { es: "Sin asignar", en: "Unassigned" },
  all: { es: "Todos", en: "All" },
  active: { es: "Activo", en: "Active" },
  inactive: { es: "Inactivo", en: "Inactive" },
  back: { es: "Volver", en: "Back" },
  empty: { es: "No hay datos todavía.", en: "Nothing here yet." },

  // coaches
  coaches_title: { es: "Mis coaches", en: "My coaches" },
  coaches_subtitle: {
    es: "Coaches asignados y su avance de monitoreos del mes.",
    en: "Assigned coaches and their monitoring progress this month.",
  },
  new_coach: { es: "Nuevo coach", en: "New coach" },
  edit_coach: { es: "Editar coach", en: "Edit coach" },
  import_csv: { es: "Importar CSV", en: "Import CSV" },
  full_name: { es: "Nombre", en: "Name" },
  lob: { es: "LOB", en: "LOB" },
  level: { es: "Nivel", en: "Level" },
  schedule: { es: "Horario", en: "Schedule" },
  coordinator: { es: "Coordinador", en: "Coordinator" },
  senior_name: { es: "Senior", en: "Senior" },
  notes: { es: "Notas", en: "Notes" },
  monitorings_this_month: { es: "Monitoreos este mes", en: "Monitorings this month" },
  search_by_name: { es: "Buscar por nombre…", en: "Search by name…" },
  coach_saved: { es: "Coach guardado", en: "Coach saved" },
  csv_help: {
    es: "Columnas: full_name, email, coordinator_email, senior_name, lob, level, schedule",
    en: "Columns: full_name, email, coordinator_email, senior_name, lob, level, schedule",
  },
  csv_import_title: { es: "Importar coaches desde CSV", en: "Import coaches from CSV" },
  csv_imported: { es: "importados", en: "imported" },
  csv_no_coordinator: { es: "sin coordinador asignado", en: "without an assigned coordinator" },

  // monitorings
  monitorings_title: { es: "Monitoreos", en: "Monitorings" },
  monitorings_placeholder: {
    es: "El formulario de monitoreo llega en la siguiente entrega. Las tablas ya están listas.",
    en: "The monitoring form arrives in the next delivery. The tables are already in place.",
  },

  // templates
  templates_title: { es: "Plantillas", en: "Templates" },
  templates_subtitle: {
    es: "Tipos de monitoreo y sus rúbricas.",
    en: "Monitoring types and their rubrics.",
  },
  code: { es: "Código", en: "Code" },
  scoring: { es: "Tipo de puntaje", en: "Scoring" },
  items: { es: "Ítems", en: "Items" },
  penalties: { es: "Penalidades", en: "Penalties" },
  bonuses: { es: "Bonus", en: "Bonus" },
  section: { es: "Sección", en: "Section" },
  area: { es: "Área", en: "Area" },
  points: { es: "Puntos", en: "Points" },
  area_points: { es: "Puntos de área", en: "Area points" },
  description: { es: "Descripción", en: "Description" },
  kind: { es: "Tipo", en: "Kind" },
  no_templates: {
    es: "Todavía no hay plantillas cargadas. Un admin puede ejecutar el seed de plantillas.",
    en: "No templates loaded yet. An admin can run the templates seed.",
  },
  run_seed: { es: "Ejecutar seed de plantillas", en: "Run templates seed" },
  seed_help: {
    es: "El seed se aplica como migración de base de datos (seed_templates.sql). Este botón verifica y recarga las plantillas cargadas.",
    en: "The seed is applied as a database migration (seed_templates.sql). This button checks and reloads the loaded templates.",
  },
  add_item: { es: "Agregar ítem", en: "Add item" },
  edit_item: { es: "Editar ítem", en: "Edit item" },
  new_item: { es: "Nuevo ítem", en: "New item" },
  item_saved: { es: "Ítem guardado", en: "Item saved" },
  item_deleted: { es: "Ítem eliminado", en: "Item deleted" },
  delete_item_title: { es: "¿Eliminar este ítem?", en: "Delete this item?" },
  delete_item_desc: {
    es: "Esta acción no se puede deshacer.",
    en: "This action cannot be undone.",
  },
  sort_order: { es: "Orden", en: "Order" },
  item_number: { es: "Número", en: "Number" },
  short_label: { es: "Etiqueta corta", en: "Short label" },
  template_updated: { es: "Plantilla actualizada", en: "Template updated" },
  kind_item: { es: "Ítem", en: "Item" },
  kind_checklist: { es: "Checklist", en: "Checklist" },
  kind_penalty: { es: "Penalidad", en: "Penalty" },
  kind_bonus: { es: "Bonus", en: "Bonus" },

  // settings
  settings_title: { es: "Configuración", en: "Settings" },
  settings_params: { es: "Parámetros", en: "Parameters" },
  settings_users: { es: "Usuarios", en: "Users" },
  add_user: { es: "Agregar usuario", en: "Add user" },
  pending: { es: "Pendiente", en: "Pending" },
  role: { es: "Rol", en: "Role" },
  user_added: { es: "Usuario agregado", en: "User added" },
  admin_only: { es: "Solo para administradores.", en: "Admins only." },
  language: { es: "Idioma", en: "Language" },
};

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof typeof dict | string) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: "es",
  setLang: () => {},
  t: (key) => String(key),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const stored = window.localStorage.getItem("e4k_lang");
    if (stored === "es" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("e4k_lang", next);
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = dict[key];
      return entry ? entry[lang] : key;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
