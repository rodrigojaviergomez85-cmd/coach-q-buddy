import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOutCleanly, useProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function AppShell() {
  const { profile, isAdmin } = useProfile();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/coaches", label: t("nav_coaches"), icon: Users },
    { to: "/monitoreos", label: t("nav_monitorings"), icon: ClipboardList },
    { to: "/plantillas", label: t("nav_templates"), icon: GraduationCap },
    ...(isAdmin ? [{ to: "/configuracion", label: t("nav_settings"), icon: Settings }] : []),
  ] as const;

  async function handleSignOut() {
    await signOutCleanly(queryClient);
    navigate({ to: "/login", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t("app_name")}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{t("app_tagline")}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="mb-3 flex items-center gap-1 px-2 text-xs">
          <button
            type="button"
            onClick={() => setLang("es")}
            className={cn(
              "rounded px-2 py-1",
              lang === "es"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60",
            )}
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "rounded px-2 py-1",
              lang === "en"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60",
            )}
          >
            EN
          </button>
        </div>
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {t(`role_${profile.role}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          {t("sign_out")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="cerrar"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-panel">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="sr-only">{t("menu")}</span>
          </Button>
          <span className="text-sm font-semibold">{t("app_name")}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
