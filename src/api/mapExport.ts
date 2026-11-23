import { decodeHtmlEntities } from '../utils';
import type { HighlightTag, ScreviHighlight } from './types';

type Raw = Record<string, unknown>;

/** A non-empty string, or a number as a string; anything else is absent. */
function text(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'string' && value.trim()) return value.trim();
	return undefined;
}

// Sources created without a link (PDF uploads, manual entries) carry this
// placeholder in their url column. It is not a link to anything.
const PLACEHOLDER_URLS = new Set(['https://example.com', 'http://example.com', 'https://example.com/']);

function realUrl(value: unknown): string | undefined {
	const url = text(value);
	return url && !PLACEHOLDER_URLS.has(url) ? url : undefined;
}

function normalizeTags(raw: unknown): HighlightTag[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	return raw.map((tag: unknown) => {
		if (typeof tag === 'string') return { name: tag };
		if (tag && typeof tag === 'object' && 'name' in tag) return tag as HighlightTag;
		return { name: String(tag) };
	});
}

/**
 * Flattens the source-grouped payload of /api/highlights/export into one
 * highlight per row, carrying the source's own fields on each.
 *
 * Where the API puts things, which is not where the highlight type suggests:
 *   - the page number and chapter live in `highlight.metadata`, not on the
 *     highlight itself;
 *   - `location` is sent as the string "0" when the highlight has none;
 *   - `highlight.url` is the link of that one highlight (for a Readwise import,
 *     the Readwise Reader page), while `source.url` is the article or book.
 */
export function mapExportSources(sources: unknown[]): ScreviHighlight[] {
	const all: ScreviHighlight[] = [];

	for (const source of sources) {
		const sourceObj = (source ?? {}) as Raw;
		if (!Array.isArray(sourceObj.highlights)) continue;

		const sourceName = typeof sourceObj.name === 'string' ? sourceObj.name : undefined;
		const sourceUrl = realUrl(sourceObj.url);

		for (const highlight of sourceObj.highlights) {
			const h = (highlight ?? {}) as Raw;
			const metadata = (h.metadata && typeof h.metadata === 'object' ? h.metadata : undefined) as Raw | undefined;

			const location = text(h.location);

			all.push({
				id: h.id as string | undefined,
				content: decodeHtmlEntities((h.content as string) || ''),
				note: (h.note ?? h.notes) as string | undefined,
				source: sourceName,
				sourceType: sourceObj.type as ScreviHighlight['sourceType'],
				title: decodeHtmlEntities(sourceName || ''),
				author: (h.author || sourceObj.author) as string | undefined,
				url: realUrl(h.url) ?? sourceUrl,
				source_url: sourceUrl,
				date: ((h.created_at || sourceObj.created_at) as string) || '',
				created_at: (h.created_at || sourceObj.created_at) as string | undefined,
				updated_at: h.updated_at as string | undefined,
				tags: normalizeTags(h.tags),
				chapter: text(h.chapter) ?? text(metadata?.chapter),
				page: text(h.page) ?? text(metadata?.page) ?? text(metadata?.page_number),
				location: location === '0' ? undefined : location,
				color: h.color as string | undefined,
				book_id: h.book_id as string | undefined,
				metadata,
				source_id: (sourceObj.source_id as string | null | undefined) ?? null,
				article_id: (sourceObj.article_id as string | null | undefined) ?? null,
			});
		}
	}

	return all;
}
