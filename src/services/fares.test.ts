import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveExactFare, resolveCheapestJourney } from "./fares";

describe("resolveExactFare", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prefers a lower fare even when it requires more transfers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ fare: 16 })));
    const plan = await resolveCheapestJourney(
      { lineId: "bts-sukhumvit", stationId: "N8" },
      { lineId: "bts-sukhumvit", stationId: "E4" },
      new AbortController().signal,
    );
    expect(plan.fare.total).toBe(16);
    expect(plan.route.some((stop) => stop.lineId === "mrt-blue")).toBe(true);
    expect(plan.route.filter((stop, i) => i > 0 && stop.lineId !== plan.route[i-1].lineId)).toHaveLength(2);
  });

  it("chooses a cheaper longer route and uses fewer transfers on equal fares", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      // The Blue Line-only ticket is cheaper than leaving and re-entering via BTS.
      return new Response(
        JSON.stringify({ fare: from === "BL13" && to === "BL34" ? 20 : 45 }),
      );
    });
    const plan = await resolveCheapestJourney(
      { lineId: "mrt-blue", stationId: "BL13" },
      { lineId: "mrt-blue", stationId: "BL34" },
      new AbortController().signal,
    );
    expect(plan.fare.total).toBe(20);
    expect(plan.route.every((stop) => stop.lineId === "mrt-blue")).toBe(true);
    expect(plan.route.map((stop) => stop.stationId)).toContain("BL01");
  });

  it("fails the comparison if any candidate fare is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 502 }),
    );
    await expect(
      resolveCheapestJourney(
        { lineId: "bts-sukhumvit", stationId: "N8" },
        { lineId: "mrt-blue", stationId: "BL22" },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });

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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 502 }),
    );

    await expect(
      resolveExactFare(
        { lineId: "mrt-purple", stationId: "PP10" },
        { lineId: "mrt-blue", stationId: "BL13" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("ตรวจราคาทางการไม่ได้ในขณะนี้");
  });
});
