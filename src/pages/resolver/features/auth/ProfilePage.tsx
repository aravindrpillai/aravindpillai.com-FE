import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "@/pages/resolver/api/endpoints/auth";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import { Button, Card, Input, Skeleton, useToast } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { browserTimeZone } from "@/pages/resolver/lib/time";

export default function ProfilePage() {
  const me = useQuery({ queryKey: queryKeys.me, queryFn: authApi.me });
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [tz, setTz] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (me.data) {
      setName(me.data.display_name);
      setTz(me.data.timezone || browserTimeZone());
      setNotify(me.data.notify_status_updates);
    }
  }, [me.data]);

  const save = useMutation({
    mutationFn: () => authApi.updateMe({ display_name: name, timezone: tz, notify_status_updates: notify }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.me, data);
      toast(strings.profile.saved);
    },
  });

  if (me.isPending) return <Skeleton count={3} height={44} />;
  if (me.isError) return <p className="alert alert--error">{errorMessage(me.error)}</p>;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card className="stack">
      <h1 tabIndex={-1}>{strings.profile.title}</h1>
      <p className="muted">{me.data.email}</p>
      <form className="stack" onSubmit={onSubmit}>
        <Input label={strings.profile.displayName} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={strings.profile.timezone} value={tz} onChange={(e) => setTz(e.target.value)} />
        <label className="row">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {strings.profile.notifications}
        </label>
        {save.error && <p className="alert alert--error">{errorMessage(save.error)}</p>}
        <Button type="submit" busy={save.isPending}>
          {strings.profile.save}
        </Button>
      </form>
    </Card>
  );
}
