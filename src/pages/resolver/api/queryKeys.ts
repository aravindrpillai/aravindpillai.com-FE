export const queryKeys = {
  authConfig: ["auth-config"] as const,
  me: ["me"] as const,
  cases: ["cases"] as const,
  case: (code: string) => ["case", code] as const,
  conversation: (code: string) => ["conversation", code] as const,
  welcome: (code: string) => ["welcome", code] as const,
  reports: (code: string) => ["reports", code] as const,
};
