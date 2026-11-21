import { z } from "zod";
import { config } from "../../../../config";
import { EngineScrapeResult } from "..";
import { Meta } from "../..";
import { EngineError, PlaywrightBadRequestError } from "../../error";
import { robustFetch } from "../../lib/fetch";
import { getInnerJson } from "@mendable/firecrawl-rs";

function extractErrorDetail(body: unknown): string | undefined {
  if (typeof body !== "string" || !body.trim()) return undefined;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {}
  return undefined;
}

export async function scrapeURLWithPlaywright(
  meta: Meta,
): Promise<EngineScrapeResult> {
  const waitAfterLoad = meta.options.wait_after_load ?? meta.options.waitFor;
  const checkSelector =
    meta.options.check_selector ?? meta.options.checkSelector;
  const waitForNetworkIdle =
    meta.options.wait_for_network_idle ?? meta.options.waitForNetworkIdle;

  let response: {
    content: string;
    pageStatusCode: number;
    pageError?: string;
    contentType?: string;
    url?: string;
  };
  try {
    response = await robustFetch({
      url: config.PLAYWRIGHT_MICROSERVICE_URL!,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        url: meta.rewrittenUrl ?? meta.url,
        wait_after_load: waitAfterLoad,
        timeout: meta.abort.scrapeTimeout(),
        headers: meta.options.headers,
        skip_tls_verification: meta.options.skipTlsVerification,
        ...(checkSelector !== undefined
          ? { check_selector: checkSelector }
          : {}),
        ...(waitForNetworkIdle !== undefined
          ? { wait_for_network_idle: waitForNetworkIdle }
          : {}),
      },
      method: "POST",
      logger: meta.logger.child("scrapeURLWithPlaywright/robustFetch"),
      schema: z.object({
        content: z.string(),
        pageStatusCode: z.number(),
        pageError: z.string().optional(),
        contentType: z.string().optional(),
        // Optional: older playwright-service builds don't send it.
        url: z.string().optional(),
      }),
      mock: meta.mock,
      abort: meta.abort.asSignal(),
    });
  } catch (error) {
    const errResponse = (
      error as { cause?: { response?: { status?: unknown; body?: unknown } } }
    )?.cause?.response;
    if (errResponse && typeof errResponse.status === "number") {
      const detail = extractErrorDetail(errResponse.body);
      if (
        errResponse.status >= 400 &&
        errResponse.status < 500 &&
        errResponse.status !== 408 &&
        errResponse.status !== 429 &&
        errResponse.status !== 499
      ) {
        throw new PlaywrightBadRequestError(
          detail ??
            `Playwright microservice rejected request with status ${errResponse.status}`,
        );
      }
      throw new EngineError(
        `Playwright microservice failed with status ${errResponse.status}${detail ? `: ${detail}` : ""}`,
        { cause: error },
      );
    }
    throw error;
  }

  if (response.contentType?.includes("application/json")) {
    response.content = await getInnerJson(response.content);
  }

  return {
    // The landed URL reported by the service. Redirect threat and blocklist
    // re-checks compare it against the requested URL. Falls back to the
    // requested URL for older services or a non-http(s) value (about:blank).
    url: landedHttpUrl(response.url) ?? meta.rewrittenUrl ?? meta.url,
    html: response.content,
    statusCode: response.pageStatusCode,
    error: response.pageError,
    contentType: response.contentType,

    proxyUsed: "basic",
  };
}

function landedHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export function playwrightMaxReasonableTime(meta: Meta): number {
  const wait = meta.options.wait_after_load ?? meta.options.waitFor ?? 0;
  const idleAllowance =
    (meta.options.wait_for_network_idle ?? meta.options.waitForNetworkIdle) ===
    true
      ? 5000
      : 0;
  const hasCheckSelector = Boolean(
    meta.options.check_selector ?? meta.options.checkSelector,
  );
  const base = wait + idleAllowance + 30000;
  return hasCheckSelector
    ? Math.max(base, meta.abort.scrapeTimeout() ?? 60000)
    : base;
}
