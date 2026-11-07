import DataLoader from 'dataloader';
import { ProjectModel, type ProjectDocument } from '../modules/project/project.model';
import { UserModel, type UserDocument } from '../modules/user/user.model';

export interface Loaders {
  userById: DataLoader<string, UserDocument | null>;
  projectById: DataLoader<string, ProjectDocument | null>;
}

function byId<T extends { id: string }>(docs: T[], ids: readonly string[]): Array<T | null> {
  const map = new Map(docs.map((doc) => [doc.id, doc]));
  return ids.map((id) => map.get(id) ?? null);
}

export function createLoaders(): Loaders {
  return {
    userById: new DataLoader(async (ids) => {
      const users = await UserModel.find({ _id: { $in: [...ids] } });
      return byId(users, ids);
    }),
    projectById: new DataLoader(async (ids) => {
      const projects = await ProjectModel.find({ _id: { $in: [...ids] } });
      return byId(projects, ids);
    }),
  };
}
