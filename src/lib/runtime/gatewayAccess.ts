const SESSION_KEY = "graphwake:gateway-access";

export function setGatewayAccessToken(value: string): void {
  if (typeof sessionStorage === "undefined") return;
  const token = value.trim();
  if (token) sessionStorage.setItem(SESSION_KEY, token);
  else sessionStorage.removeItem(SESSION_KEY);
}

export function hasGatewayAccessToken(): boolean {
  return (
    typeof sessionStorage !== "undefined" &&
    Boolean(sessionStorage.getItem(SESSION_KEY))
  );
}

export function gatewayRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof sessionStorage === "undefined") return headers;
  const token = sessionStorage.getItem(SESSION_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
