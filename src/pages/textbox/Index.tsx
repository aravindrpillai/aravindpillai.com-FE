import { useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeCode } from "@/lib/textboxCrypto";
import TextboxSession from "./TextboxSession";

const MAX_CODE = 64;

export default function TextBoxPage() {
  const { code } = useParams();
  const normalized = code ? normalizeCode(code) : "";

  return (
    <>
      <Helmet>
        <title>Textbox · Aravind R Pillai</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* The code is in the URL path: never leak it to other sites via Referer. */}
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      {normalized ? <TextboxSession key={normalized} code={normalized} /> : <CodeEntry />}
    </>
  );
}

function CodeEntry() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const code = normalizeCode(value);
  const valid = code.length > 0 && code.length <= MAX_CODE && !code.includes("/");

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid) navigate(`/textbox/${encodeURIComponent(code)}`);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4">
      <form onSubmit={open} className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-center text-xl font-semibold">Open a textbox</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">
          Enter a code. The same code opens the same textbox on any device.
        </p>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_CODE}
          placeholder="Textbox code"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Textbox code"
          className="h-11 text-base"
        />
        <Button type="submit" disabled={!valid} className="mt-3 h-11 w-full gap-2">
          Open <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          End-to-end encrypted. Your content is encrypted on this device with a key derived from the code before it
          is sent, and the server never sees the code. Pick a long, unguessable code, or add a PIN lock once inside.
        </p>
      </form>
    </div>
  );
}
