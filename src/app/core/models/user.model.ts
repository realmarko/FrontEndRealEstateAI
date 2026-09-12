export type UserRole = 'Owner' | 'Buyer' | 'Agent';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole[];
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterDetails extends AuthCredentials {
  firstName: string;
  lastName: string;
  role: UserRole;
}
