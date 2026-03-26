import { mock } from "bun:test";

export interface MockSlackCall {
  method: string;
  args: unknown;
}

/**
 * Create a mock Slack WebClient for testing.
 * Records all calls for later assertions.
 */
export function createMockSlackClient() {
  const calls: MockSlackCall[] = [];

  const postMessage = mock(async (args: unknown) => {
    calls.push({ method: "chat.postMessage", args });
    return {
      ok: true,
      channel: "C12345TEST",
      ts: "1234567890.123456",
    };
  });

  return {
    calls,
    client: {
      chat: {
        postMessage,
      },
    },
    reset() {
      calls.length = 0;
      postMessage.mockClear();
    },
  };
}
