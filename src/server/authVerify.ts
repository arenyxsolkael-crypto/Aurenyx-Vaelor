import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createRemoteJWKSet,
  errors as JoseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerFirebasePublicConfig {
  projectId: string;
  authDomain: string;
  firestoreDatabaseId: string;
  configured: boolean;
}

export function loadServerFirebaseConfig(): ServerFirebasePublicConfig {
  try {
    const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      return {
        projectId: '',
        authDomain: '',
        firestoreDatabaseId: '',
        configured: false,
      };
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      projectId?: string;
      authDomain?: string;
      firestoreDatabaseId?: string;
    };
    const projectId = (raw.projectId || '').trim();
    const configured = Boolean(projectId && projectId !== 'remixed-project-id');
    return {
      projectId,
      authDomain: (raw.authDomain || '').trim(),
      firestoreDatabaseId: (raw.firestoreDatabaseId || '').trim(),
      configured,
    };
  } catch {
    return {
      projectId: '',
      authDomain: '',
      firestoreDatabaseId: '',
      configured: false,
    };
  }
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  signInProvider: string;
}

export type AuthVerificationErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'INVALID_AUTH_TOKEN'
  | 'AUTH_UNCONFIGURED';

export class AuthVerificationError extends Error {
  public readonly code: AuthVerificationErrorCode;
  public readonly statusCode: number;

  constructor(code: AuthVerificationErrorCode, message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthVerificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface FirebaseTokenVerifier {
  verifyBearerHeader(authorizationHeader?: string): Promise<VerifiedFirebaseUser>;
}

const GOOGLE_SECURETOKEN_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

export function createJwksFirebaseTokenVerifier(options: {
  projectId: string;
  jwks?: JWTVerifyGetKey;
}): FirebaseTokenVerifier {
  const cleanProjectId = options.projectId.trim();
  const keyResolver =
    options.jwks ??
    (cleanProjectId ? createRemoteJWKSet(GOOGLE_SECURETOKEN_JWKS_URL) : undefined);

  return {
    async verifyBearerHeader(authorizationHeader?: string): Promise<VerifiedFirebaseUser> {
      if (!cleanProjectId || !keyResolver) {
        throw new AuthVerificationError(
          'AUTH_UNCONFIGURED',
          'Firebase Authentication project configuration is missing on the server.',
          503
        );
      }

      const rawHeader = (authorizationHeader || '').trim();
      if (!rawHeader || !/^Bearer\s+/i.test(rawHeader)) {
        throw new AuthVerificationError(
          'AUTH_REQUIRED',
          'Authentication required. Sign in to access your private projects, chats, and workspace data.',
          401
        );
      }

      const token = rawHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token || token.length < 24 || token.length > 8192) {
        throw new AuthVerificationError(
          'INVALID_AUTH_TOKEN',
          'Malformed authentication token. Please sign in again.',
          401
        );
      }

      try {
        const expectedIssuer = `https://securetoken.google.com/${cleanProjectId}`;
        const { payload } = await jwtVerify(token, keyResolver, {
          issuer: expectedIssuer,
          audience: cleanProjectId,
          algorithms: ['RS256'],
          clockTolerance: 30,
        });

        const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
        if (!sub || sub.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(sub)) {
          throw new AuthVerificationError(
            'INVALID_AUTH_TOKEN',
            'Token subject (UID) failed validation.',
            401
          );
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        if (typeof payload.iat === 'number' && payload.iat > nowSeconds + 60) {
          throw new AuthVerificationError(
            'INVALID_AUTH_TOKEN',
            'Token issue timestamp is in the future.',
            401
          );
        }

        const firebaseClaims =
          payload.firebase && typeof payload.firebase === 'object'
            ? (payload.firebase as { sign_in_provider?: unknown })
            : undefined;

        return {
          uid: sub,
          email: typeof payload.email === 'string' ? payload.email : null,
          emailVerified: payload.email_verified === true,
          name: typeof payload.name === 'string' ? payload.name : null,
          picture: typeof payload.picture === 'string' ? payload.picture : null,
          signInProvider:
            typeof firebaseClaims?.sign_in_provider === 'string'
              ? firebaseClaims.sign_in_provider
              : 'firebase',
        };
      } catch (err) {
        if (err instanceof AuthVerificationError) {
          throw err;
        }
        if (err instanceof JoseErrors.JWTExpired) {
          throw new AuthVerificationError(
            'SESSION_EXPIRED',
            'Your sign-in session has expired. Refreshing session or please sign in again.',
            401
          );
        }
        throw new AuthVerificationError(
          'INVALID_AUTH_TOKEN',
          'Authentication token could not be verified for this Firebase project. Please sign in again.',
          401
        );
      }
    },
  };
}
