import { logger } from '@/lib/api/services/logging';
import Stripe from 'stripe';
import Integration from '@/lib/db/models/integration.model';

export async function validateIntegrationCredentials({
  providerName,
  credentials,
  sandbox = false,
}: {
  providerName: string;
  credentials: Record<string, string>;
  sandbox?: boolean;
}) {
  try {
    const integration = await Integration.findOne({ providerName, isActive: true });
    if (!integration) {
      throw new Error(`Integration not found: ${providerName}`);
    }
    const { apiEndpoints } = integration;
    if (!apiEndpoints?.testCredentials) {
      throw new Error(`No test endpoint defined for ${providerName}`);
    }
    const response = await axios.get(apiEndpoints.testCredentials, {
      headers: { Authorization: `Bearer ${credentials.apiKey || credentials.accessToken}` },
    });
    if (!(response.data as { success: boolean }).success) {
      throw new Error(`Invalid credentials for ${providerName}`);
    }
    logger.info('Credentials validated', { providerName, sandbox });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Credential validation failed', { providerName, error: errorMessage, sandbox });
    throw error;
  }
}