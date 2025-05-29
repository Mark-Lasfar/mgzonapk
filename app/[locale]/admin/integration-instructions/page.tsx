'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function IntegrationInstructions() {
  const router = useRouter();
  const { locale } = useParams();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Integration & API Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Follow these instructions to configure your external integrations:
          </p>
          <ol className="list-decimal list-inside my-2">
            <li>Create or update your API keys in the API Key Management section.</li>
            <li>Configure integration settings for each provider (Amazon, ShipBob, 4PX, etc.).</li>
            <li>Import or sync product data from external sources.</li>
            <li>Set up your seller account and link it to external integrations.</li>
            <li>Monitor fulfillment, inventory, and order statuses via the dashboard.</li>
            <li>Test integration by creating sample orders and tracking them.</li>
          </ol>
          <p>
            Use the buttons above to navigate to the proper sections for managing these features.
          </p>
          <Button 
            onClick={() => router.push(`/${locale}/admin/integrations-dashboard`)} 
            variant="outline" 
            className="mt-4"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}