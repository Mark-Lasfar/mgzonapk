'use client';

import React, { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useDrag } from '@use-gesture/react';
import { Resizable } from 're-resizable';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chatbote() {
  const t = useTranslations('Chatbote');
  const locale = useLocale();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const generateResponse = async (inputText: string): Promise<string> => {
    try {
      const response = await fetch('/api/chat-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputText,
          history: messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('apiError'));
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return t('apiError') + ': ' + (error instanceof Error ? error.message : String(error));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      toast.error(t('emptyMessage'));
      return;
    }

    const userMsg: Message = { role: 'user', content: newMessage };
    setMessages((prev) => [...prev, userMsg]);
    setNewMessage('');
    setIsLoading(true);

    try {
      const assistantContent = await generateResponse(userMsg.content);
      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('unknownError');
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const bind = useDrag(
    ({ offset: [x, y] }) => {
      const maxX = window.innerWidth - 400;
      const maxY = window.innerHeight - 500;
      setChatPosition({
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      });
    },
    { bounds: { left: 0, top: 0, right: window.innerWidth - 400, bottom: window.innerHeight - 500 } }
  );

  return (
    <div
      className="fixed bottom-4 right-4 z-20"
      style={{ transform: `translate(${chatPosition.x}px, ${chatPosition.y}px)` }}
      {...bind()}
    >
      <Button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 animate-pulse"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 9.143m-2 10l-2.286-6.857L11 9.143M12 3v18"
          />
        </svg>
      </Button>
      {isChatOpen && (
        <div ref={chatRef}>
          <Resizable
            defaultSize={{ width: 400, height: 500 }}
            minWidth={300}
            minHeight={300}
            maxWidth={600}
            maxHeight={800}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0 cursor-move">
                <CardTitle>{t('aiChat')}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto">
                <div className="h-full">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={cn('mb-2', msg.role === 'user' ? 'text-right' : 'text-left')}
                    >
                      <strong>{msg.role === 'user' ? t('you') : t('assistant')}:</strong>{' '}
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('typeMessage')}
                    disabled={isLoading}
                  />
                  <Button onClick={handleSendMessage} disabled={isLoading}>
                    {t('send')}
                  </Button>
                </div>
              </div>
            </Card>
          </Resizable>
        </div>
      )}
    </div>
  );
}