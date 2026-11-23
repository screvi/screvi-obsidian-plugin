import { TFile, TFolder } from 'obsidian';

/**
 * An in-memory stand-in for Obsidian's vault, with the calls the plugin makes
 * while writing notes. Paths are exact-case in the index, like Obsidian's, and
 * `create` refuses a path that differs from an existing one only by case, like
 * a macOS or Windows disk.
 */
export class MemoryVault {
	files = new Map<string, string>();
	private nodes = new Map<string, TFile | TFolder>();
	creates = 0;
	modifies = 0;

	private parentOf(path: string): string {
		const i = path.lastIndexOf('/');
		return i < 0 ? '' : path.slice(0, i);
	}

	private attach(node: TFile | TFolder) {
		const parent = this.nodes.get(this.parentOf(node.path));
		if (parent instanceof TFolder) parent.children.push(node);
	}

	getAbstractFileByPath(path: string): TFile | TFolder | null {
		return this.nodes.get(path) ?? null;
	}

	async createFolder(path: string): Promise<void> {
		if (this.nodes.has(path)) throw new Error('Folder already exists.');
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.split('/').pop() || '';
		this.nodes.set(path, folder);
		this.attach(folder);
	}

	async create(path: string, content: string): Promise<TFile> {
		const lower = path.toLowerCase();
		for (const existing of this.files.keys()) {
			if (existing.toLowerCase() === lower) throw new Error('File already exists.');
		}
		const file = new TFile();
		file.path = path;
		file.name = path.split('/').pop() || '';
		this.files.set(path, content);
		this.nodes.set(path, file);
		this.attach(file);
		this.creates++;
		return file;
	}

	async read(file: TFile): Promise<string> {
		return this.files.get(file.path) ?? '';
	}

	async modify(file: TFile, content: string): Promise<void> {
		this.files.set(file.path, content);
		this.modifies++;
	}

	/** Put a file in place as if an earlier version of the plugin wrote it. */
	async seed(path: string, content: string): Promise<void> {
		const parts = path.split('/');
		for (let i = 1; i < parts.length; i++) {
			const folder = parts.slice(0, i).join('/');
			if (!this.nodes.has(folder)) await this.createFolder(folder);
		}
		await this.create(path, content);
		this.creates = 0;
	}
}
