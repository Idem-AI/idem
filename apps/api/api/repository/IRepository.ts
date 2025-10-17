export interface IRepository<
  T extends { id?: string; createdAt?: Date; updatedAt?: Date }
> {
  create(
    item: Omit<T, "id" | "createdAt" | "updatedAt">,
    collectionPath: string,
    id?: string
  ): Promise<T>; // collectionPath is the full Firestore path, id for custom document ID
  findById(id: string, collectionPath: string): Promise<T | null>;
  findAll(collectionPath: string): Promise<T[]>;
  update(
    id: string,
    item: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
    collectionPath: string
  ): Promise<T | null>;
  delete(id: string, collectionPath: string): Promise<boolean>;
}
