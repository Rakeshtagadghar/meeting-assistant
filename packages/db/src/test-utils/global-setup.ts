import { execSync } from "child_process";
import { resolve } from "path";

export async function setup(): Promise<void> {
  process.env["DATABASE_URL"] =
    "postgresql://ainotes_test:ainotes_test@localhost:5433/ainotes_test?schema=public";

  execSync("npx prisma migrate deploy", {
    cwd: resolve(__dirname, "../.."),
    env: { ...process.env },
    stdio: "pipe",
  });
}

export async function teardown(): Promise<void> {
  // Test DB uses tmpfs — wiped on container restart
}
