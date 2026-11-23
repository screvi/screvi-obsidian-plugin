const APP_URL = 'https://app.screvi.com';

export interface NoteProperties {
	title?: string;
	/** Already wrapped in [[ ]] when author auto-linking is on. */
	author?: string;
	/** The source type as Screvi names it: book, article, tweet, ... */
	type?: string;
	/** Where the book or article itself lives. */
	source?: string;
	/** The same source inside Screvi. */
	screvi?: string;
}

/** A YAML double-quoted scalar. JSON string syntax is valid there. */
function yamlString(value: string): string {
	return JSON.stringify(value);
}

/**
 * The properties block at the top of a source's note, so the note is more
 * than text: Obsidian's Properties view, Dataview and Bases can read it, and
 * a linked author connects it to the rest of the vault. Empty values are left
 * out; returns '' when there is nothing to write.
 */
export function buildFrontmatter(properties: NoteProperties): string {
	const order: (keyof NoteProperties)[] = ['title', 'author', 'type', 'source', 'screvi'];
	const lines: string[] = [];
	for (const key of order) {
		const value = properties[key];
		if (typeof value === 'string' && value.trim()) {
			lines.push(`${key}: ${yamlString(value.trim())}`);
		}
	}
	return lines.length ? `---\n${lines.join('\n')}\n---\n` : '';
}

/** Link to a source in the Screvi web app. Exactly one id is set per source. */
export function screviSourceUrl(ids: { source_id?: string | null; article_id?: string | null }): string | undefined {
	if (ids.article_id) return `${APP_URL}/articles/${ids.article_id}`;
	if (ids.source_id) return `${APP_URL}/sources/${ids.source_id}`;
	return undefined;
}
