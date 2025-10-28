'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, Info } from 'lucide-react';
import Image from 'next/image';

// واجهة لتعريف قالب التكامل
interface IntegrationTemplate {
  type: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
  logo: string;
  description: string;
  guideUrl: string;
  oauth?: boolean; // خاصية اختيارية
}

// قوالب التكاملات الجاهزة
const integrationTemplates: Record<string, IntegrationTemplate> = {
  stripe: {
    type: 'payment',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false },
    ],
    logo: '/integrations/stripe.svg',
    description: 'Connect with Stripe to process payments securely (suitable for USA, Europe, etc.).',
    guideUrl: 'https://stripe.com/docs/keys',
  },
  paypal: {
    type: 'payment',
    oauth: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    ],
    logo: '/integrations/paypal.png',
    description: 'Connect with PayPal to accept payments globally.',
    guideUrl: 'https://developer.paypal.com/docs/api/overview/',
  },
  klarna: {
    type: 'payment',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'merchantId', label: 'Merchant ID', type: 'text', required: true },
    ],
    logo: '/integrations/klarna.png',
    description: 'Connect with Klarna for flexible payment options (popular in Europe).',
    guideUrl: 'https://developers.klarna.com/',
  },
  paystack: {
    type: 'payment',
    fields: [
      { key: 'publicKey', label: 'Public Key', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
    ],
    logo: '/integrations/paystack.png',
    description: 'Connect with Paystack for payments in Africa (including Egypt).',
    guideUrl: 'https://paystack.com/docs/',
  },
  adyen: {
    type: 'payment',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'merchantAccount', label: 'Merchant Account', type: 'text', required: true },
    ],
    logo: '/integrations/adyen.png',
    description: 'Connect with Adyen for global payments (Europe, USA, etc.).',
    guideUrl: 'https://docs.adyen.com/',
  },
  razorpay: {
    type: 'payment',
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text', required: true },
      { key: 'keySecret', label: 'Key Secret', type: 'password', required: true },
    ],
    logo: '/integrations/razorpay.png',
    description: 'Connect with Razorpay for payments in India and beyond.',
    guideUrl: 'https://razorpay.com/docs/',
  },
  gmail: {
    type: 'communication',
    oauth: true,
    fields: [],
    logo: '/integrations/gmail.png',
    description: 'Connect with Gmail to send automated email replies.',
    guideUrl: 'https://support.google.com/mail/answer/185833',
  },
  whatsapp: {
    type: 'communication',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: true },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', required: true },
    ],
    logo: '/integrations/whatsapp.png',
    description: 'Connect with WhatsApp to send automated messages to customers.',
    guideUrl: 'https://developers.facebook.com/docs/whatsapp',
  },
  amazon: {
    type: 'dropshipping',
    oauth: true,
    fields: [
      { key: 'sellerId', label: 'Seller ID', type: 'text', required: true },
    ],
    logo: '/integrations/amazon.png',
    description: 'Connect with Amazon for dropshipping and marketplace integration.',
    guideUrl: 'https://developer.amazonservices.com/',
  },
  aliexpress: {
    type: 'dropshipping',
    fields: [
      { key: 'appKey', label: 'App Key', type: 'text', required: true },
      { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
    ],
    logo: '/integrations/aliexpress.png',
    description: 'Connect with AliExpress for dropshipping products globally.',
    guideUrl: 'https://developers.aliexpress.com/',
  },
  shopify: {
    type: 'dropshipping',
    oauth: true,
    fields: [
      { key: 'storeName', label: 'Shopify Store Name', type: 'text', required: true },
    ],
    logo: '/integrations/shopify.png',
    description: 'Connect with Shopify for dropshipping and e-commerce integration.',
    guideUrl: 'https://shopify.dev/docs/',
  },
  shipbob: {
    type: 'warehouse',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'warehouseId', label: 'Warehouse ID', type: 'text', required: true },
      { key: 'inventorySyncUrl', label: 'Inventory Sync URL', type: 'text', required: false },
    ],
    logo: '/integrations/shipbob.png',
    description: 'Connect with ShipBob to manage multiple warehouse inventories.',
    guideUrl: 'https://developer.shipbob.com/',
  },
  fba: {
    type: 'warehouse',
    oauth: true,
    fields: [
      { key: 'sellerId', label: 'Seller ID', type: 'text', required: true },
    ],
    logo: '/integrations/amazon-fba.png',
    description: 'Connect with Fulfillment by Amazon (FBA) for warehouse management.',
    guideUrl: 'https://developer.amazonservices.com/',
  },
  shipstation: {
    type: 'warehouse',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    ],
    logo: '/integrations/shipstation.png',
    description: 'Connect with ShipStation for warehouse and shipping management.',
    guideUrl: 'https://www.shipstation.com/docs/api/',
  },
  googleAds: {
    type: 'advertising',
    oauth: true,
    fields: [
      { key: 'adAccountId', label: 'Ad Account ID', type: 'text', required: true },
    ],
    logo: '/integrations/google-ads.png',
    description: 'Connect with Google Ads to manage your advertising campaigns.',
    guideUrl: 'https://developers.google.com/google-ads/api/docs',
  },
  quickbooks: {
    type: 'accounting',
    oauth: true,
    fields: [
      { key: 'companyId', label: 'Company ID', type: 'text', required: true },
    ],
    logo: '/integrations/quickbooks.png',
    description: 'Connect with QuickBooks for accounting and invoice management.',
    guideUrl: 'https://developer.intuit.com/app/developer/qbo/docs/develop',
  },
  hubspot: {
    type: 'crm',
    oauth: true,
    fields: [],
    logo: '/integrations/hubspot.png',
    description: 'Connect with HubSpot for CRM and marketing automation.',
    guideUrl: 'https://developers.hubspot.com/docs/api/overview',
  },
  easyship: {
    type: 'shipping',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
    ],
    logo: '/integrations/easyship.png',
    description: 'Connect with Easyship for international shipping solutions.',
    guideUrl: 'https://developers.easyship.com/',
  },
};

interface Integration {
  _id: string;
  providerName: string;
  type: string;
  isActive: boolean;
  credentials?: Record<string, string>;
  logoUrl?: string;
  status?: string;
  description?: string;
  guideUrl?: string;
}

interface Props {
  storeId: string;
}

export default function IntegrationsManager({ storeId }: Props) {
  const t = useTranslations('IntegrationsManager');
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const response = await fetch(`/api/seller/integrations?storeId=${storeId}`);
        const result = await response.json();
        if (result.success) {
          setIntegrations(result.data);
        } else {
          throw new Error(result.error || t('fetchIntegrationsFailed'));
        }
      } catch (error) {
        toast({
          title: t('error'),
          description: error instanceof Error ? error.message : t('fetchIntegrationsFailed'),
          variant: 'destructive',
        });
      }
    };
    fetchIntegrations();
  }, [storeId, t, toast]);

  const addIntegration = async () => {
    setIsLoading(true);
    try {
      const template = integrationTemplates[selectedTemplate as keyof typeof integrationTemplates];
      if (!template) throw new Error(t('selectTemplate'));

      // إذا كان OAuth مفعل، لا نطلب حقول يدوية
      if (template.oauth) {
        await connectWithOAuth(selectedTemplate);
        return;
      }

      // التحقق من الحقول المطلوبة
      for (const field of template.fields) {
        if (field.required && !credentials[field.key]) {
          throw new Error(t('requiredField', { field: field.label }));
        }
      }

      const response = await fetch(`/api/seller/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          providerName: selectedTemplate,
          type: template.type,
          credentials,
          logoUrl: template.logo,
          description: template.description,
          guideUrl: template.guideUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('addIntegrationFailed'));
      }
      setIntegrations([...integrations, result.data]);
      setCredentials({});
      setSelectedTemplate('');
      toast({ title: t('success'), description: t('integrationAdded') });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('addIntegrationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const connectWithOAuth = async (provider: string) => {
    try {
      const response = await fetch(`/api/seller/integrations/oauth/authorize?provider=${provider}`);
      const result = await response.json();
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl; // توجيه المستخدم لتسجيل الدخول
      } else {
        throw new Error(t('oauthFailed'));
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('oauthFailed'),
        variant: 'destructive',
      });
    }
  };

  const testIntegration = async (integrationId: string) => {
    setIsLoading(true);
    try {
      const integration = integrations.find((i) => i._id === integrationId);
      if (!integration) throw new Error(t('integrationNotFound'));

      const response = await fetch(`/api/seller/integrations/${integrationId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, type: integration.type }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('testIntegrationFailed'));
      }

      let message = t('testIntegrationSuccess');
      if (integration.type === 'communication') {
        message = t('testCommunicationSuccess'); // مثلًا: "Test email/message sent successfully"
      } else if (integration.type === 'payment') {
        message = t('testPaymentSuccess'); // مثلًا: "Test payment processed successfully"
      } else if (integration.type === 'warehouse') {
        message = t('testWarehouseSuccess'); // مثلًا: "Inventory sync test completed"
      } else if (integration.type === 'dropshipping') {
        message = t('testDropshippingSuccess'); // مثلًا: "Product import test completed"
      } else if (integration.type === 'advertising') {
        message = t('testAdvertisingSuccess'); // مثلًا: "Ad campaign test completed"
      } else if (integration.type === 'accounting') {
        message = t('testAccountingSuccess'); // مثلًا: "Test invoice created successfully"
      } else if (integration.type === 'crm') {
        message = t('testCrmSuccess'); // مثلًا: "Test contact synced successfully"
      } else if (integration.type === 'shipping') {
        message = t('testShippingSuccess'); // مثلًا: "Test shipping label generated successfully"
      }
      toast({ title: t('success'), description: message });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('testIntegrationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/integrations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, integrationId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('deleteIntegrationFailed'));
      }
      setIntegrations(integrations.filter((i) => i._id !== integrationId));
      toast({ title: t('success'), description: t('integrationDeleted') });
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('deleteIntegrationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('manageIntegrations')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select
            value={selectedTemplate}
            onValueChange={(value) => {
              setSelectedTemplate(value);
              setCredentials({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectIntegration')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(integrationTemplates).map(([key, template]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {template.logo && (
                      <Image src={template.logo} alt={key} width={24} height={24} />
                    )}
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() =>
              integrationTemplates[selectedTemplate as keyof typeof integrationTemplates]?.oauth
                ? connectWithOAuth(selectedTemplate)
                : addIntegration()
            }
            disabled={isLoading || !selectedTemplate}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {integrationTemplates[selectedTemplate as keyof typeof integrationTemplates]?.oauth
              ? t('connectWith', { provider: selectedTemplate })
              : t('addIntegration')}
          </Button>
        </div>
        {selectedTemplate && (
          <div className="space-y-2">
            {integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].description && (
              <p className="text-sm text-gray-600">
                {integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].description}
                {integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].guideUrl && (
                  <a
                    href={integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600"
                  >
                    {t('learnMore')}
                  </a>
                )}
              </p>
            )}
            {!integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].oauth &&
              integrationTemplates[selectedTemplate as keyof typeof integrationTemplates].fields.map((field) => (
                <div key={field.key} className="flex gap-2">
                  <Input
                    type={field.type}
                    placeholder={field.label}
                    value={credentials[field.key] || ''}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field.key]: e.target.value })
                    }
                  />
                </div>
              ))}
          </div>
        )}
        <div className="space-y-2">
          {integrations.map((integration) => (
            <div key={integration._id} className="flex items-center gap-2 p-2 border rounded">
              {integration.logoUrl && (
                <Image src={integration.logoUrl} alt={integration.providerName} width={24} height={24} />
              )}
              <span>{integration.providerName}</span>
              <span>{t(integration.type)}</span>
              <span>{integration.isActive ? t('active') : t('inactive')}</span>
              <span>{integration.status || 'disconnected'}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testIntegration(integration._id)}
                disabled={isLoading}
              >
                {t('test')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteIntegration(integration._id)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {integration.guideUrl && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.open(integration.guideUrl, '_blank')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}