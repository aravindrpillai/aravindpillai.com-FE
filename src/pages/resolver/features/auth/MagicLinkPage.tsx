import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "@/pages/resolver/api/client";
import { authApi } from "@/pages/resolver/api/endpoints/auth";
import { Button, Card } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { rememberReturnPath } from "@/pages/resolver/lib/storage";
import { useAuth } from "./useAuth";
import { rpath } from "@/pages/resolver/lib/paths";

export default function MagicLinkPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const started = useRef(false);
  const [resent, setResent] = useState(false);

  const redeem = useMutation({
    mutationFn: () => authApi.magic(token),
    onSuccess: (res) => {
      if (res.token) {
        signIn(res.token);
        navigate(rpath(res.redirect), { replace: true });
        return;
      }
      rememberReturnPath(rpath(res.redirect));
      const q = new URLSearchParams({ email: res.email, case: res.case_code, step: "code" });
      navigate(`${rpath("/login")}?${q.toString()}`, { replace: true, state: { devCode: res.dev_code } });
    },
  });
  const resend = useMutation({ mutationFn: () => authApi.resendMagic(token), onSuccess: () => setResent(true) });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    redeem.mutate();
  }, [redeem]);

  const err = redeem.error;
  if (!err) {
    return (
      <p role="status" className="muted" style={{ textAlign: "center", marginTop: "3rem" }}>
        {strings.auth.magicChecking}
      </p>
    );
  }
  const canResend = err instanceof ApiError && err.code === "link_invalid" && err.details.can_resend === true;
  return (
    <Card className="stack" style={{ maxWidth: "30rem", margin: "2rem auto" }}>
      <h1>{strings.auth.magicInvalidTitle}</h1>
      {err instanceof ApiError && err.code === "link_invalid" ? (
        <p>{strings.auth.magicInvalidBody}</p>
      ) : (
        <p className="alert alert--error">{errorMessage(err)}</p>
      )}
      {resent ? (
        <p className="alert alert--info" role="status">
          {strings.auth.newLinkSent}
        </p>
      ) : (
        canResend && (
          <Button onClick={() => resend.mutate()} busy={resend.isPending}>
            {strings.auth.emailNewLink}
          </Button>
        )
      )}
      <Button variant="secondary" onClick={() => navigate(rpath("/login"))}>
        {strings.auth.continue}
      </Button>
    </Card>
  );
}
