import { describe, expect, it } from 'vitest';
import ScreviSyncPlugin from '../main';
import type { ScreviHighlight } from '../src/api';
import { MemoryVault } from './helpers/memoryVault';

function makePlugin(vault: MemoryVault): ScreviSyncPlugin {
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
	};
	(stub as unknown as { app: unknown }).app = { vault };
	stub.setupNunjucks();
	return stub;
}

const book = (id: string, content: string, extra: Partial<ScreviHighlight> = {}): ScreviHighlight => ({
	id,
	content,
	date: '2026-01-01T00:00:00Z',
	source: 'Drive',
	author: 'Daniel H. Pink',
	sourceType: 'book',
	source_id: 'src-1',
	...extra,
});

const NOTE = 'Screvi Highlights/Books/Drive.md';
const occurrences = (text: string, part: string) => text.split(part).length - 1;

describe('sync pipeline', () => {
	it('creates one note per source, in its category folder', async () => {
		const vault = new MemoryVault();
		await makePlugin(vault).processHighlights([
			book('1', 'First line'),
			book('2', 'Second line', { page: '12' }),
			book('3', 'From the web', { source: 'A post', sourceType: 'article', author: '', source_id: null, article_id: 'art-1', source_url: 'https://example.org/post' }),
		]);

		expect([...vault.files.keys()].sort()).toEqual(['Screvi Highlights/Articles/A post.md', NOTE]);
		const note = vault.files.get(NOTE)!;
		expect(note.startsWith('---\ntitle: "Drive"\n')).toBe(true);
		expect(note).toContain('> First line');
		expect(note).toContain('**Page:** 12');
	});

	it('changes nothing when the same highlights are synced again', async () => {
		const vault = new MemoryVault();
		const plugin = makePlugin(vault);
		const highlights = [book('1', 'First line'), book('2', 'Second line\nwith two lines')];
		await plugin.processHighlights(highlights);
		const before = vault.files.get(NOTE);
		vault.creates = 0;

		await plugin.processHighlights(highlights);

		expect(vault.creates).toBe(0);
		expect(vault.modifies).toBe(0);
		expect(vault.files.get(NOTE)).toBe(before);
	});

	it('appends only the new highlight to an existing note, with its marker and page', async () => {
		const vault = new MemoryVault();
		const plugin = makePlugin(vault);
		await plugin.processHighlights([book('1', 'First line')]);

		await plugin.processHighlights([book('1', 'First line'), book('2', 'Added later', { page: '88' })]);

		const note = vault.files.get(NOTE)!;
		expect(occurrences(note, '> First line')).toBe(1);
		expect(note).toContain('<!-- screvi-id:2 -->\n> Added later');
		expect(note).toContain('**Page:** 88');
	});

	// Notes from 1.0.5 and earlier: no properties, and no id markers on the
	// highlights the note was created with.
	it('does not write a highlight again over a note from an older version', async () => {
		const vault = new MemoryVault();
		await vault.seed(NOTE, '**Author:** [[Daniel H. Pink]]\n\n\n## Highlights\n\n\n> First line\n\n\n---\n\n> Second line\n> with two lines\n\n**Note:** mine\n\n---\n');
		const plugin = makePlugin(vault);

		await plugin.processHighlights([
			book('1', 'First line'),
			book('2', 'Second line\nwith two lines', { note: 'mine' }),
			book('3', 'Brand new'),
		]);

		const note = vault.files.get(NOTE)!;
		expect(occurrences(note, '> First line')).toBe(1);
		expect(occurrences(note, '> Second line')).toBe(1);
		expect(note).toContain('<!-- screvi-id:3 -->\n> Brand new');
	});

	it('does not mistake a short highlight for part of a longer one', async () => {
		const vault = new MemoryVault();
		await vault.seed(NOTE, '## Highlights\n\n> Freedom requires discipline, and more besides\n\n---\n');
		const plugin = makePlugin(vault);

		await plugin.processHighlights([book('9', 'Freedom requires discipline')]);

		expect(vault.files.get(NOTE)).toContain('<!-- screvi-id:9 -->\n> Freedom requires discipline\n');
	});

	it('finds an existing note whose name differs only by case', async () => {
		const vault = new MemoryVault();
		await vault.seed('Screvi Highlights/Books/drive.md', '## Highlights\n\n> First line\n\n---\n');
		const plugin = makePlugin(vault);

		await plugin.processHighlights([book('1', 'First line'), book('2', 'Second')]);

		expect(vault.files.size).toBe(1);
		expect(vault.files.get('Screvi Highlights/Books/drive.md')).toContain('> Second');
	});
});
