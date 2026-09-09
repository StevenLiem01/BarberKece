export interface IdempotencyRecord {
  id: string;
  actorId: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  appointmentId: string;
  createdAt: Date;
}

export interface CreateIdempotencyRecordParams {
  id?: string;
  actorId: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  appointmentId: string;
}

export interface IdempotencyRepository {
  acquireAdvisoryLock(
    actorId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<void>;
  findByKey(
    actorId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null>;
  createRecord(
    params: CreateIdempotencyRecordParams,
  ): Promise<IdempotencyRecord>;
}
