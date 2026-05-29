import { extractData } from "../extractSmartScrape";
import { generateCompletions } from "../../transformers/llmExtract";

jest.mock("../../transformers/llmExtract", () => ({
  generateCompletions: jest.fn(),
  generateSchemaFromPrompt: jest.fn(),
}));

jest.mock("../smartScrape", () => ({
  smartScrape: jest.fn(),
}));

jest.mock("../../../../lib/html-to-markdown", () => ({
  parseMarkdown: jest.fn(),
}));

jest.mock("../../../../lib/generic-ai", () => ({
  getModel: jest.fn(),
}));

describe("extractData SmartScrape wrapper prompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tells the model to include all SmartScrape wrapper fields when schema is wrapped", async () => {
    (generateCompletions as jest.Mock).mockResolvedValue({
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
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
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

    const call = (generateCompletions as jest.Mock).mock.calls[0][0];
    expect(call.options.prompt).toContain(
      "Return one valid JSON object with exactly these top-level keys",
    );
    expect(call.options.prompt).toContain("extractedData");
    expect(call.options.prompt).toContain("shouldUseSmartscrape");
    expect(call.options.prompt).toContain("smartscrape_reasoning");
    expect(call.options.prompt).toContain("smartscrape_prompt");
    expect(call.options.prompt).toContain("Extract the page title from this page.");
  });
});
