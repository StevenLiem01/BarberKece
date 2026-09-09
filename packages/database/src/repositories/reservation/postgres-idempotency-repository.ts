import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../../client.js";
import { idempotencyRecords } from "../../schema/reservation/idempotency_records.js";
import type {
  CreateIdempotencyRecordParams,
  IdempotencyRecord,
  IdempotencyRepository,
} from "@barberkece/core/reservation";

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: DbOrTx) {}

  async acquireAdvisoryLock(
    actorId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<void> {
    const combinedKey = `${actorId}:${idempotencyKey}`;
    await this.db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${operation}), hashtext(${combinedKey}))`,
    );
  }

  async findByKey(
    actorId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    const [row] = await this.db
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.actorId, actorId),
          eq(idempotencyRecords.operation, operation),
          eq(idempotencyRecords.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async createRecord(
    params: CreateIdempotencyRecordParams,
  ): Promise<IdempotencyRecord> {
    const [inserted] = await this.db
      .insert(idempotencyRecords)
      .values({
        id: params.id,
        actorId: params.actorId,
        operation: params.operation,
        idempotencyKey: params.idempotencyKey,
        requestHash: params.requestHash,
        appointmentId: params.appointmentId,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert idempotency record");
    }

    return inserted;
  }
}
