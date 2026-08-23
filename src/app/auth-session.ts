type AuthSessionPayload = {
  authenticated?: unknown;
  admin?: unknown;
};

export function isVerifiedAdminSession(payload: AuthSessionPayload | null | undefined): boolean {
  return payload?.authenticated === true && payload?.admin === true;
}

export function failClosedAuthState<T extends {
  checked: boolean;
  email: string | null;
  tier: string;
  admin: boolean;
}>(state: T): T {
  return { ...state, checked: true, email: null, tier: "none", admin: false };
}

export function normalizeAdminCodeInput(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "")
    .slice(0, 8);
}
