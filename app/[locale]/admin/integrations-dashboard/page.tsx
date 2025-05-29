'use client';

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function IntegrationsDashboard() {
  const router = useRouter();
  const { locale } = useParams();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Integrations & API Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => router.push(`/${locale}/admin/integrations`)}>
            Manage Integrations
          </Button>
          <Button onClick={() => router.push(`/${locale}/admin/api-keys`)}>
            API Key Management
          </Button>
          <Button onClick={() => router.push(`/${locale}/admin/integration-instructions`)}>
            Help & Documentation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}