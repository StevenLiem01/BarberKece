import { HairstyleKnowledge } from "./model.js";

export interface HairstyleKnowledgeRepository {
  findById(id: string): Promise<HairstyleKnowledge | null>;
  findAll(): Promise<HairstyleKnowledge[]>;
  save(knowledge: HairstyleKnowledge): Promise<void>;
  update(knowledge: HairstyleKnowledge): Promise<void>;
  deactivate(id: string): Promise<void>;
}
