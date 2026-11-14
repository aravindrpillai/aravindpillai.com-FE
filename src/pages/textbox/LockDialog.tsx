import { useEffect, useState } from "react";
import { KeyRound, Loader2, Lock, LockOpen, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PinInput from "./PinInput";

export type LockMode = "set" | "change" | "remove";

export interface LockSubmit {
  current?: string;
  next?: string;
}

interface LockDialogProps {
  mode: LockMode | null;
  busy: boolean;
  /** Error reported by the server (wrong current PIN, throttled, conflict...). */
  error: string | null;
  onSubmit: (mode: LockMode, pins: LockSubmit) => void;
  onClose: () => void;
}

type Step = "current" | "next" | "confirm";

const STEPS: Record<LockMode, Step[]> = {
  set: ["next", "confirm"],
  change: ["current", "next", "confirm"],
  remove: ["current"],
};

const COPY: Record<LockMode, { title: string; icon: typeof Lock; action: string }> = {
  set: { title: "Lock this textbox", icon: Lock, action: "Lock textbox" },
  change: { title: "Change PIN", icon: KeyRound, action: "Change PIN" },
  remove: { title: "Remove lock", icon: LockOpen, action: "Remove lock" },
};

const PROMPT: Record<Step, string> = {
  current: "Enter the current PIN",
  next: "Choose a new 4-digit PIN",
  confirm: "Enter the new PIN again",
};

export default function LockDialog({ mode, busy, error, onSubmit, onClose }: LockDialogProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<Step, string>>({ current: "", next: "", confirm: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset whenever the dialog opens.
  useEffect(() => {
    setStepIdx(0);
    setValues({ current: "", next: "", confirm: "" });
    setLocalError(null);
  }, [mode]);

  // A server-side error about the current PIN sends the user back to that step.
  useEffect(() => {
    if (error && mode && STEPS[mode][0] === "current") {
      setStepIdx(0);
      setValues({ current: "", next: "", confirm: "" });
    }
  }, [error, mode]);

  if (!mode) return null;
  const steps = STEPS[mode];
  const step = steps[stepIdx];
  const { title, icon: Icon, action } = COPY[mode];
  const isLast = stepIdx === steps.length - 1;
  const shownError = localError ?? error;

  const advance = (v: string) => {
    if (v.length !== 4 || busy) return;
    setLocalError(null);
    if (step === "confirm" && v !== values.next) {
      setLocalError("PINs don't match. Try again.");
      setValues((s) => ({ ...s, next: "", confirm: "" }));
      setStepIdx(steps.indexOf("next"));
      return;
    }
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    const final = { ...values, [step]: v };
    onSubmit(mode, {
      current: steps.includes("current") ? final.current : undefined,
      next: steps.includes("next") ? final.next : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "set" && "Anyone opening this textbox will need the PIN. The content is re-encrypted with a key derived from it."}
            {mode === "change" && "The content will be re-encrypted with the new PIN. Other devices will be asked for it."}
            {mode === "remove" && "The content will be re-encrypted with the textbox code only. Anyone with the code can open it."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-sm font-medium text-foreground">{PROMPT[step]}</p>
          <PinInput
            key={`${mode}-${step}`}
            label={PROMPT[step]}
            value={values[step]}
            onChange={(v) => setValues((s) => ({ ...s, [step]: v }))}
            onComplete={advance}
            disabled={busy}
            invalid={!!shownError}
          />
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 w-6 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p role="alert" className="min-h-[1.25rem] text-center text-sm text-destructive">{shownError}</p>

          {mode !== "remove" && (
            <div className="flex w-full items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>If the PIN is forgotten the content can't be recovered, not even by the server.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => advance(values[step])} disabled={busy || values[step].length !== 4} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLast ? action : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
