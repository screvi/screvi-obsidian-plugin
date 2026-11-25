/**
 * Decode HTML entities and JSON escape sequences from text content.
 * Shared utility used by both the API client and the plugin.
 */
export function decodeHtmlEntities(text: string): string {
	if (!text) return text;
	
	// Common HTML entities that might appear in content
	const entities: { [key: string]: string } = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&apos;': "'",
		'&nbsp;': ' ',
		'&ndash;': '\u2013',
		'&mdash;': '\u2014',
		'&hellip;': '\u2026',
		'&lsquo;': '\u2018',
		'&rsquo;': '\u2019',
		'&ldquo;': '\u201c',
		'&rdquo;': '\u201d'
	};

	let decoded = text;

	// First handle JSON escape sequences
	decoded = decoded
		.replace(/\\n/g, '\n')      // Newlines
		.replace(/\\t/g, '\t')      // Tabs  
		.replace(/\\r/g, '\r')      // Carriage returns
		.replace(/\\"/g, '"')       // Escaped quotes
		.replace(/\\\\/g, '\\');    // Escaped backslashes (do this last)

	// Replace named HTML entities
	for (const [entity, replacement] of Object.entries(entities)) {
		if (decoded.includes(entity)) {
			decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
		}
	}

	// Replace numeric entities (like &#39; &#8217; etc.)
	decoded = decoded.replace(/&#(\d+);/g, (_match: string, num: string) => {
		return String.fromCharCode(parseInt(num, 10));
	});

	// Replace hex entities (like &#x27; etc.)
	decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_match: string, hex: string) => {
		return String.fromCharCode(parseInt(hex, 16));
	});

	return decoded;
}

/**
 * A Screvi tag name as a tag Obsidian will read whole. Obsidian ends a tag at
 * the first space or punctuation mark, so "org mod" written as #org mod is the
 * tag #org followed by a stray word. Spaces become hyphens, characters a tag
 * cannot hold are dropped, and letters of any language are kept, as is the
 * case the user typed. Returns '' when nothing usable is left (a tag such as
 * "?"), so the caller can leave it out.
 */
export function toObsidianTag(name: string): string {
	if (typeof name !== 'string') return '';
	let tag = name
		.trim()
		.replace(/^#+/, '')
		.replace(/\s+/g, '-')
		.replace(/[^\p{L}\p{N}\p{M}_\-/]/gu, '')
		.replace(/-{2,}/g, '-')
		.replace(/\/{2,}/g, '/')
		.replace(/-*\/-*/g, '/')
		.replace(/^[-/]+|[-/]+$/g, '');
	// Obsidian does not accept a tag made of digits only.
	if (/^\d+$/.test(tag)) tag = `_${tag}`;
	return tag;
}

/** The tags line of a highlight: "#one, #two". '' when there is none to write. */
export function formatObsidianTags(tags: unknown): string {
	if (!Array.isArray(tags)) return '';
	const seen = new Set<string>();
	const out: string[] = [];
	for (const tag of tags) {
		const raw = typeof tag === 'string' ? tag : (tag as { name?: unknown } | null)?.name;
		const clean = toObsidianTag(typeof raw === 'string' ? raw : '');
		const key = clean.toLowerCase();
		if (!clean || seen.has(key)) continue;
		seen.add(key);
		out.push(`#${clean}`);
	}
	return out.join(', ');
}
