"use client";
import { btnSolid } from "@/lib/twsUi";
export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} style={btnSolid}>Print labels</button>;
}
