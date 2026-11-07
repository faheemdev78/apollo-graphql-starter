import 'dotenv/config';
import { config } from '../config';
import { connectDb, disconnectDb } from '../db/connect';
import { AppError } from '../errors/appError';
import { projectService } from '../modules/project/project.service';
import { ProjectModel } from '../modules/project/project.model';
import { taskService } from '../modules/task/task.service';
import { TaskModel } from '../modules/task/task.model';
import { userService } from '../modules/user/user.service';
import { UserModel, type UserDocument } from '../modules/user/user.model';
import type { Role } from '../domain/enums';

const PASSWORD = 'Password123!';

const PEOPLE: Array<{ email: string; name: string; role: Role }> = [
  { email: 'admin@example.com', name: 'Avery Admin', role: 'ADMIN' },
  { email: 'maya@example.com', name: 'Maya Chen', role: 'MEMBER' },
  { email: 'leo@example.com', name: 'Leo Martins', role: 'VIEWER' },
];

async function upsertUser(person: (typeof PEOPLE)[number]): Promise<UserDocument> {
  const existing = await UserModel.findOne({ email: person.email });
  if (existing) {
    if (existing.role !== person.role) {
      existing.role = person.role;
      await existing.save();
    }
    return existing;
  }
  const created = await userService.register({
    email: person.email,
    name: person.name,
    password: PASSWORD,
  });
  if (person.role !== 'MEMBER') {
    created.role = person.role;
    await created.save();
  }
  return created;
}

async function main(): Promise<void> {
  await connectDb(config.mongoUri);
  const [admin, maya, leo] = await Promise.all(PEOPLE.map((person) => upsertUser(person)));
  if (!admin || !maya || !leo) throw new Error('Seed users were not created');

  const actor = userService.toActor(admin);
  let project = await ProjectModel.findOne({ key: 'APOLLO' });
  if (!project) {
    try {
      project = await projectService.create(actor, {
        name: 'Apollo Showcase',
        key: 'APOLLO',
        description: 'Sample project used by the seed script.',
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'CONFLICT') throw error;
      project = await ProjectModel.findOne({ key: 'APOLLO' });
    }
  }
  if (!project) throw new Error('Seed project was not created');

  await projectService.addMember(actor, {
    projectId: project.id,
    userId: maya.id,
    role: 'MEMBER',
  });
  await projectService.addMember(actor, {
    projectId: project.id,
    userId: leo.id,
    role: 'VIEWER',
  });

  const existingTasks = await TaskModel.countDocuments({ project: project._id });
  if (existingTasks === 0) {
    const mayaActor = userService.toActor(maya);
    await taskService.create(actor, {
      projectId: project.id,
      title: 'Design the GraphQL schema',
      description: 'Schema-first types for users, projects, and tasks.',
      status: 'DONE',
      priority: 'HIGH',
      assigneeId: maya.id,
      labels: ['schema', 'graphql'],
    });
    await taskService.create(mayaActor, {
      projectId: project.id,
      title: 'Implement resolvers and DataLoaders',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      assigneeId: maya.id,
      labels: ['api'],
    });
    await taskService.create(actor, {
      projectId: project.id,
      title: 'Cover the API with integration tests',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: leo.id,
      labels: ['testing'],
    });
    await taskService.create(actor, {
      projectId: project.id,
      title: 'Document example operations',
      description: 'README queries, mutations, and the subscription example.',
      status: 'IN_REVIEW',
      priority: 'LOW',
      labels: ['docs'],
    });
  }

  console.log('Seed complete. Demo accounts use the password Password123!');
  for (const person of PEOPLE) {
    console.log(`  ${person.role.padEnd(6)} ${person.email}`);
  }
  console.log('  Project key: APOLLO');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
