// /components/MessagesManager.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import io from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';


interface Message {
  _id: string;
  senderName: string;
  senderEmail: string;
  message: string;
  status: 'pending' | 'replied' | 'closed';
  reply?: string;
  createdAt: string;
}

interface Props {
  storeId: string;
}

export default function MessagesManager({ storeId }: Props) {
  const t = useTranslations('MessagesManager');
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_BASE_URL || '', {
  path: '/api/socket',
});

    socketRef.current = socket;
    socket.emit('join', storeId);
    

    socket.on('new-message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('message-updated', (msg: Message) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    });

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/stores/${storeId}/messages`);
        const result = await response.json();
        if (result.success) {
          setMessages(result.data);
        } else {
          toast({ title: t('errors.fetchFailed'), description: result.error, variant: 'destructive' });
        }
      } catch (error) {
        toast({
          title: t('errors.fetchFailed'),
          description: error instanceof Error ? error.message : t('errors.fetchFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();

    return () => {
      socket.disconnect();
    };
  }, [storeId, toast, t]);

  const handleReply = async (messageId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/messages/${messageId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply }),
      });
      const result = await response.json();
      if (result.success) {
        const updatedMessage = { ...result.data, reply, status: 'replied' };
        setMessages(messages.map((msg) => (msg._id === messageId ? updatedMessage : msg)));
        socketRef.current?.emit('send-reply', { storeId, messageId, reply });
        setReply('');
        setSelectedMessageId(null);
        toast({ title: t('replySuccess'), description: t('replySent') });
      } else {
        toast({ title: t('errors.replyFailed'), description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: t('errors.replyFailed'),
        description: error instanceof Error ? error.message : t('errors.replyFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('manageMessages')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : messages.length === 0 ? (
          <p>{t('noMessages')}</p>
        ) : (
          messages.map((message) => (
            <div key={message._id} className="border p-4 rounded-md">
              <p>
                <strong>{t('from')}:</strong> {message.senderName} ({message.senderEmail})
              </p>
              <p>
                <strong>{t('message')}:</strong> {message.message}
              </p>
              <p>
                <strong>{t('status')}:</strong> {t(message.status)}
              </p>
              {message.reply && (
                <p>
                  <strong>{t('reply')}:</strong> {message.reply}
                </p>
              )}
              <p>
                <strong>{t('receivedAt')}:</strong> {new Date(message.createdAt).toLocaleString()}
              </p>
              {message.status !== 'replied' && (
                <div className="mt-2">
                  <Textarea
                    value={selectedMessageId === message._id ? reply : ''}
                    onChange={(e) => {
                      setSelectedMessageId(message._id);
                      setReply(e.target.value);
                    }}
                    placeholder={t('enterReply')}
                  />
                  <Button
                    onClick={() => handleReply(message._id)}
                    disabled={isLoading || !reply || selectedMessageId !== message._id}
                    className="mt-2"
                  >
                    {isLoading && selectedMessageId === message._id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t('sendReply')}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}