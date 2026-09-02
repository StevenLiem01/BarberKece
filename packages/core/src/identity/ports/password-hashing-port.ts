export interface PasswordHashingPort {
  hashPassword(plainPassword: string): Promise<string>;
  verifyPassword(hash: string, plainPassword: string): Promise<boolean>;
}
