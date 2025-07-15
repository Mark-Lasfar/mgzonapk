'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';

const ShipBobForm: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, status } = useSession();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      if (status !== 'authenticated' || !session?.user?.id) {
        throw new Error('Authentication required');
      }

      const clientId = 'ExternalApplication_ab0e85d2-1fdb-4256-80bc-7e349596b04f';
      const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/api/shipbob/oauth/callback`);
      const authUrl = `https://auth.shipbob.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=read_write&state=${encodeURIComponent(session.user.id)}`;

      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Unable to connect to ShipBob',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={isLoading || status === 'loading'}>
      {isLoading ? 'Connecting...' : 'Connect to ShipBob'}
    </Button>
  );
};

export default ShipBobForm;