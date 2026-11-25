// A stored piece's size and weight as one line (browser and server).
/** "2400×1200×100mm · 35kg each" */
export const sizeText = (p: { lengthMm?: number | null; widthMm?: number | null; heightMm?: number | null; weightKg?: number | null; quantity?: number }) => {
  const dims = [p.lengthMm, p.widthMm, p.heightMm].filter((x): x is number => !!x);
  const parts = [dims.length ? `${dims.join("×")}mm` : null, p.weightKg ? `${p.weightKg}kg${(p.quantity ?? 1) > 1 ? " each" : ""}` : null].filter(Boolean);
  return parts.join(" · ");
};
