import mongoose, { Schema } from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../domain/enums';

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    status: { type: String, required: true, enum: TASK_STATUSES, default: 'TODO', index: true },
    priority: { type: String, required: true, enum: TASK_PRIORITIES, default: 'MEDIUM' },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    labels: { type: [String], default: [] },
  },
  { timestamps: true },
);

taskSchema.index({ project: 1, createdAt: -1, _id: -1 });
taskSchema.index({ project: 1, status: 1 });

export const TaskModel = mongoose.model('Task', taskSchema);
export type TaskDocument = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof taskSchema>>;
