import { Role } from './enums';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        userId: string;
        role: Role;
        sessionId: string;
        isAlumni: boolean;
        communityId: string;
        accountStatus: string;
      };
      nonce?: string;
      deviceFingerprint?: string;
    }
  }
}

export {};
