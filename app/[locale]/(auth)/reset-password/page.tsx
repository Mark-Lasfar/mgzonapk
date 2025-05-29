'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function ResetPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('recoveryEmail', identifier);
        toast({
          title: 'Success',
          description: 'Recovery code sent to your email.',
        });
        router.push('/verify-code');
      } else {
        setMessage(data.error || 'Failed to send code');
        toast({
          title: 'Error',
          description: data.error || 'Failed to send code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
      toast({
        title: 'Error',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Enter your email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
        <Button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Send Recovery Code
        </Button>
        {message && <p className="text-red-500">{message}</p>}
      </form>
    </div>
  );
}