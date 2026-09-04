import console from "node:console";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import readline from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  sql,
  BOOTSTRAP_ADMIN_ADVISORY_LOCK_ID,
} from "../../packages/database/dist/index.js";
import { PostgresUserRepository } from "../../packages/database/dist/repositories/index.js";
import { Argon2PasswordHashingAdapter } from "../../packages/infrastructure/dist/identity/index.js";
import {
  BootstrapAdminUseCase,
  IdentityError,
} from "../../packages/core/dist/identity/index.js";

if (!process.env["DATABASE_URL"]) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rootEnvPath = resolve(currentDir, "../../.env");

  if (existsSync(rootEnvPath)) {
    try {
      process.loadEnvFile(rootEnvPath);
    } catch {
      console.error(
        "ERROR: Failed to load local root .env file. Verify file permissions and syntax.",
      );
      process.exit(1);
    }
  }
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error(
    "ERROR: DATABASE_URL is not set. Ensure root .env exists or DATABASE_URL is in your environment.",
  );
  process.exit(1);
}

function askInput(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function askPassword(query) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      return askInput(query).then(resolve);
    }

    let muted = false;
    const mutableStdout = new Writable({
      write: function (chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(query);
    muted = true;

    rl.question("", (ans) => {
      rl.close();
      console.log(); // Newline after hidden input
      resolve(ans);
    });
  });
}

let client;

try {
  client = createDatabase(databaseUrl);

  // Verify database identity (must be strictly barberkece_dev for current M1 workflow)
  const identityRes = await client.db.execute(
    sql`SELECT current_user, current_database()`,
  );
  const row = identityRes[0];
  const currentUser = row?.current_user;
  const currentDatabase = row?.current_database;

  if (currentDatabase !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target database is '${currentDatabase}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  if (currentUser !== "barberkece_dev") {
    console.error(
      `SAFETY ABORT: Target user is '${currentUser}', expected 'barberkece_dev'.`,
    );
    await client.close();
    process.exit(1);
  }

  // Obtain credentials explicitly from operator (env vars for automated tests/runs or interactive prompts)
  let email = process.env["BOOTSTRAP_ADMIN_EMAIL"];
  if (!email) {
    email = await askInput("Enter initial ADMIN email: ");
  }

  let password = process.env["BOOTSTRAP_ADMIN_PASSWORD"];
  if (!password) {
    password = await askPassword(
      "Enter initial ADMIN password (min 8 characters): ",
    );
  }

  if (!email) {
    console.error("ERROR: Admin email is required.");
    await client.close();
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error("ERROR: Admin password must be at least 8 characters long.");
    await client.close();
    process.exit(1);
  }

  const passwordHashing = new Argon2PasswordHashingAdapter();

  const admin = await client.db.transaction(async (tx) => {
    // Acquire bootstrap-specific advisory transaction lock to serialize concurrent bootstraps
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_ADMIN_ADVISORY_LOCK_ID})`,
    );

    const txUserRepository = new PostgresUserRepository(tx);
    const useCase = new BootstrapAdminUseCase(
      txUserRepository,
      passwordHashing,
    );

    return await useCase.execute({
      email,
      passwordRaw: password,
    });
  });

  console.log("Admin bootstrap: SUCCESS");
  console.log(`- Created ADMIN user: ${admin.email}`);
  console.log(`- User ID: ${admin.id}`);
  console.log(`- Role: ${admin.role}`);
  console.log(`- Status: ${admin.status}`);

  await client.close();
  console.log("- Connection closed cleanly");
} catch (err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const sanitizedMessage = rawMessage.replace(
    /postgresql?:\/\/[^\s]*/gi,
    "[REDACTED]",
  );

  if (err instanceof IdentityError) {
    console.error(`Admin bootstrap FAILED: ${sanitizedMessage}`);
  } else {
    console.error(
      `Admin bootstrap FAILED with unexpected error: ${sanitizedMessage}`,
    );
  }

  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close error during failure
    }
  }

  process.exit(1);
}
