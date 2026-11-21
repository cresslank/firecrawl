import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.PLAYWRIGHT_MICROSERVICE_URL =
    process.env.PLAYWRIGHT_MICROSERVICE_URL || "http://camoufox-renderer:3019/scrape";
});

vi.mock("../../../../lib/html-to-markdown", () => ({
  parseMarkdown: vi.fn(),
}));
vi.mock("../../lib/fetch", () => ({
  robustFetch: vi.fn(),
}));

import { config } from "../../../../config";
import { scrapeOptions } from "../../../../controllers/v2/types";
import {
  serializeTransportableError,
  deserializeTransportableError,
} from "../../../../lib/error-serde";
import { buildFeatureFlags } from "../..";
import { buildFallbackList, shouldUseIndex } from "..";
import { EngineError, PlaywrightBadRequestError } from "../../error";
import {
  playwrightMaxReasonableTime,
  scrapeURLWithPlaywright,
} from "./index";
import { robustFetch } from "../../lib/fetch";

const robustFetchMock = vi.mocked(robustFetch);

function makeMeta(
  optionOverrides: Record<string, unknown> = {},
  timeoutValue: number | null = 25000,
) {
  const options = scrapeOptions.parse({
    ...optionOverrides,
  } as any);
  const featureFlags = buildFeatureFlags(
    "https://example.com/page",
    options,
    { teamId: "team-test", orgId: null } as any,
    false,
  );
  return {
    id: "job-test",
    url: "https://example.com/page",
    options,
    internalOptions: {
      teamId: "team-test",
      orgId: null,
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
    abort: {
      scrapeTimeout: () => timeoutValue ?? undefined,
      asSignal: () => undefined,
    },
    featureFlags,
  } as any;
}

describe("scrapeURLWithPlaywright", () => {
  beforeEach(() => {
    robustFetchMock.mockReset();
    config.PLAYWRIGHT_MICROSERVICE_URL = "http://camoufox-renderer:3019/scrape";
  });

  it("forwards check_selector, wait_for_network_idle, and wait_after_load to PLAYWRIGHT_MICROSERVICE_URL", async () => {
    robustFetchMock.mockResolvedValueOnce({
      content: "<html><body>ok</body></html>",
      pageStatusCode: 200,
      contentType: "text/html",
      url: "https://example.com/landed",
    } as any);

    const res = await scrapeURLWithPlaywright(
      makeMeta({
        wait_after_load: 350,
        check_selector: ".quote",
        wait_for_network_idle: true,
        skipTlsVerification: false,
      }),
    );

    expect(robustFetchMock).toHaveBeenCalledTimes(1);
    const call = robustFetchMock.mock.calls[0][0] as any;
    expect(call.url).toBe("http://camoufox-renderer:3019/scrape");
    expect(call.body).toEqual({
      url: "https://example.com/page",
      wait_after_load: 350,
      timeout: 25000,
      headers: undefined,
      skip_tls_verification: false,
      check_selector: ".quote",
      wait_for_network_idle: true,
    });
    expect(res.url).toBe("https://example.com/landed");
    expect(res.statusCode).toBe(200);
  });

  it("supports camelCase aliases and omits unset selector/idle fields", async () => {
    robustFetchMock.mockResolvedValueOnce({
      content: "<html></html>",
      pageStatusCode: 200,
    } as any);

    await scrapeURLWithPlaywright(makeMeta({ waitFor: 100 }));
    let body = (robustFetchMock.mock.calls[0][0] as any).body;
    expect(body.wait_after_load).toBe(100);
    expect("check_selector" in body).toBe(false);
    expect("wait_for_network_idle" in body).toBe(false);

    robustFetchMock.mockResolvedValueOnce({
      content: "<html></html>",
      pageStatusCode: 200,
    } as any);
    await scrapeURLWithPlaywright(
      makeMeta({ checkSelector: "#app", waitForNetworkIdle: true }),
    );
    body = (robustFetchMock.mock.calls[1][0] as any).body;
    expect(body.check_selector).toBe("#app");
    expect(body.wait_for_network_idle).toBe(true);
  });

  it("maps HTTP 400 from PLAYWRIGHT_MICROSERVICE_URL to PlaywrightBadRequestError and HTTP 500 to EngineError", async () => {
    robustFetchMock.mockRejectedValueOnce(
      new Error("Request sent failure status", {
        cause: {
          response: {
            status: 400,
            body: JSON.stringify({ error: "Invalid check_selector" }),
          },
        },
      }),
    );
    await expect(
      scrapeURLWithPlaywright(makeMeta({ check_selector: "div[[[bad" })),
    ).rejects.toMatchObject({
      name: "Error",
      code: "SCRAPE_PLAYWRIGHT_BAD_REQUEST",
      message: "Invalid check_selector",
    });

    const err = new PlaywrightBadRequestError("Invalid check_selector");
    const roundTripped = deserializeTransportableError(
      serializeTransportableError(err),
    );
    expect(roundTripped).toBeInstanceOf(PlaywrightBadRequestError);
    expect(roundTripped?.message).toBe("Invalid check_selector");

    robustFetchMock.mockRejectedValueOnce(
      new Error("Request sent failure status", {
        cause: {
          response: {
            status: 500,
            body: JSON.stringify({ error: "Browser rendering failed" }),
          },
        },
      }),
    );
    await expect(scrapeURLWithPlaywright(makeMeta())).rejects.toBeInstanceOf(
      EngineError,
    );
  });

  it("assigns distinct feature flags, bypasses index, excludes fetch fallback, and sizes timeout budget", async () => {
    const both = makeMeta(
      {
        wait_after_load: 400,
        check_selector: "#ready",
        wait_for_network_idle: true,
      },
      25000,
    );
    expect(both.featureFlags.has("waitFor")).toBe(true);
    expect(both.featureFlags.has("checkSelector")).toBe(true);
    expect(both.featureFlags.has("waitForNetworkIdle")).toBe(true);
    expect(playwrightMaxReasonableTime(both)).toBe(35400);
    expect(playwrightMaxReasonableTime(makeMeta({ check_selector: "#ready" }, 45000))).toBe(45000);
    expect(playwrightMaxReasonableTime(makeMeta({ check_selector: "#ready" }, null))).toBe(60000);
    expect(playwrightMaxReasonableTime(makeMeta({ wait_for_network_idle: true, wait_after_load: 400 }, 25000))).toBe(35400);

    const idleFalse = makeMeta({ wait_for_network_idle: false });
    expect(idleFalse.featureFlags.has("waitForNetworkIdle")).toBe(false);
    expect(idleFalse.featureFlags.has("waitFor")).toBe(false);
    expect(playwrightMaxReasonableTime(idleFalse)).toBe(30000);

    const selectorOnly = makeMeta({ check_selector: ".quote" });
    expect(selectorOnly.featureFlags.has("waitFor")).toBe(false);
    expect(selectorOnly.featureFlags.has("checkSelector")).toBe(true);
    expect(shouldUseIndex(selectorOnly)).toBe(false);
    expect(shouldUseIndex(makeMeta({ wait_for_network_idle: true }))).toBe(false);

    const selected = await buildFallbackList(selectorOnly);
    expect(selected.map(x => x.engine)).toEqual(["playwright"]);
  });
});
