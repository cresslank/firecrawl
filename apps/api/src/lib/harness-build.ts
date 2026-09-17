import { execFileSync } from "child_process";
import { join } from "path";

// Resolve the checkout, not an environment/event SHA which may describe another ref.
export function resolveBuildSha(monorepoRoot: string): string {
  const sha = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
    cwd: monorepoRoot,
    encoding: "utf8",
    timeout: 10000,
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(
      "Building local images requires a full 40-character Git SHA",
    );
  }
  return sha;
}

export async function prepareNuqPostgresImage(
  monorepoRoot: string,
  runtime: string,
  run: (args: string[]) => Promise<void>,
): Promise<void> {
  const sha = resolveBuildSha(monorepoRoot);
  await run([
    runtime,
    "build",
    "--build-arg",
    `GIT_SHA=${sha}`,
    "-t",
    "firecrawl-nuq-postgres:latest",
    join(monorepoRoot, "apps", "nuq-postgres"),
  ]);
}
