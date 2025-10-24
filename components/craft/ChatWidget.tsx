// /components/craft/ChatWidget.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import io from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// واجهة Message لتطابق نموذج قاعدة البيانات
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

export default function ChatWidget({ storeId }: Props) {
  const t = useTranslations('ChatWidget');
  const [socket, setSocket] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join', storeId);

    newSocket.on('new-message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    newSocket.on('message-updated', (msg: Message) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [storeId]);

  const sendMessage = () => {
    if (name && email && message) {
      socket.emit('send-message', { storeId, senderName: name, senderEmail: email, message });
      setMessage('');
    }
  };

  return (
    <div className="fixed bottom-4 right-4">
      <Button onClick={() => setIsOpen(!isOpen)}>{t('openChat')}</Button>
      {isOpen && (
        <Card className="w-80 mt-2">
          <CardContent className="p-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
              className="mb-2"
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email')}
              type="email"
              className="mb-2"
            />
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('message')}
              className="mb-2"
            />
            <Button onClick={sendMessage} disabled={!name || !email || !message}>
              {t('send')}
            </Button>
            <div className="mt-4 max-h-60 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg._id} className="mb-2">
                  <p>
                    <strong>{msg.senderName}:</strong> {msg.message}
                  </p>
                  {msg.reply && (
                    <p>
                      <strong>{t('reply')}:</strong> {msg.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}