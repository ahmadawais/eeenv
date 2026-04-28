import figlet from "figlet";
import pc from "picocolors";

const WIDE_FONT: figlet.Fonts = "ANSI Shadow";
const NARROW_FONT: figlet.Fonts = "ANSI Regular";

/** Render the banner. Wide font when terminal can fit it, narrow otherwise. */
export function renderBanner(name: string): string {
	const cols = process.stdout.columns ?? 80;
	const font: figlet.Fonts = cols >= 80 ? WIDE_FONT : NARROW_FONT;
	const ascii = figlet.textSync(name, { font, horizontalLayout: "default" });
	return pc.white(ascii);
}

export function printBanner(name: string, tagline: string): void {
	console.log("");
	console.log(renderBanner(name));
	console.log(pc.gray(tagline));
	console.log("");
}
