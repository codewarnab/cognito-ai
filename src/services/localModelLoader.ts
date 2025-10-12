/**
 * Local model loader for bundled extension models
 * Loads model files from the extension's bundled resources
 */

import { MODEL_VERSION } from '~constants';

export class LocalModelLoader {
    private baseUrl: string;

    constructor() {
        this.baseUrl = chrome.runtime.getURL(`models/${MODEL_VERSION}`);
    }

    /**
     * Get the full URL for a model asset
     */
    getAssetUrl(assetPath: string): string {
        return `${this.baseUrl}/${assetPath}`;
    }

    /**
     * Load model manifest from local bundle
     */
    async loadManifest(): Promise<any> {
        const manifestUrl = this.getAssetUrl('manifest.json');
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Load a model asset as ArrayBuffer
     */
    async loadAsset(assetPath: string): Promise<ArrayBuffer> {
        const assetUrl = this.getAssetUrl(assetPath);
        const response = await fetch(assetUrl);
        if (!response.ok) {
            throw new Error(`Failed to load asset ${assetPath}: ${response.statusText}`);
        }
        return response.arrayBuffer();
    }

    /**
     * Load a model asset as text
     */
    async loadAssetText(assetPath: string): Promise<string> {
        const assetUrl = this.getAssetUrl(assetPath);
        const response = await fetch(assetUrl);
        if (!response.ok) {
            throw new Error(`Failed to load asset ${assetPath}: ${response.statusText}`);
        }
        return response.text();
    }

    /**
     * Load a model asset as JSON
     */
    async loadAssetJson(assetPath: string): Promise<any> {
        const assetUrl = this.getAssetUrl(assetPath);
        const response = await fetch(assetUrl);
        if (!response.ok) {
            throw new Error(`Failed to load asset ${assetPath}: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Check if all required model files exist
     */
    async verifyModelFiles(): Promise<boolean> {
        const requiredFiles = [
            'model.onnx',
            'tokenizer.json',
            'config.json',
            'vocab.txt'
        ];

        try {
            const checks = await Promise.all(
                requiredFiles.map(async (file) => {
                    const url = this.getAssetUrl(file);
                    const response = await fetch(url, { method: 'HEAD' });
                    return response.ok;
                })
            );
            return checks.every(check => check);
        } catch (error) {
            console.error('Model file verification failed:', error);
            return false;
        }
    }

    /**
     * Get model file URLs for embedding worker
     */
    getModelUrls() {
        return {
            model: this.getAssetUrl('model.onnx'),
            tokenizer: this.getAssetUrl('tokenizer.json'),
            config: this.getAssetUrl('config.json'),
            vocab: this.getAssetUrl('vocab.txt')
        };
    }

    /**
     * Get base URL for all model assets
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }
}

// Export singleton instance
export const localModelLoader = new LocalModelLoader();
