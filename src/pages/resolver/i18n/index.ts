import { en } from "./en";

export { en as strings };

/** Replace {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Look up a dynamic key inside a strings group, with a fallback. */
export function pick<T extends Record<string, string>>(group: T, key: string, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(group, key) ? group[key as keyof T]! : fallback;
}
