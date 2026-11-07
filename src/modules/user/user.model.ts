import mongoose, { Schema } from 'mongoose';
import { ROLES } from '../../domain/enums';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES, default: 'MEMBER' },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.index({ createdAt: -1, _id: -1 });

export const UserModel = mongoose.model('User', userSchema);
export type UserDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof userSchema>>;
