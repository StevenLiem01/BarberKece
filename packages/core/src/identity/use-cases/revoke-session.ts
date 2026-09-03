import { TokenPort } from "../ports/token-port.js";
import { SessionRepository } from "../ports/session-repository.js";

export class RevokeSessionUseCase {
  constructor(
    private readonly tokenPort: TokenPort,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(rawSessionToken: string | null | undefined): Promise<void> {
    if (!rawSessionToken || typeof rawSessionToken !== "string") {
      return;
    }

    const tokenHash = await this.tokenPort.hashToken(rawSessionToken);
    await this.sessionRepository.revokeSession(tokenHash);
  }
}
