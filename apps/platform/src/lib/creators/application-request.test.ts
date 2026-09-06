import { describe, expect, it, vi } from "vitest";

import {
  createCreatorApplicationSubmitter,
  submitCreatorApplication,
} from "./application-request";

const draft = {
  displayName: "Orbit Works",
  portfolioUrl: "https://example.com/game",
  pitch: "A deliberately long creator pitch for the application endpoint.",
};

function response(status: number, data: unknown, jsonRejects = false) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jsonRejects
      ? () => Promise.reject(new SyntaxError("invalid json"))
      : () => Promise.resolve(data),
  };
}

describe("creator application requests", () => {
  it("turns network and malformed error responses into a retryable failure", async () => {
    await expect(
      submitCreatorApplication(draft, () => Promise.reject(new Error("offline"))),
    ).resolves.toBe("failed");
    await expect(
      submitCreatorApplication(draft, () =>
        Promise.resolve(response(500, null, true)),
      ),
    ).resolves.toBe("failed");
  });

  it("keeps authentication and already-open responses distinct", async () => {
    await expect(
      submitCreatorApplication(draft, () =>
        Promise.resolve(response(401, { error: "authentication_required" })),
      ),
    ).resolves.toBe("authentication_required");
    await expect(
      submitCreatorApplication(draft, () =>
        Promise.resolve(response(409, { error: "application_already_open" })),
      ),
    ).resolves.toBe("application_already_open");
  });

  it("requires a valid receipt before clearing a successful draft", async () => {
    await expect(submitCreatorApplication(draft, () =>
      Promise.resolve(response(200, null, true)),
    )).resolves.toBe("failed");
    await expect(submitCreatorApplication(draft, () =>
      Promise.resolve(response(200, { message: "unexpected" })),
    )).resolves.toBe("failed");
    await expect(submitCreatorApplication(draft, () =>
      Promise.resolve(response(201, { id: "application-id" })),
    )).resolves.toBe("received");
  });

  it("coalesces repeated submits while one request is in flight", async () => {
    let resolveRequest!: (value: ReturnType<typeof response>) => void;
    const request = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const submit = createCreatorApplicationSubmitter(request);

    const first = submit(draft);
    const second = submit(draft);

    expect(second).toBe(first);
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest(response(201, { id: "application-id" }));
    await expect(first).resolves.toBe("received");

    const third = submit(draft);
    expect(request).toHaveBeenCalledTimes(2);
    resolveRequest(response(201, { id: "next-application-id" }));
    await expect(third).resolves.toBe("received");
  });
});
