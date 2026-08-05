import { describe, expect, it } from 'vitest';

import { SentApi } from '../credentials/SentApi.credentials';
import { Sent } from '../nodes/Sent/Sent.node';
import { SentTrigger } from '../nodes/SentTrigger/SentTrigger.node';

// Loaded through Vite's `?raw` rather than node:fs — the n8n Cloud ruleset bans fs, path
// and __dirname in every .ts file, tests included, and `allowInlineConfig: false` means
// an eslint-disable would not help.
import darkGlyph from '../icons/sent-dark-icon.svg?raw';
import lightGlyph from '../icons/sent-light-icon.svg?raw';

const sourceByFile: Record<string, string> = {
	'sent-dark-icon.svg': darkGlyph,
	'sent-light-icon.svg': lightGlyph,
};

function readIcon(reference: string): string {
	const file = reference.replace(/^file:/, '').split('/').pop() as string;
	const svg = sourceByFile[file];
	expect(svg, `icon reference points at a file that does not exist: ${file}`).toBeDefined();
	return svg;
}

/** Perceived lightness 0-1 of the single flat fill the glyph uses. */
function fillLightness(svg: string): number {
	const fills = [...svg.matchAll(/fill="#([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
	expect(new Set(fills).size).toBe(1); // a themed icon must be one flat colour
	const hex = fills[0];
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const themed = [
	['Sent node', new Sent().description.icon],
	['Sent Trigger node', new SentTrigger().description.icon],
	['Sent API credential', new SentApi().icon],
] as const;

describe('themed icons', () => {
	it.each(themed)('%s declares both theme variants', (_label, icon) => {
		expect(icon).toMatchObject({
			light: expect.stringMatching(/^file:.*\.svg$/),
			dark: expect.stringMatching(/^file:.*\.svg$/),
		});
	});

	// The source files are named for the colour of the glyph, but n8n's `light`/`dark`
	// keys name the theme the icon renders *in*. Mapping them by matching names —
	// light -> sent-light-icon.svg — puts a white glyph on n8n's white canvas and the
	// icon vanishes. Nothing else in the build catches that.
	it.each(themed)('%s uses a dark glyph for the light theme', (_label, icon) => {
		expect(fillLightness(readIcon((icon as { light: string }).light))).toBeLessThan(0.25);
	});

	it.each(themed)('%s uses a light glyph for the dark theme', (_label, icon) => {
		expect(fillLightness(readIcon((icon as { dark: string }).dark))).toBeGreaterThan(0.75);
	});

	it.each(themed)('%s points at square icon files', (_label, icon) => {
		for (const reference of Object.values(icon as Record<string, string>)) {
			const viewBox = /viewBox="([^"]+)"/
				.exec(readIcon(reference))?.[1]
				?.split(/[\s,]+/)
				.map(Number);
			expect(viewBox).toHaveLength(4);
			const [, , width, height] = viewBox as number[];
			// n8n renders node icons in a square slot; a wordmark ratio gets letterboxed.
			expect(width / height).toBeCloseTo(1, 1);
		}
	});

	it.each(themed)('%s ships no scriptable or remote SVG content', (_label, icon) => {
		for (const reference of Object.values(icon as Record<string, string>)) {
			expect(readIcon(reference)).not.toMatch(
				/<script|<foreignObject|<image|xlink:href|href\s*=|javascript:/i,
			);
		}
	});
});
