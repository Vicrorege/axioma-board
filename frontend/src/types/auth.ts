export interface User {
  id: string;
  username: string;
  email?: string;
  is_verified?: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  needs_verification?: boolean;
  email?: string;
  message?: string;
}
