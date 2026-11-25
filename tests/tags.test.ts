import { describe, expect, it } from 'vitest';
import ScreviSyncPlugin from '../main';
import type { ScreviHighlight } from '../src/api';
import { formatObsidianTags, toObsidianTag } from '../src/utils';

describe('toObsidianTag', () => {
	it('joins the words of a tag with hyphens', () => {
		expect(toObsidianTag('org mod')).toBe('org-mod');
		expect(toObsidianTag('clojure for the brave and true')).toBe('clojure-for-the-brave-and-true');
		expect(toObsidianTag('research   design')).toBe('research-design');
	});

	it('keeps a one-word tag and its case as typed', () => {
		expect(toObsidianTag('AI')).toBe('AI');
		expect(toObsidianTag('Stoicism')).toBe('Stoicism');
	});

	it('keeps letters of any language, digits, underscores and nesting', () => {
		expect(toObsidianTag('música clássica')).toBe('música-clássica');
		expect(toObsidianTag('読書')).toBe('読書');
		expect(toObsidianTag('snake_case')).toBe('snake_case');
		expect(toObsidianTag('Project/Sub Tag')).toBe('Project/Sub-Tag');
	});

	it('drops punctuation a tag cannot hold', () => {
		expect(toObsidianTag('00. Article | Quotes')).toBe('00-Article-Quotes');
		expect(toObsidianTag('02.H Chronic diseases')).toBe('02H-Chronic-diseases');
		expect(toObsidianTag("it's (new)!")).toBe('its-new');
	});

	it('tidies stray hashes, hyphens and slashes', () => {
		expect(toObsidianTag('#already')).toBe('already');
		expect(toObsidianTag(' - spaced - ')).toBe('spaced');
		expect(toObsidianTag('a // b')).toBe('a/b');
		expect(toObsidianTag('/lead/trail/')).toBe('lead/trail');
	});

	it('makes a digits-only tag valid', () => {
		expect(toObsidianTag('2024')).toBe('_2024');
	});

	it('returns nothing for a tag with no usable characters', () => {
		expect(toObsidianTag('?')).toBe('');
		expect(toObsidianTag('$')).toBe('');
		expect(toObsidianTag('   ')).toBe('');
	});
});

describe('formatObsidianTags', () => {
	it('writes one line of tags', () => {
		expect(formatObsidianTags([{ name: 'AI' }, { name: 'org mod' }])).toBe('#AI, #org-mod');
	});

	it('leaves out unusable tags and repeats', () => {
		expect(formatObsidianTags([{ name: '?' }, { name: 'Big Idea' }, { name: 'big idea' }, 'plain'])).toBe('#Big-Idea, #plain');
	});

	it('is empty when there is nothing to write', () => {
		expect(formatObsidianTags([])).toBe('');
		expect(formatObsidianTags(undefined)).toBe('');
		expect(formatObsidianTags([{ name: '???' }])).toBe('');
	});
});

describe('tags in a note', () => {
	const plugin = Object.create(ScreviSyncPlugin.prototype) as ScreviSyncPlugin;
	plugin.settings = { apiKey: '', syncInterval: 2, defaultFolder: 'x', autoSync: true, lastSyncTime: 0, includeMetadata: true, tagPrefix: 'screvi', autoLinkFields: ['author'], enableAutoLinking: true, syncedCategories: { books: true, posts: true, articles: true, documents: true, youtube: true, personalNotes: true } };
	plugin.setupNunjucks();
	const hl = (tags: ScreviHighlight['tags']): ScreviHighlight => ({ id: '1', content: 'A line', date: 'd', sourceType: 'book', source_id: 's', tags });

	it('writes each tag as one Obsidian tag', () => {
		const note = plugin.renderSourceNote('Drive', [hl([{ name: 'org mod' }, { name: 'AI' }])]);
		expect(note).toContain('> A line\n#org-mod, #AI\n');
	});

	it('writes no tag line, and no empty line for it, when a highlight has no tags', () => {
		expect(plugin.renderSourceNote('Drive', [hl([])])).toContain('> A line\n\n---\n');
		expect(plugin.renderSourceNote('Drive', [hl([{ name: '?' }])])).toContain('> A line\n\n---\n');
	});
});
