import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import {
  booleanEnvironmentValue,
  isStrictProduction,
} from "@/lib/production-config";
import type { AnalysisErrorCode } from "@/types/analysis";

type Environment = Record<string, string | undefined>;

export interface AuthPrincipal {
  subject: string;
  scopes: string[];
  anonymous: boolean;
}

export class ApiAuthError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function value(environment: Environment, name: string): string | undefined {
  return environment[name]?.trim() || undefined;
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) return undefined;
  if (header.length > 8_192) return undefined;
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(header.trim());
  return match?.[1];
}

function scopesFromPayload(scope: unknown, scp: unknown): string[] {
  const values = [
    ...(typeof scope === "string" ? scope.split(/\s+/) : []),
    ...(Array.isArray(scp) ? scp.filter((item): item is string => typeof item === "string") : []),
  ];
  return [...new Set(values.filter(Boolean))];
}

function getJwks(url: string): JWTVerifyGetKey {
  const cached = jwksCache.get(url);
  if (cached) return cached;
  const created = createRemoteJWKSet(new URL(url), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
    timeoutDuration: 3_000,
  });
  jwksCache.set(url, created);
  return created;
}

export async function authenticateAnalysisRequest(
  request: Request,
  environment: Environment = process.env,
  options: {
    scopeEnvironmentVariable?: string;
    defaultProductionScope?: string;
  } = {},
): Promise<AuthPrincipal> {
  const strict = isStrictProduction(environment);
  const required = strict || booleanEnvironmentValue("AUTH_REQUIRED", false, environment);
  const authorizationHeader = request.headers.get("authorization");
  const token = bearerToken(request);
  if (authorizationHeader && !token) {
    throw new ApiAuthError(
      "AUTHENTICATION_REQUIRED",
      "The authorization header is malformed.",
      401,
    );
  }
  if (!token && !required) {
    return { subject: "anonymous", scopes: [], anonymous: true };
  }
  if (!token) {
    throw new ApiAuthError(
      "AUTHENTICATION_REQUIRED",
      "A valid access token is required.",
      401,
    );
  }

  const jwksUrl = value(environment, "AUTH_JWKS_URL");
  const issuer = value(environment, "AUTH_ISSUER");
  const audience = value(environment, "AUTH_AUDIENCE");
  if (!jwksUrl || !issuer || !audience) {
    throw new ApiAuthError(
      "CONFIGURATION_ERROR",
      "Authentication is not configured correctly.",
      503,
    );
  }

  let parsedJwksUrl: URL;
  try {
    parsedJwksUrl = new URL(jwksUrl);
  } catch {
    throw new ApiAuthError(
      "CONFIGURATION_ERROR",
      "Authentication is not configured correctly.",
      503,
    );
  }
  if (strict && parsedJwksUrl.protocol !== "https:") {
    throw new ApiAuthError(
      "CONFIGURATION_ERROR",
      "Authentication is not configured correctly.",
      503,
    );
  }

  const algorithms = (value(environment, "AUTH_ALLOWED_ALGORITHMS") || "RS256,ES256")
    .split(",")
    .map((algorithm) => algorithm.trim())
    .filter(Boolean);

  try {
    const verified = await jwtVerify(token, getJwks(parsedJwksUrl.toString()), {
      issuer,
      audience,
      algorithms,
      clockTolerance: 5,
    });
    if (!verified.payload.sub) {
      throw new Error("The token has no subject.");
    }
    const scopes = scopesFromPayload(verified.payload.scope, verified.payload.scp);
    const requiredScope =
      value(environment, options.scopeEnvironmentVariable ?? "AUTH_REQUIRED_SCOPE") ||
      (strict ? options.defaultProductionScope ?? "analysis:write" : undefined);
    if (requiredScope && !scopes.includes(requiredScope)) {
      throw new ApiAuthError(
        "FORBIDDEN",
        "The access token does not permit visual analysis.",
        403,
      );
    }
    return { subject: verified.payload.sub, scopes, anonymous: false };
  } catch (error) {
    if (error instanceof ApiAuthError) throw error;
    throw new ApiAuthError(
      "AUTHENTICATION_REQUIRED",
      "The access token is invalid or expired.",
      401,
    );
  }
}
