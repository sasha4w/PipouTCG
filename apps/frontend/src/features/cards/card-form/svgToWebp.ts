const PASSTHROUGH = ["image/png", "image/jpeg", "image/webp"];
const TARGET_WIDTH = 750;

/** Ratio largeur/hauteur d'un SVG : `width`/`height`, sinon `viewBox`, sinon 1. */
function svgRatio(root: Element): number {
  const w = parseFloat(root.getAttribute("width") ?? "");
  const h = parseFloat(root.getAttribute("height") ?? "");
  if (w > 0 && h > 0) return w / h;
  const vb = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return vb[2] / vb[3];
  return 1;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("invalid_svg"));
    img.src = url;
  });
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("invalid_svg"));
    reader.readAsText(file);
  });
}

/** PNG/JPEG/WebP tels quels ; un SVG est rasterisé en WebP (ImgBB ne lit pas le SVG). */
export async function prepareCardImage(file: File): Promise<File> {
  if (PASSTHROUGH.includes(file.type)) return file;
  if (file.type !== "image/svg+xml") throw new Error("unsupported_image");

  const text = await readText(file);
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (doc.querySelector("parsererror") || root.nodeName.toLowerCase() !== "svg")
    throw new Error("invalid_svg");

  const ratio = svgRatio(root);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_WIDTH;
    canvas.height = Math.round(TARGET_WIDTH / ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("invalid_svg");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", 0.9),
    );
    if (!blob) throw new Error("invalid_svg");
    return new File([blob], file.name.replace(/\.svg$/i, "") + ".webp", {
      type: "image/webp",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
