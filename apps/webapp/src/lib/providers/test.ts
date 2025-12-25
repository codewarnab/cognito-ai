import { extensionAPI } from '../extension-api';
import type { ConfigProvider } from '@cognito/shared';

export async function testProvider(provider: ConfigProvider): Promise<boolean> {
    try {
        const response = await extensionAPI.testProviderConnection(provider);
        return response.success;
    } catch (error) {
        console.error('Provider test failed:', error);
        return false;
    }
}
