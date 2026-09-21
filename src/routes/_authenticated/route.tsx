import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ProfileContext, type Profile } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/login" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = Route.useRouteContext();

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (profile as Profile | null) ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading && (!data || !data.active)) {
      void supabase.auth.signOut().then(() => navigate({ to: "/login", replace: true }));
    }
  }, [data, isLoading, navigate]);

  if (isLoading || !data || !data.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <ProfileContext.Provider
      value={{
        profile: data,
        isAdmin: data.role === "admin",
        isSenior: data.role === "senior",
        canSeeAll: data.role === "admin" || data.role === "senior",
      }}
    >
      <AppShell />
    </ProfileContext.Provider>
  );
}
