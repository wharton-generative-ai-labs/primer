import { DefaultSession } from 'next-auth';
import { Permission, Role } from '@/config/auth';

declare module 'next-auth' {
  interface Session {
    user: {
      privileges: Permission[];
      roles: Role[];
    } & DefaultSession['user'];
  }
}