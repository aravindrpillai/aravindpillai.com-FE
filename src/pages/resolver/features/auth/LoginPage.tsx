import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/pages/resolver/api/endpoints/auth";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import { Button, Card, Input } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { rpath } from "@/pages/resolver/lib/paths";
import { takeReturnPath } from "@/pages/resolver/lib/storage";
import { CodeInput } from "./CodeInput";
import { useAuth } from "./useAuth";

export default function LoginPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const stateCode = (location.state as { devCode?: string } | null)?.devCode ?? "";
  const config = useQuery({ queryKey: queryKeys.authConfig, queryFn: authApi.config, staleTime: Infinity });
  const codeLength = config.data?.code_length ?? 4;
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState(stateCode);
  const [prefilled, setPrefilled] = useState(Boolean(stateCode));
  const [step, setStep] = useState<"email" | "code">(params.get("step") === "code" ? "code" : "email");
  const { signIn, sessionExpired } = useAuth();
  const navigate = useNavigate();

  const finish = (token: string) => {
    signIn(token);
    navigate(takeReturnPath() ?? params.get("next") ?? rpath("/"), { replace: true });
  };

  const login = useMutation({
    mutationFn: () => authApi.login(email, params.get("case") ?? ""),
    onSuccess: (res) => {
      if (res.token) {
        finish(res.token);
        return;
      }
      setCode(res.dev_code ?? "");
      setPrefilled(Boolean(res.dev_code));
      setStep("code");
    },
  });

  const verify = useMutation({
    mutationFn: () => authApi.verify(email, code),
    onSuccess: (res) => finish(res.token),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") login.mutate();
    else if (code.length === codeLength) verify.mutate();
  };

  const error = step === "email" ? login.error : verify.error;

  return (
    <div className="auth">
      <Card className="auth__card stack">
        <div>
          <div className="auth__icon" aria-hidden="true">
            {step === "email" ? "✉" : "\u{1F511}"}
          </div>
          <h1 className="auth__title" tabIndex={-1}>
            {step === "email" ? strings.auth.title : strings.auth.codeSentTitle}
          </h1>
          <p className="muted">
            {step === "email" ? strings.auth.intro : fmt(strings.auth.codeIntro, { count: codeLength, email })}
          </p>
        </div>
        {sessionExpired && <p className="alert alert--info">{strings.auth.sessionExpired}</p>}
        <form className="stack" onSubmit={onSubmit} noValidate>
          {step === "email" ? (
            <Input
              label={strings.auth.emailLabel}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : (
            <div className="stack-sm">
              <CodeInput length={codeLength} value={code} onChange={setCode} label={strings.auth.codeLabel} />
              {prefilled && <p className="dev-note">{strings.auth.devPrefilled}</p>}
            </div>
          )}
          {error && (
            <p className="alert alert--error" role="alert">
              {errorMessage(error)}
            </p>
          )}
          <Button
            type="submit"
            block
            busy={login.isPending || verify.isPending}
            disabled={step === "code" && code.length !== codeLength}
          >
            {step === "email" ? strings.auth.continue : strings.auth.verify}
          </Button>
          {step === "code" && (
            <div className="row row--between small">
              <Button variant="ghost" size="small" onClick={() => setStep("email")}>
                {strings.auth.useDifferentEmail}
              </Button>
              <Button variant="ghost" size="small" onClick={() => login.mutate()} disabled={login.isPending}>
                {strings.auth.resendCode}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
