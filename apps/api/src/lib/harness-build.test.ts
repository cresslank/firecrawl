import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { runInNewContext } from "vm";
import ts from "typescript";
import { prepareNuqPostgresImage } from "./harness-build";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
const sha = "0123456789abcdef0123456789abcdef01234567";
const root = "/checkout with spaces";

beforeEach(() => vi.resetAllMocks());

describe("local image build revision", () => {
  it.each(["docker", "podman"])(
    "passes the exact checkout SHA to %s",
    async runtime => {
      vi.mocked(execFileSync).mockReturnValue(`${sha}\n`);
      const run = vi.fn().mockResolvedValue(undefined);
      await prepareNuqPostgresImage(root, runtime, run);
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["rev-parse", "--verify", "HEAD^{commit}"],
        { cwd: root, encoding: "utf8", timeout: 10000 },
      );
      expect(run).toHaveBeenCalledExactlyOnceWith([
        runtime,
        "build",
        "--build-arg",
        `GIT_SHA=${sha}`,
        "-t",
        "firecrawl-nuq-postgres:latest",
        join(root, "apps", "nuq-postgres"),
      ]);
    },
  );

  it.each([
    "",
    "unknown",
    sha.slice(0, 7),
    sha.toUpperCase(),
    `${sha}extra`,
    `${sha}\n${sha}`,
  ])(
    "rejects malformed revision %j before invoking the runtime",
    async value => {
      vi.mocked(execFileSync).mockReturnValue(value);
      const run = vi.fn();
      await expect(
        prepareNuqPostgresImage(root, "docker", run),
      ).rejects.toThrow("full 40-character Git SHA");
      expect(run).not.toHaveBeenCalled();
    },
  );

  it("fails closed when Git metadata is unavailable", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not a git repository");
    });
    const run = vi.fn();
    await expect(prepareNuqPostgresImage(root, "docker", run)).rejects.toThrow(
      "not a git repository",
    );
    expect(run).not.toHaveBeenCalled();
  });
});

// Execute the actual setup/build functions without importing the harness's CLI
// entrypoint (which would spawn services). No copy of their implementation.
function localSetup() {
  const source = ts.createSourceFile(
    "harness.ts",
    readFileSync(join(__dirname, "..", "harness.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const functions = source.statements.filter(
    node =>
      ts.isFunctionDeclaration(node) &&
      ["setupNuqPostgres", "buildNuqPostgresImage"].includes(
        node.name?.text ?? "",
      ),
  );
  expect(functions).toHaveLength(2);
  const code = ts.transpile(
    functions.map(node => node.getText(source)).join("\n"),
    { target: ts.ScriptTarget.ES2022 },
  );
  const events: string[] = [];
  const build = vi.fn(async () => {
    events.push("build");
  });
  const stop = vi.fn(async () => {
    events.push("stop");
  });
  const start = vi.fn(async () => {
    events.push("start");
  });
  const setup = runInNewContext(`${code}; setupNuqPostgres`, {
    config: {},
    process: { env: {} },
    POSTGRES_HOST: "localhost",
    POSTGRES_USER: "postgres",
    POSTGRES_PASSWORD: "test",
    POSTGRES_DB: "postgres",
    MONOREPO_ROOT: root,
    prepareNuqPostgresImage,
    logger: { section() {}, success() {}, info() {} },
    detectContainerRuntime: async () => "docker",
    execForward: () => ({ promise: build() }),
    stopAndRemoveContainer: stop,
    startNuqPostgresContainer: start,
    waitForPostgres: async () => {},
    nuqPostgresContainer: null,
  });
  return { setup, build, stop, start, events };
}

describe("harness lifecycle build preflight", () => {
  it("builds successfully before stopping/removing or starting a local container", async () => {
    vi.mocked(execFileSync).mockReturnValue(sha);
    const { setup, events } = localSetup();
    await setup();
    expect(events).toEqual(["build", "stop", "start"]);
  });

  it.each(["invalid revision", "missing Git", "failed build"])(
    "preserves the existing container on %s",
    async failure => {
      vi.mocked(execFileSync).mockReturnValue(
        failure === "invalid revision" ? "unknown" : sha,
      );
      if (failure === "missing Git")
        vi.mocked(execFileSync).mockImplementation(() => {
          throw new Error("missing Git");
        });
      const { setup, build, stop, start } = localSetup();
      if (failure === "failed build")
        build.mockRejectedValue(new Error("build failed"));
      await expect(setup()).rejects.toThrow();
      expect(stop).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    },
  );
});
