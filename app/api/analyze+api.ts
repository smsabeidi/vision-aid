import { handleAnalyze, handleAnalyzeOptions } from "@/lib/analyze-api";

function withDeprecationHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Deprecation", "true");
  headers.set("Link", '</api/v1/analyze>; rel="successor-version"');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function POST(request: Request): Promise<Response> {
  return withDeprecationHeaders(await handleAnalyze(request));
}

export function OPTIONS(request: Request): Response {
  return withDeprecationHeaders(handleAnalyzeOptions(request));
}
