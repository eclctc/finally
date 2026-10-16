import { ApiError, request } from "@/lib/api";

function stubFetch(response: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("returns parsed JSON on 2xx and fetches the exact relative path", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({ cash_balance: 10000 }) });
    await expect(request("/api/portfolio")).resolves.toEqual({ cash_balance: 10000 });
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio", undefined);
  });

  it("throws ApiError with the backend error text and status on 400", async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ error: "Insufficient cash" }) });
    const failure = await request("/api/portfolio/trade").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: "Insufficient cash", status: 400 });
  });

  it("falls back to a status-only message when the body is not JSON", async () => {
    stubFetch({
      ok: false,
      status: 404,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    const failure = await request("/api/nope").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: "Request failed (404)", status: 404 });
  });
});
