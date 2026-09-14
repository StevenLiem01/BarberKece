import {
  FaceShape,
  HairType,
  HairDensity,
  HairLength,
  MaintenanceLevel,
} from "../../recommendation/model.js";

export interface HairProfile {
  id: string;
  customerId: string;
  faceShape?: FaceShape | null;
  hairType?: HairType | null;
  hairDensity?: HairDensity | null;
  hairLength?: HairLength | null;
  maintenance?: MaintenanceLevel | null;
  styleTags: string[];
  createdAt: Date;
  updatedAt: Date;
}
