import { useEffect, useState, type FormEvent } from "react";
import type { PartyDraft } from "@/pages/resolver/api/types";
import { Button, Card, Input } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { isValidEmail, normaliseEmail } from "@/pages/resolver/lib/validation";

const EMPTY: PartyDraft = { name: "", email: "", phone: "", role: "respondent", relationship: "" };

interface Props {
  initial: PartyDraft[];
  ownEmail: string;
  busy: boolean;
  serverError?: string | null;
  onConfirm: (parties: PartyDraft[]) => void;
}

type Errors = Partial<Record<"name" | "email", string>>;

export function validateDraft(draft: PartyDraft, list: PartyDraft[], ownEmail: string): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = strings.events.nameRequired;
  const email = normaliseEmail(draft.email);
  if (!isValidEmail(email)) errors.email = strings.events.invalidEmail;
  else if (email === normaliseEmail(ownEmail)) errors.email = strings.events.ownEmail;
  else if (list.some((p) => normaliseEmail(p.email) === email)) errors.email = strings.events.duplicateEmail;
  return errors;
}

/** Editable list of people to contact: added one at a time, then confirmed together. */
export function PartyFormCard({ initial, ownEmail, busy, serverError, onConfirm }: Props) {
  const [parties, setParties] = useState<PartyDraft[]>(initial);
  const [draft, setDraft] = useState<PartyDraft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => setParties(initial), [initial]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDraft(draft, parties, ownEmail);
    setErrors(found);
    if (Object.keys(found).length) return;
    setParties((all) => [...all, { ...draft, name: draft.name.trim(), email: draft.email.trim() }]);
    setDraft(EMPTY);
  };

  const set = (key: keyof PartyDraft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Card className="event-card stack" aria-labelledby="party-title">
      <h2 id="party-title">{strings.events.partyTitle}</h2>
      <p className="muted">{strings.events.partyIntro}</p>
      {parties.length > 0 && (
        <ul className="party-list">
          {parties.map((p) => (
            <li key={p.email}>
              <span>
                <strong>{p.name}</strong> · {p.email} · {strings.events.roles[p.role]}
              </span>
              <Button
                variant="ghost"
                size="small"
                aria-label={`${strings.events.removeParty} ${p.name}`}
                onClick={() => setParties((all) => all.filter((x) => x.email !== p.email))}
              >
                {strings.events.removeParty}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form className="stack" onSubmit={add} noValidate>
        <div className="grid-2">
          <Input label={strings.events.name} value={draft.name} error={errors.name} onChange={(e) => set("name")(e.target.value)} />
          <Input
            label={strings.events.email}
            type="email"
            value={draft.email}
            error={errors.email}
            onChange={(e) => set("email")(e.target.value)}
          />
          <Input label={strings.events.phone} type="tel" value={draft.phone} onChange={(e) => set("phone")(e.target.value)} />
          <div className="field">
            <label className="field__label" htmlFor="party-role">
              {strings.events.role}
            </label>
            <select
              id="party-role"
              className="select"
              value={draft.role}
              onChange={(e) => set("role")(e.target.value)}
            >
              {(Object.keys(strings.events.roles) as PartyDraft["role"][]).map((r) => (
                <option key={r} value={r}>
                  {strings.events.roles[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Input
          label={strings.events.relationship}
          value={draft.relationship}
          onChange={(e) => set("relationship")(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          {strings.events.addParty}
        </Button>
      </form>
      {serverError && (
        <p className="alert alert--error" role="alert">
          {serverError}
        </p>
      )}
      <Button onClick={() => onConfirm(parties)} disabled={parties.length === 0} busy={busy}>
        {strings.events.confirmParties}
      </Button>
    </Card>
  );
}
