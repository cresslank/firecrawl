import type { Mock } from "vitest";
import { extractData } from "../extractSmartScrape";
import { generateCompletions } from "../../transformers/llmExtract";
import { smartScrape } from "../smartScrape";
import { parseMarkdown } from "../../../../lib/html-to-markdown";
import { getModel } from "../../../../lib/generic-ai";

vi.mock("../../transformers/llmExtract", () => ({
  generateCompletions: vi.fn(),
  generateSchemaFromPrompt: vi.fn(),
}));

vi.mock("../smartScrape", () => ({
  smartScrape: vi.fn(),
}));

vi.mock("../../../../lib/html-to-markdown", () => ({
  parseMarkdown: vi.fn(),
}));

vi.mock("../../../../lib/generic-ai", () => ({
  getModel: vi.fn(),
}));

describe("extractData SmartScrape wrapper prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tells the model to include all SmartScrape wrapper fields when schema is wrapped", async () => {
    (generateCompletions as Mock).mockResolvedValue({
      extract: {
        extractedData: { title: "Example Domain" },
        shouldUseSmartscrape: false,
        smartscrape_reasoning: null,
        smartscrape_prompt: null,
      },
      warning: undefined,
      totalUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    await extractData({
      extractOptions: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any,
        options: {
          prompt: "Extract the page title from this page.",
          schema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
            additionalProperties: false,
          },
        } as any,
        markdown: "# Example Domain",
        model: "test-model" as any,
        retryModel: "retry-model" as any,
        costTrackingOptions: {
          costTracking: {} as any,
          metadata: {},
        },
        metadata: { teamId: "test-team" },
      },
      urls: ["https://example.com"],
      useAgent: false,
      metadata: { teamId: "test-team" },
    });

    const call = (generateCompletions as Mock).mock.calls[0][0];
    expect(call.options.prompt).toContain(
      "Return one valid JSON object with exactly these top-level keys",
    );
    expect(call.options.prompt).toContain("extractedData");
    expect(call.options.prompt).toContain("shouldUseSmartscrape");
    expect(call.options.prompt).toContain("smartscrape_reasoning");
    expect(call.options.prompt).toContain("smartscrape_prompt");
    expect(call.options.prompt).toContain(
      "Extract the page title from this page.",
    );
  });

  it("uses the multi-URL wrapper contract to route each requested page", async () => {
    (generateCompletions as Mock)
      .mockResolvedValueOnce({
        extract: {
          extractedData: { title: null },
          shouldUseSmartscrape: true,
          smartScrapePages: [
            {
              page_index: 1,
              smartscrape_reasoning: "The title is hidden.",
              smartscrape_prompt: "Find the title hidden on this page.",
            },
          ],
        },
        warning: undefined,
        totalUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      })
      .mockResolvedValueOnce({ extract: { title: "Second page" } });
    (smartScrape as Mock).mockResolvedValue({
      scrapedPages: [{ html: "<h1>Second page</h1>" }],
    });
    (parseMarkdown as Mock).mockResolvedValue("# Second page");
    (getModel as Mock).mockReturnValue("test-model");

    const result = await extractData({
      extractOptions: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any,
        options: {
          prompt: "Extract the title from each page.",
          schema: {
            type: "object",
            properties: { title: { type: ["string", "null"] } },
            required: ["title"],
            additionalProperties: false,
          },
        } as any,
        markdown: "# First page\n\n# Second page",
        model: "test-model" as any,
        retryModel: "retry-model" as any,
        costTrackingOptions: {
          costTracking: {} as any,
          metadata: {},
        },
        metadata: { teamId: "test-team" },
      },
      urls: ["https://example.com/first", "https://example.com/second"],
      useAgent: true,
      metadata: { teamId: "test-team" },
    });

    const initialCall = (generateCompletions as Mock).mock.calls[0][0];
    expect(initialCall.options.prompt).toContain(
      "exactly these top-level keys: extractedData, shouldUseSmartscrape, smartScrapePages",
    );
    expect(Object.keys(initialCall.options.schema.properties)).toEqual([
      "extractedData",
      "shouldUseSmartscrape",
      "smartScrapePages",
    ]);
    expect(initialCall.options.schema.required).toEqual([
      "extractedData",
      "shouldUseSmartscrape",
      "smartScrapePages",
    ]);
    expect(
      initialCall.options.schema.properties.smartScrapePages.items,
    ).toMatchObject({
      additionalProperties: false,
      required: ["page_index", "smartscrape_reasoning", "smartscrape_prompt"],
    });
    expect(smartScrape).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/second",
        prompt: "Find the title hidden on this page.",
      }),
    );
    expect(result.extractedDataArray).toEqual([{ title: "Second page" }]);
  });
});
