import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-change-me-in-env-file-min-32-bytes"
);

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  memberId?: string;
}

export async function createAuthToken(payload: JWTPayload, expiresIn = "1d"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyAuthToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}


