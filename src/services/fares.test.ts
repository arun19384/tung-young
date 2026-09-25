import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveExactFare } from "./fares";

describe("resolveExactFare", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds the official MRT and BTS fares without estimating", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ fare: 38 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const quote = await resolveExactFare(
      { lineId: "mrt-purple", stationId: "PP10" },
      { lineId: "bts-sukhumvit", stationId: "N11" },
      new AbortController().signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/fares/mrt?from=PP10&to=BL13",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(quote).toEqual({
      total: 60,
      items: [
        { label: "MRT ม่วง–น้ำเงิน", fare: 38 },
        { label: "BTS", fare: 22 },
      ],
      passengerType: "adult-single-journey",
    });
  });

  it("does not substitute an estimate when the official MRT lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 502 }));

    await expect(resolveExactFare(
      { lineId: "mrt-purple", stationId: "PP10" },
      { lineId: "mrt-blue", stationId: "BL13" },
      new AbortController().signal,
    )).rejects.toThrow("ตรวจราคาทางการไม่ได้ในขณะนี้");
  });
});
