import { User, UserWithPasswordHash } from "../models/user.js";

export interface CreateUserParams {
  id: string;
  email: string;
  displayName?: string | null;
  emailVerifiedAt?: Date | null;
  passwordHash: string;
  role: User["role"];
  status: User["status"];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  createUser(params: CreateUserParams): Promise<User>;
  findByEmail(email: string): Promise<UserWithPasswordHash | null>;
  findById(id: string): Promise<User | null>;
  countByRole(role: User["role"]): Promise<number>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  updateDisplayName(userId: string, displayName: string): Promise<User>;
}
