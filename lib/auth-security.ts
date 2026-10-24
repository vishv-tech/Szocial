export function safeNext(value: string | null | undefined, fallback = "/home") {
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) && !value.startsWith('/auth/') ? value : fallback;
}
export function passwordError(value: string) {
  return value.length >= 12 && value.length <= 128 ? null : "Use a password between 12 and 128 characters.";
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
