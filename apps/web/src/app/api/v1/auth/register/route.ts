import { NextRequest, NextResponse } from "next/server";
import { RegisterCustomerSchema } from "@barberkece/contracts";
import {
  RegisterCustomerUseCase,
  IdentityError,
} from "@barberkece/core/identity";
import { PostgresUserRepository } from "@barberkece/database/repositories";
import { Argon2PasswordHashingAdapter } from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let registerCustomerUseCase: RegisterCustomerUseCase | undefined;

function getRegisterCustomerUseCase(): RegisterCustomerUseCase {
  if (!registerCustomerUseCase) {
    const dbClient = getDatabaseClient();
    const userRepository = new PostgresUserRepository(dbClient.db);
    const passwordHashing = new Argon2PasswordHashingAdapter();
    registerCustomerUseCase = new RegisterCustomerUseCase(
      userRepository,
      passwordHashing,
    );
  }
  return registerCustomerUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "MALFORMED_JSON",
            message: "Request body must be valid JSON",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const parsed = RegisterCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid registration data",
            requestId,
            details: parsed.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const useCase = getRegisterCustomerUseCase();
    const result = await useCase.execute({
      email: parsed.data.email,
      passwordRaw: parsed.data.password,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      if (error.message === "Email is already registered") {
        logger.warn(
          { requestId, err: error.message },
          "Registration failed due to duplicate email",
        );
        return NextResponse.json(
          {
            error: {
              code: "REGISTRATION_FAILED",
              message: "Registration could not be completed.",
              requestId,
            },
          },
          { status: 400 },
        );
      }

      logger.error(
        { requestId, err: error.message },
        "Identity error during registration",
      );
      return NextResponse.json(
        {
          error: {
            code: "REGISTRATION_FAILED",
            message: "Registration could not be completed.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error },
      "Unexpected error during registration",
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
