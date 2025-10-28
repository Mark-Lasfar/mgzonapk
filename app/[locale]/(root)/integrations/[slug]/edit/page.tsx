'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { Loader2, Trash2, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { ClientApplication } from '@/lib/types';

// Define the categories enum to match z.enum
const categoriesEnum = [
  'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing',
  'accounting', 'crm', 'analytics', 'automation', 'communication', 'education',
  'security', 'advertising', 'tax', 'other',
] as const;
type Category = typeof categoriesEnum[number];

const clientUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  redirectUris: z.array(z.string().url('Invalid redirect URI')).min(1, 'At least one redirect URI is required'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  customScopes: z.array(z.string().regex(/^[a-zA-Z0-9:]+$/, 'Invalid custom scope format')).optional(),
  features: z.array(z.string().max(200, 'Feature cannot exceed 200 characters')).optional(),
  categories: z.array(z.enum(categoriesEnum)).optional(),
  isMarketplaceApp: z.boolean().default(false),
});

type ClientUpdateForm = z.infer<typeof clientUpdateSchema>;

interface Token {
  id: string;
  accessToken: string;
  expiresAt: string;
}

export default function EditClientPage() {
  const t = useTranslations('integrations.edit');
  const { toast } = useToast();
  const { slug } = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientApplication | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [newCustomScope, setNewCustomScope] = useState('');
  const [newFeature, setNewFeature] = useState('');

  const form = useForm<ClientUpdateForm>({
    resolver: zodResolver(clientUpdateSchema),
    defaultValues: {
      name: '',
      redirectUris: [],
      description: '',
      logoUrl: '',
      scopes: ['profile:read'],
      customScopes: [],
      features: [],
      categories: [],
      isMarketplaceApp: false,
    },
  });

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch(`/api/v1/clients?slug=${slug}`);
        if (!response.ok) throw new Error(t('errors.fetchFailed'));
        const result = await response.json();
        if (result.success && result.data.clients.length > 0) {
          const clientData = result.data.clients[0];
          setClient(clientData);
          form.reset({
            name: clientData.name,
            redirectUris: clientData.redirectUris,
            description: clientData.description || '',
            logoUrl: clientData.logoUrl || '',
            scopes: clientData.scopes,
            customScopes: clientData.customScopes || [],
            features: clientData.features || [],
            categories: clientData.categories || [],
            isMarketplaceApp: clientData.isMarketplaceApp || false,
          });
        } else {
          router.push('/account/APIKEY');
          toast({
            variant: 'destructive',
            title: t('error.title'),
            description: t('error.clientNotFound'),
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error.title'),
          description: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchClient();
  }, [slug, t, toast, router, form]);

  useEffect(() => {
    async function fetchTokens() {
      if (!client) return;
      try {
        const response = await fetch(`/api/v1/clients/${client.clientId}/tokens`);
        if (!response.ok) throw new Error(t('errors.fetchTokensFailed'));
        const result = await response.json();
        if (result.success) {
          setTokens(result.data);
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error.title'),
          description: String(error),
        });
      }
    }
    if (client) fetchTokens();
  }, [client, t, toast]);

  const publishToMarketplaceRequest = async (clientId: string) => {
    if (!confirm(t('confirm.publishToMarketplace'))) return;
    try {
      const response = await fetch(`/api/v1/clients/${clientId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(t('errors.publishFailed'));
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.publishFailed'));
      setClient((prev: ClientApplication | null) =>
        prev ? { ...prev, isMarketplaceApp: true, status: 'pending' } : null
      );
      toast({
        title: t('success.publishRequested'),
        description: t('success.publishRequestedMessage'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm(t('confirm.revokeToken'))) return;
    try {
      const response = await fetch(`/api/v1/clients/${client?.clientId}/tokens?tokenId=${tokenId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t('errors.revokeTokenFailed'));
      setTokens(tokens.filter((token) => token.id !== tokenId));
      toast({
        title: t('success.title'),
        description: t('success.tokenRevoked'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    }
  };

  const onSubmit = async (data: ClientUpdateForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/clients/${client?.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(t('errors.updateFailed'));
      toast({
        title: t('success.title'),
        description: t('success.updated'),
      });
      router.push('/account/APIKEY');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addRedirectUri = () => {
    if (newRedirectUri && /^https?:\/\/.+$/.test(newRedirectUri)) {
      form.setValue('redirectUris', [...(form.getValues('redirectUris') ?? []), newRedirectUri]);
      setNewRedirectUri('');
    } else {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: t('errors.invalidRedirectUri'),
      });
    }
  };

  const removeRedirectUri = (index: number) => {
    form.setValue('redirectUris', (form.getValues('redirectUris') ?? []).filter((_, i) => i !== index));
  };

  const addCustomScope = () => {
    if (newCustomScope && /^[a-zA-Z0-9:]+$/.test(newCustomScope)) {
      form.setValue('customScopes', [...(form.getValues('customScopes') ?? []), newCustomScope]);
      setNewCustomScope('');
    } else {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: t('errors.invalidCustomScope'),
      });
    }
  };

  const removeCustomScope = (index: number) => {
    form.setValue('customScopes', (form.getValues('customScopes') ?? []).filter((_, i) => i !== index));
  };

  const addFeature = () => {
    if (newFeature && newFeature.length <= 200) {
      form.setValue('features', [...(form.getValues('features') ?? []), newFeature]);
      setNewFeature('');
    } else {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: t('errors.featureMaxLength'),
      });
    }
  };

  const removeFeature = (index: number) => {
    form.setValue('features', (form.getValues('features') ?? []).filter((_, i) => i !== index));
  };

  if (isLoading || !client) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    );
  }

  const availableScopes = [
    'profile:read', 'profile:write',
    'products:read', 'products:write',
    'orders:read', 'orders:write',
    'customers:read', 'customers:write',
    'inventory:read', 'inventory:write',
    'analytics:read',
  ];

  const availableCategories: Category[] = [
    'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing',
    'accounting', 'crm', 'analytics', 'automation', 'communication', 'education',
    'security', 'advertising', 'tax', 'other',
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title', { name: client.name })}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isMarketplaceApp"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked && !client.isMarketplaceApp) {
                        publishToMarketplaceRequest(client.clientId);
                      }
                    }}
                    disabled={isLoading || client.isMarketplaceApp}
                  />
                </FormControl>
                <FormLabel>
                  {t('publishToMarketplace')}{' '}
                  <Link href="/integrations" className="text-blue-600 hover:underline">
                    {t('marketplaceLink')}
                  </Link>
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('description')}</FormLabel>
                <FormControl>
                  <Textarea {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logoUrl')}</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-4">
            <FormLabel>{t('redirectUris')}</FormLabel>
            <div className="flex gap-2">
              <Input
                value={newRedirectUri}
                onChange={(e) => setNewRedirectUri(e.target.value)}
                placeholder={t('addRedirectUri')}
                disabled={isLoading}
              />
              <Button type="button" onClick={addRedirectUri} disabled={isLoading}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {t('add')}
              </Button>
            </div>
            {(form.getValues('redirectUris') ?? []).length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('redirectUri')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(form.getValues('redirectUris') ?? []).map((uri, index) => (
                    <TableRow key={index}>
                      <TableCell>{uri}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeRedirectUri(index)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <FormMessage>{form.formState.errors.redirectUris?.message}</FormMessage>
          </div>
          <div className="space-y-4">
            <FormLabel>{t('scopes')}</FormLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {availableScopes.map((scope) => (
                <div key={scope} className="flex items-center space-x-2">
                  <Checkbox
                    id={`scope-${scope}`}
                    checked={(form.getValues('scopes') ?? []).includes(scope)}
                    onCheckedChange={(checked) => {
                      form.setValue(
                        'scopes',
                        checked
                          ? [...(form.getValues('scopes') ?? []), scope]
                          : (form.getValues('scopes') ?? []).filter((s) => s !== scope)
                      );
                    }}
                    disabled={isLoading}
                  />
                  <FormLabel htmlFor={`scope-${scope}`}>{scope}</FormLabel>
                </div>
              ))}
            </div>
            <FormMessage>{form.formState.errors.scopes?.message}</FormMessage>
          </div>
          <div className="space-y-4">
            <FormLabel>{t('customScopes')}</FormLabel>
            <div className="flex gap-2">
              <Input
                value={newCustomScope}
                onChange={(e) => setNewCustomScope(e.target.value)}
                placeholder={t('addCustomScope')}
                disabled={isLoading}
              />
              <Button type="button" onClick={addCustomScope} disabled={isLoading}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {t('add')}
              </Button>
            </div>
            {(form.getValues('customScopes') ?? []).length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('customScope')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(form.getValues('customScopes') ?? []).map((scope, index) => (
                    <TableRow key={index}>
                      <TableCell>{scope}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeCustomScope(index)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <FormMessage>{form.formState.errors.customScopes?.message}</FormMessage>
          </div>
          <div className="space-y-4">
            <FormLabel>{t('features')}</FormLabel>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder={t('addFeature')}
                disabled={isLoading}
              />
              <Button type="button" onClick={addFeature} disabled={isLoading}>
                <PlusCircle className="h-4 w-4 mr-2" />
                {t('add')}
              </Button>
            </div>
            {(form.getValues('features') ?? []).length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('feature')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(form.getValues('features') ?? []).map((feature, index) => (
                    <TableRow key={index}>
                      <TableCell>{feature}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFeature(index)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <FormMessage>{form.formState.errors.features?.message}</FormMessage>
          </div>
          <div className="space-y-4">
            <FormLabel>{t('categories')}</FormLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {availableCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={(form.getValues('categories') ?? []).includes(category)}
                    onCheckedChange={(checked) => {
                      form.setValue(
                        'categories',
                        checked
                          ? [...(form.getValues('categories') ?? []), category]
                          : (form.getValues('categories') ?? []).filter((c) => c !== category)
                      );
                    }}
                    disabled={isLoading}
                  />
                  <FormLabel htmlFor={`category-${category}`}>{t(category)}</FormLabel>
                </div>
              ))}
            </div>
            <FormMessage>{form.formState.errors.categories?.message}</FormMessage>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('save')}
          </Button>
        </form>
      </Form>
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">{t('tokens')}</h2>
        {tokens.length === 0 ? (
          <p>{t('noTokens')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accessToken')}</TableHead>
                <TableHead>{t('expiresAt')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>{token.accessToken.slice(0, 10)}...</TableCell>
                  <TableCell>{new Date(token.expiresAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revokeToken(token.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> {t('revoke')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}