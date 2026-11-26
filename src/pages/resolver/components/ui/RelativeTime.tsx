import { absoluteTime, relativeTime } from "@/pages/resolver/lib/time";

export function RelativeTime({ value }: { value: string }) {
  return (
    <time dateTime={value} title={absoluteTime(value)}>
      {relativeTime(value)}
    </time>
  );
}
