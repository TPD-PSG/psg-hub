// New look fonts (PSG brand): Montserrat for everything, Josefin Sans for small-caps labels.
// Served by Next itself (no outside font host); exposed as CSS variables the tokens use.
import { Montserrat, Josefin_Sans } from "next/font/google";

export const nlBody = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--nl-font-body", display: "swap" });
export const nlCaps = Josefin_Sans({ subsets: ["latin"], weight: ["600", "700"], variable: "--nl-font-caps", display: "swap" });
export const nlFontVars = `${nlBody.variable} ${nlCaps.variable}`;
