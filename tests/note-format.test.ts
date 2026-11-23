import { describe, expect, it } from 'vitest';
import ScreviSyncPlugin from '../main';
import { mapExportSources } from '../src/api';
import type { ScreviHighlight } from '../src/api';
import { buildFrontmatter, screviSourceUrl } from '../src/frontmatter';

function makePlugin(settings: Partial<ScreviSyncPlugin['settings']> = {}): ScreviSyncPlugin {
	const stub = Object.create(ScreviSyncPlugin.prototype) as ScreviSyncPlugin;
	stub.settings = {
		apiKey: '',
		syncInterval: 2,
		defaultFolder: 'Screvi Highlights',
		autoSync: true,
		lastSyncTime: 0,
		includeMetadata: true,
		tagPrefix: 'screvi',
		autoLinkFields: ['author'],
		enableAutoLinking: true,
		syncedCategories: { books: true, posts: true, articles: true, documents: true, youtube: true, personalNotes: true },
		...settings,
	};
	stub.setupNunjucks();
	return stub;
}

// The shape /api/highlights/export really returns: page inside metadata,
// location "0" for none, and a per-highlight url next to the source's own.
const exportSource = (source: Record<string, unknown>, highlights: Record<string, unknown>[]) => ({
	name: 'A Source',
	type: 'book',
	author: 'An Author',
	url: null,
	source_id: 'src-1',
	article_id: null,
	...source,
	highlights: highlights.map((h, i) => ({ id: `hl-${i}`, content: `text ${i}`, location: '0', metadata: {}, ...h })),
});

describe('mapExportSources', () => {
	it('reads the page number from highlight.metadata', () => {
		const [h] = mapExportSources([exportSource({}, [{ metadata: { page: '120' } }])]);
		expect(h.page).toBe('120');
	});

	it('accepts a numeric page and a page_number key', () => {
		const [a, b] = mapExportSources([exportSource({}, [{ metadata: { page: 7 } }, { metadata: { page_number: 'xii' } }])]);
		expect(a.page).toBe('7');
		expect(b.page).toBe('xii');
	});

	it('writes a one-page range as a single page and keeps a real range', () => {
		const [same, range] = mapExportSources([exportSource({}, [{ metadata: { page: '12-12' } }, { metadata: { page: '108-112' } }])]);
		expect(same.page).toBe('12');
		expect(range.page).toBe('108-112');
	});

	it('treats location "0" as no location and keeps a real one', () => {
		const [none, real] = mapExportSources([exportSource({}, [{ location: '0' }, { location: '1509' }])]);
		expect(none.location).toBeUndefined();
		expect(real.location).toBe('1509');
	});

	it('keeps the source link apart from a highlight link', () => {
		const [h] = mapExportSources([
			exportSource(
				{ type: 'article', url: 'https://medium.com/the-article', source_id: null, article_id: 'art-1' },
				[{ url: 'https://read.readwise.io/read/abc' }],
			),
		]);
		expect(h.source_url).toBe('https://medium.com/the-article');
		expect(h.url).toBe('https://read.readwise.io/read/abc');
		expect(h.article_id).toBe('art-1');
	});

	it('drops the example.com placeholder some sources carry as a url', () => {
		const [h] = mapExportSources([exportSource({ url: 'https://example.com' }, [{}])]);
		expect(h.source_url).toBeUndefined();
		expect(h.url).toBeUndefined();
	});

	it('skips sources with no highlights array', () => {
		expect(mapExportSources([{ name: 'empty' }, null])).toEqual([]);
	});
});

describe('buildFrontmatter', () => {
	it('writes the properties in a fixed order and quotes them', () => {
		expect(
			buildFrontmatter({ title: 'Tom & Jerry: "A" Story', author: '[[Jane Doe]]', type: 'book', source: 'https://x.com/a?b=1&c=2', screvi: 'https://app.screvi.com/sources/s1' }),
		).toBe(
			'---\n' +
			'title: "Tom & Jerry: \\"A\\" Story"\n' +
			'author: "[[Jane Doe]]"\n' +
			'type: "book"\n' +
			'source: "https://x.com/a?b=1&c=2"\n' +
			'screvi: "https://app.screvi.com/sources/s1"\n' +
			'---\n',
		);
	});

	it('leaves out empty values', () => {
		expect(buildFrontmatter({ title: 'Only a title', author: '', source: undefined })).toBe('---\ntitle: "Only a title"\n---\n');
	});

	it('returns nothing when there is nothing to write', () => {
		expect(buildFrontmatter({})).toBe('');
	});
});

describe('screviSourceUrl', () => {
	it('links articles and sources to their own pages', () => {
		expect(screviSourceUrl({ article_id: 'a1', source_id: null })).toBe('https://app.screvi.com/articles/a1');
		expect(screviSourceUrl({ source_id: 's1' })).toBe('https://app.screvi.com/sources/s1');
		expect(screviSourceUrl({})).toBeUndefined();
	});
});

describe('renderSourceNote', () => {
	const book = (overrides: Partial<ScreviHighlight> = {}): ScreviHighlight => ({
		id: 'hl-1',
		content: 'A line worth keeping',
		date: '2026-01-01T00:00:00Z',
		author: 'Daniel H. Pink',
		sourceType: 'book',
		source_id: 'src-1',
		...overrides,
	});

	it('starts with a properties block holding title, linked author, type and Screvi link', () => {
		const note = makePlugin().renderSourceNote('Drive', [book()]);
		expect(note.startsWith(
			'---\ntitle: "Drive"\nauthor: "[[Daniel H. Pink]]"\ntype: "book"\nscrevi: "https://app.screvi.com/sources/src-1"\n---\n',
		)).toBe(true);
	});

	it('writes the author unlinked when auto-linking is off', () => {
		const note = makePlugin({ enableAutoLinking: false }).renderSourceNote('Drive', [book()]);
		expect(note).toContain('author: "Daniel H. Pink"\n');
		expect(note).toContain('**Author:** Daniel H. Pink\n');
	});

	it('shows the page of a highlight', () => {
		const note = makePlugin().renderSourceNote('Drive', [book({ page: '207', location: '3100' })]);
		expect(note).toContain('**Page:** 207');
		expect(note).not.toContain('**Location:**');
	});

	it('shows a book location when there is no page, and never for an article', () => {
		expect(makePlugin().renderSourceNote('Drive', [book({ location: '3100' })])).toContain('**Location:** 3100');
		const article = makePlugin().renderSourceNote('A post', [book({ sourceType: 'article', location: '412', article_id: 'a1', source_id: null })]);
		expect(article).not.toContain('**Location:**');
	});

	it('uses the source link, not the highlight link, in the header and properties', () => {
		const note = makePlugin().renderSourceNote('A post', [
			book({ sourceType: 'article', author: '', article_id: 'a1', source_id: null, source_url: 'https://medium.com/the-article', url: 'https://read.readwise.io/read/abc' }),
		]);
		expect(note).toContain('source: "https://medium.com/the-article"');
		expect(note).toContain('**URL:** [A post](https://medium.com/the-article)');
		expect(note).not.toContain('readwise.io');
	});

	it('prints no Author line and no author property when the author is unknown', () => {
		const note = makePlugin().renderSourceNote('A post', [book({ author: '', sourceType: 'article' })]);
		expect(note).not.toContain('**Author:**');
		expect(note).not.toMatch(/^author:/m);
	});

	it('marks every highlight with its id so a full sync does not add it again', () => {
		const note = makePlugin().renderSourceNote('Drive', [book(), book({ id: 'hl-2', content: 'Another' })]);
		expect(note).toContain('<!-- screvi-id:hl-1 -->\n> A line worth keeping');
		expect(note).toContain('<!-- screvi-id:hl-2 -->\n> Another');
	});

	it('writes Markdown, not HTML: apostrophes, quotes and ampersands stay as typed', () => {
		const note = makePlugin().renderSourceNote('Tom & Jerry', [
			book({ author: "O'Brien & Sons", note: 'It\'s a "note" & more', source_url: 'https://x.com/a?b=1&c=2' }),
		]);
		expect(note).toContain("**Author:** [[O'Brien & Sons]]");
		expect(note).toContain('**Note:** It\'s a "note" & more');
		expect(note).toContain('(https://x.com/a?b=1&c=2)');
		expect(note).not.toMatch(/&#39;|&quot;|&amp;/);
	});
});
