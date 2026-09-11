export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
