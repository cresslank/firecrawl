const mocks = vi.hoisted(() => {
  const model = (provider: string) =>
    vi.fn((name: string) => ({ provider, name }));

  const openaiResponses = model("openai.responses");
  const openaiChat = model("openai.chat");
  const openai = Object.assign(openaiResponses, {
    chat: openaiChat,
    embedding: vi.fn(),
  });

  return {
    config: {
      MODEL_NAME: undefined as string | undefined,
      OPENAI_USE_CHAT_COMPLETIONS: false,
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: undefined,
      OLLAMA_BASE_URL: undefined,
      OPENROUTER_API_KEY: undefined,
      VERTEX_CREDENTIALS: undefined,
    },
    openai,
    openaiResponses,
    openaiChat,
    ollama: Object.assign(model("ollama"), { embedding: vi.fn() }),
    anthropic: model("anthropic"),
    groq: model("groq"),
    google: model("google"),
    openrouter: model("openrouter"),
    fireworks: model("fireworks"),
    deepinfra: model("deepinfra"),
    vertex: model("vertex"),
  };
});

vi.mock("../config", () => ({ config: mocks.config }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => mocks.openai }));
vi.mock("ollama-ai-provider-v2", () => ({
  createOllama: () => mocks.ollama,
}));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: mocks.anthropic }));
vi.mock("@ai-sdk/groq", () => ({ groq: mocks.groq }));
vi.mock("@ai-sdk/google", () => ({ google: mocks.google }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => mocks.openrouter,
}));
vi.mock("@ai-sdk/fireworks", () => ({ fireworks: mocks.fireworks }));
vi.mock("@ai-sdk/deepinfra", () => ({ deepinfra: mocks.deepinfra }));
vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex: () => mocks.vertex,
}));

import { getModel } from "./generic-ai";

describe("getModel OpenAI transport selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.MODEL_NAME = undefined;
    mocks.config.OPENAI_USE_CHAT_COMPLETIONS = false;
  });

  it("uses the Responses API by default", () => {
    expect(getModel("gpt-4o-mini", "openai")).toEqual({
      provider: "openai.responses",
      name: "gpt-4o-mini",
    });
    expect(mocks.openaiResponses).toHaveBeenCalledWith("gpt-4o-mini");
    expect(mocks.openaiChat).not.toHaveBeenCalled();
  });

  it("uses Chat Completions when explicitly enabled", () => {
    mocks.config.OPENAI_USE_CHAT_COMPLETIONS = true;

    expect(getModel("compatible-model", "openai")).toEqual({
      provider: "openai.chat",
      name: "compatible-model",
    });
    expect(mocks.openaiChat).toHaveBeenCalledWith("compatible-model");
    expect(mocks.openaiResponses).not.toHaveBeenCalled();
  });

  it("continues forcing o3-mini through Chat Completions", () => {
    expect(getModel("o3-mini-2025-01-31", "openai")).toEqual({
      provider: "openai.chat",
      name: "o3-mini-2025-01-31",
    });
    expect(mocks.openaiChat).toHaveBeenCalledWith("o3-mini-2025-01-31");
    expect(mocks.openaiResponses).not.toHaveBeenCalled();
  });

  it("does not affect non-OpenAI providers", () => {
    mocks.config.OPENAI_USE_CHAT_COMPLETIONS = true;

    expect(getModel("claude-test", "anthropic")).toEqual({
      provider: "anthropic",
      name: "claude-test",
    });
    expect(mocks.anthropic).toHaveBeenCalledWith("claude-test");
    expect(mocks.openaiResponses).not.toHaveBeenCalled();
    expect(mocks.openaiChat).not.toHaveBeenCalled();
  });
});
