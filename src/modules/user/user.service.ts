import type { QueryFilter } from 'mongoose';
import { toAuthUser } from '../../auth/authenticate';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../auth/passwords';
import type { AuthUser } from '../../context';
import type { Role } from '../../domain/enums';
import { AppError, isDuplicateKey } from '../../errors/appError';
import { paginate, type PageArgs } from '../../graphql/pagination';
import { escapeRegex } from '../../utils/regex';
import { isObjectId } from '../../utils/objectId';
import { UserModel, type UserDocument } from './user.model';

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string | null;
  avatarUrl?: string | null;
}

export const userService = {
  async register(input: RegisterInput): Promise<UserDocument> {
    try {
      return await UserModel.create({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: 'MEMBER',
        avatarUrl: null,
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppError('An account with that email already exists', 'CONFLICT');
      }
      throw error;
    }
  },

  async login(input: { email: string; password: string }): Promise<UserDocument> {
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
    const matches = await verifyPassword(input.password, passwordHash);
    if (!user || !matches || !user.passwordHash) {
      throw new AppError('Invalid email or password', 'UNAUTHENTICATED');
    }
    return user;
  },

  async getById(id: string): Promise<UserDocument | null> {
    if (!isObjectId(id)) return null;
    return UserModel.findById(id);
  },

  async updateProfile(actor: AuthUser, input: UpdateProfileInput): Promise<UserDocument> {
    const update: { name?: string; avatarUrl?: string | null } = {};
    if (input.name != null) update.name = input.name;
    if (input.avatarUrl !== undefined) update.avatarUrl = input.avatarUrl;
    const user = await UserModel.findByIdAndUpdate(actor.id, update, { new: true });
    if (!user) throw new AppError('User not found', 'NOT_FOUND');
    return user;
  },

  async updateRole(actor: AuthUser, userId: string, role: Role): Promise<UserDocument> {
    if (!isObjectId(userId)) throw new AppError('User not found', 'NOT_FOUND');
    if (actor.id === userId) {
      throw new AppError('You cannot change your own role', 'FORBIDDEN');
    }
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 'NOT_FOUND');
    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await UserModel.countDocuments({ role: 'ADMIN' });
      if (admins <= 1) throw new AppError('At least one admin is required', 'FORBIDDEN');
    }
    user.role = role;
    await user.save();
    return user;
  },

  list(args: PageArgs & { search?: string | null }) {
    const filter: QueryFilter<UserDocument> = {};
    if (args.search) {
      const regex = new RegExp(escapeRegex(args.search), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }
    return paginate<UserDocument>(UserModel, filter, args);
  },

  toActor(user: UserDocument): AuthUser {
    return toAuthUser({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
  },
};
