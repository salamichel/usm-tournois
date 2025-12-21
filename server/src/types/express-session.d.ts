import 'express-session';
import type { UserSession } from '@shared/types';

declare module 'express-session' {
  interface SessionData {
    user?: UserSession;
  }
}
