import {
  API_VERSION,
  PROMPT_VERSION,
  isStrictProduction,
  productionReadiness,
} from "@/lib/production-config";

export function GET(): Response {
  const checks = productionReadiness();
  const ready = checks.every((check) => !check.required || check.ready);
  const strict = isStrictProduction();
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      apiVersion: API_VERSION,
      promptVersion: PROMPT_VERSION,
      environment: strict ? "production" : "development",
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-API-Version": API_VERSION,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
