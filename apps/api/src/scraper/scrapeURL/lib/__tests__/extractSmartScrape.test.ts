import type { Mock } from "vitest";
import { extractData } from "../extractSmartScrape";
import {
  generateCompletions,
  generateSchemaFromPrompt,
} from "../../transformers/llmExtract";
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
      useAgent: true,
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

  it.each(
    [false, true].flatMap(useAgent =>
      [false, true].flatMap(hasSchema =>
        [false, true].flatMap(hasPrompt =>
          [false, true].map(multipleUrls => ({
            useAgent,
            hasSchema,
            hasPrompt,
            multipleUrls,
          })),
        ),
      ),
    ),
  )(
    "aligns prompt, schema and result: agent=$useAgent schema=$hasSchema prompt=$hasPrompt multiple=$multipleUrls",
    async ({ useAgent, hasSchema, hasPrompt, multipleUrls }) => {
      const schema = {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      };
      const prompt = hasPrompt ? "Extract the page title." : undefined;
      const expected = { title: "Example Domain" };
      const wrapped = useAgent && (hasSchema || hasPrompt);
      (generateSchemaFromPrompt as Mock).mockResolvedValue({ extract: schema });
      // Model the output explicitly requested by the prompt. If an unwrapped
      // request receives wrapper instructions, its customer-visible result leaks.
      (generateCompletions as Mock).mockImplementation(async ({ options }) => ({
        extract: options.prompt?.includes("exactly these top-level keys")
          ? { extractedData: expected, shouldUseSmartscrape: false }
          : expected,
      }));

      const result = await extractData({
        extractOptions: {
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
          options: { schema: hasSchema ? schema : undefined, prompt } as any,
          markdown: "# Example Domain",
          model: "test-model" as any,
          retryModel: "retry-model" as any,
          costTrackingOptions: { costTracking: {} as any, metadata: {} },
          metadata: { teamId: "test-team" },
        },
        urls: multipleUrls
          ? ["https://example.com/first", "https://example.com/second"]
          : ["https://example.com"],
        useAgent,
        metadata: { teamId: "test-team" },
      });

      const call = (generateCompletions as Mock).mock.calls[0][0];
      expect(result.extractedDataArray).toEqual([expected]);
      expect(smartScrape).not.toHaveBeenCalled();
      if (wrapped) {
        expect(call.options.prompt).toContain("exactly these top-level keys");
        expect(call.options.schema.properties).toHaveProperty("extractedData");
      } else {
        expect(call.options.prompt).toBe(prompt);
        expect(call.options.schema).toEqual(
          hasSchema || hasPrompt ? schema : undefined,
        );
      }
    },
  );

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
