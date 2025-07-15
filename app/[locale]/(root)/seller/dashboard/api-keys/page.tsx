'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Trash2, PlusCircle } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: string;
}

const apiKeySchema = z.object({
  name: z.string().min(1, 'API Key name is required').max(100, 'API Key name cannot exceed 100 characters'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

type ApiKeyForm = z.infer<typeof apiKeySchema>;

const availableScopes = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'ads:read',
  'ads:write',
  'integrations:read',
  'integrations:write',
];

export default function SellerApiKeysPage() {
  const t = useTranslations('seller.apiKeys');
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<ApiKeyForm>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: '',
      scopes: [],
    },
  });

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/seller/api-keys');
        if (!response.ok) throw new Error('Failed to fetch API keys');
        const { data } = await response.json();
        setApiKeys(data);
      } catch (error) {
        toast({ variant: 'destructive', title: t('errorTitle'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    fetchApiKeys();
  }, [t]);

  const onSubmit = async (data: ApiKeyForm) => {
    try {
      const response = await fetch('/api/seller/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create API key');
      const { data: newKey } = await response.json();
      setApiKeys([...apiKeys, { ...newKey, createdAt: new Date().toISOString() }]);
      toast({ title: t('successTitle'), description: t('created') });
      form.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: String(error) });
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      const response = await fetch(`/api/seller/api-keys?keyId=${keyId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete API key');
      setApiKeys(apiKeys.filter((key) => key.id !== keyId));
      toast({ title: t('successTitle'), description: t('deleted') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: String(error) });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('createApiKey')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('namePlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('scopes')}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange([...field.value, value])}
                      defaultValue=""
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectScopes')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableScopes.map((scope) => (
                          <SelectItem key={scope} value={scope}>
                            {scope}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {field.value.map((scope) => (
                        <div key={scope} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                          <span>{scope}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => field.onChange(field.value.filter((s) => s !== scope))}
                            className="ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{t('create')}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('apiKeys')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('key')}</TableHead>
                  <TableHead>{t('scopes')}</TableHead>
                  <TableHead>{t('createdAt')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell>{key.key}</TableCell>
                    <TableCell>{key.scopes.join(', ')}</TableCell>
                    <TableCell>{new Date(key.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(key.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}