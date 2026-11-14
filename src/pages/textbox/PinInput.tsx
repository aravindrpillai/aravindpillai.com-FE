import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { cn } from "@/lib/utils";

interface PinInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label: string;
}

/** 4-digit numeric PIN entry; digits are masked as dots. */
export default function PinInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true, label }: PinInputProps) {
  return (
    <OTPInput
      maxLength={4}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label={label}
      containerClassName={cn("flex items-center justify-center gap-3 has-[:disabled]:opacity-60", invalid && "animate-shake")}
      render={({ slots }) => <Slots slots={slots} invalid={invalid} />}
    />
  );
}

function Slots({ slots, invalid }: { slots: SlotProps[]; invalid?: boolean }) {
  return (
    <>
      {slots.map((slot, i) => (
        <div
          key={i}
          className={cn(
            "relative flex h-14 w-12 items-center justify-center rounded-xl border-2 bg-background text-2xl transition-all",
            slot.isActive ? "border-primary ring-4 ring-primary/15" : "border-input",
            invalid && "border-destructive"
          )}
        >
          {slot.char ? <span className="h-3 w-3 rounded-full bg-foreground" /> : null}
          {slot.hasFakeCaret && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-px animate-pulse bg-foreground" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
