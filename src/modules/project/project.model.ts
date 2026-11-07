import mongoose, { Schema } from 'mongoose';
import { ROLES } from '../../domain/enums';

const projectMemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    joinedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [projectMemberSchema], default: [] },
  },
  { timestamps: true },
);

projectSchema.index({ createdAt: -1, _id: -1 });

export const ProjectModel = mongoose.model('Project', projectSchema);
export type ProjectDocument = mongoose.HydratedDocument<
  mongoose.InferSchemaType<typeof projectSchema>
>;
export type ProjectMemberParent = ProjectDocument['members'][number];
