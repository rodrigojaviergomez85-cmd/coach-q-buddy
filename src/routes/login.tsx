import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Acceso al panel interno de monitoreo de calidad de clases de English4Kids para coordinadores y seniors.",
      },
      { property: "og:title", content: "Entrar · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Panel interno de monitoreo de calidad de clases de English4Kids.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/coaches", replace: true });
    });
  }, [navigate]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data: allowed, error: lookupError } = await supabase.rpc("email_is_authorized", {
      _email: clean,
    });

    if (lookupError) {
      setBusy(false);
      setError(t("error"));
      return;
    }
    if (!allowed) {
      setBusy(false);
      setError(t("not_authorized"));
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStep("code");
    setMessage(t("code_sent"));
  }

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    const clean = email.trim().toLowerCase();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: clean,
      token: value,
      type: "email",
    });
    if (verifyError || !data.session) {
      setBusy(false);
      setCode("");
      setError(t("invalid_code"));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, active")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setBusy(false);
      setCode("");
      setError(t("not_authorized"));
      return;
    }

    navigate({ to: "/coaches", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-panel">
            <GraduationCap className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("app_name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app_tagline")}</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-panel">
          <h2 className="text-lg font-semibold">{t("login_title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("login_subtitle")}</p>

          {step === "email" ? (
            <form className="mt-6 space-y-4" onSubmit={sendCode}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@english4kids.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? t("sending") : t("send_code")}
              </Button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>{t("code_label")}</Label>
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    if (value.length === 6) void verify(value);
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full"
                disabled={busy || code.length < 6}
                onClick={() => void verify(code)}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? t("verifying") : t("enter")}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setMessage(null);
                  }}
                >
                  {t("use_other_email")}
                </button>
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => void sendCode()}
                >
                  {t("resend_code")}
                </button>
              </div>
            </div>
          )}

          {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
          {error ? <p className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setLang("es")}
            className={
              lang === "es" ? "font-semibold text-foreground" : "text-muted-foreground"
            }
          >
            Español
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={
              lang === "en" ? "font-semibold text-foreground" : "text-muted-foreground"
            }
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}
