import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareCardImage } from "../../features/cards/card-form/svgToWebp";

let canvasSize: { width: number; height: number } | null;

beforeEach(() => {
  canvasSize = null;
  URL.createObjectURL = vi.fn(() => "blob:svg");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    cb,
  ) {
    canvasSize = { width: this.width, height: this.height };
    cb(new Blob(["x"], { type: "image/webp" }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const svg = (body: string, name = "logo.svg") =>
  new File([`<svg xmlns="http://www.w3.org/2000/svg" ${body}></svg>`], name, {
    type: "image/svg+xml",
  });

describe("prepareCardImage", () => {
  it("passes png through", async () => {
    const png = new File(["x"], "a.png", { type: "image/png" });
    expect(await prepareCardImage(png)).toBe(png);
  });

  it("converts svg to webp", async () => {
    const out = await prepareCardImage(svg('width="100" height="100"'));
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("logo.webp");
  });

  it("uses viewBox when no width/height", async () => {
    await prepareCardImage(svg('viewBox="0 0 100 200"'));
    expect(canvasSize!.height).toBe(canvasSize!.width * 2);
  });

  it("rejects invalid svg", async () => {
    const bad = new File(["<svg"], "bad.svg", { type: "image/svg+xml" });
    await expect(prepareCardImage(bad)).rejects.toThrow("invalid_svg");
  });

  it("rejects gif", async () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    await expect(prepareCardImage(gif)).rejects.toThrow("unsupported_image");
  });
});
