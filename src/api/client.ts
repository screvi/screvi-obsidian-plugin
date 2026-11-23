import { requestUrl } from 'obsidian';
import { ScreviHighlight, API_BASE_URL } from './types';
import { mapExportSources } from './mapExport';

export class ScreviApiClient {
	private apiKey: string;
	private apiUrl: string;

	constructor(apiKey: string, apiUrl: string = API_BASE_URL) {
		this.apiKey = apiKey;
		this.apiUrl = apiUrl;
	}

	private async makeRequest<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
		const url = new URL(`${this.apiUrl}${endpoint}`);
		
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					// Convert value to string, handling objects and arrays properly
					let stringValue: string;
					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						stringValue = String(value);
					} else if (value instanceof Date) {
						stringValue = value.toISOString();
					} else {
						// For objects and arrays, use JSON.stringify
						stringValue = JSON.stringify(value);
					}
					url.searchParams.append(key, stringValue);
				}
			});
		}

		// throw: false so a 401 surfaces as a status we can explain, rather than
		// Obsidian's bare "Request failed" — which tells the user nothing about
		// which of their key, their subscription, or our server is at fault.
		const response = await requestUrl({
			url: url.toString(),
			throw: false,
			headers: {
				'X-API-Key': this.apiKey,
				'Content-Type': 'application/json'
			}
		});

		if (response.status === 401) {
			throw new Error(
				'Screvi rejected the API key (401). Copy it again from Screvi → Settings → API, ' +
				'and make sure the whole value was pasted.'
			);
		}

		if (response.status === 403) {
			throw new Error(
				'Screvi refused the request (403). This usually means the account is in read-only ' +
				'mode because the subscription lapsed.'
			);
		}

		if (response.status === 429) {
			throw new Error('Screvi rate limit reached (429). Try syncing again in a few minutes.');
		}

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Screvi API request failed (${response.status}).`);
		}

		return response.json as T;
	}

	async fetchHighlightsSince(start_from?: number): Promise<ScreviHighlight[]> {
		const MAX_PAGES = 1000;
		let allSources: unknown[] = [];
		let currentPage = 1;
		let hasMore = true;

		// Fetch all pages with start_from parameter using consistent endpoint
		while (hasMore && currentPage <= MAX_PAGES) {
			const params: Record<string, unknown> = {
				format: 'markdown',
				page: currentPage
			};

			if (start_from) {
				// Convert timestamp to ISO string format for database compatibility
				params.start_from = new Date(start_from).toISOString();
			}

			const response = await this.makeRequest<{ data?: unknown[]; pagination?: { hasMore?: boolean } } | unknown[]>('/api/highlights/export', params);

			// Handle both possible response structures
			const responseData = Array.isArray(response) ? response : (response as { data?: unknown[] }).data || [];
			allSources = [...allSources, ...responseData];

			hasMore = !Array.isArray(response) &&
				((response as { pagination?: { hasMore?: boolean } }).pagination?.hasMore ?? false);
			currentPage++;
		}

		return mapExportSources(allSources);
	}

	updateCredentials(apiKey: string, apiUrl: string = API_BASE_URL) {
		this.apiKey = apiKey;
		this.apiUrl = apiUrl;
	}
}
