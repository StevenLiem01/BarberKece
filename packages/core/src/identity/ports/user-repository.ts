import { User, UserWithPasswordHash } from "../models/user.js";

export interface CreateUserParams {
  id: string;
  email: string;
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
}
