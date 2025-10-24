'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import Link from 'next/link';

// تعريف نوع الرسالة لدعم القوالب والمنتجات
interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  template?: {
    id: string;
    templateId: string;
    name: string;
    theme: 'light' | 'dark';
    sections: Array<{
      id: string;
      type: string;
      content: Record<string, any>;
      position: number;
    }>;
    backgroundImage?: string;
  };
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
  };
}

interface TemplatePreviewProps {
  template: Message['template'];
}

interface ProductPreviewProps {
  product: Message['product'];
}

const TemplatePreview = ({ template }: TemplatePreviewProps) => (
  <div className="border p-4 rounded-lg bg-gray-50 dark:bg-gray-800 mt-2">
    <h4 className="font-bold text-lg">{template.name}</h4>
    <p className="text-sm">Template ID: {template.templateId}</p>
    <p className="text-sm">Theme: {template.theme}</p>
    {template.backgroundImage && (
      <img
        src={template.backgroundImage}
        alt={template.name}
        className="w-full h-32 object-cover rounded mt-2"
      />
    )}
    <div className="mt-2">
      <h5 className="font-semibold">Sections:</h5>
      {template.sections.map((section) => (
        <div key={section.id} className="ml-2 mt-1">
          <p className="text-sm">
            <strong>{section.type}</strong> (Position: {section.position})
          </p>
          {section.type === 'image' && section.content.url && (
            <img
              src={section.content.url}
              alt={section.content.alt || 'Section image'}
              className="w-24 h-24 object-cover rounded"
            />
          )}
          {section.type === 'text' && <p>{section.content.text}</p>}
          {section.type === 'button' && (
            <button className="bg-blue-500 text-white px-2 py-1 rounded">
              {section.content.label || 'Button'}
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);

const ProductPreview = ({ product }: ProductPreviewProps) => (
  <div className="border p-4 rounded-lg bg-gray-50 dark:bg-gray-800 mt-2">
    <h4 className="font-bold text-lg">{product.name}</h4>
    <p className="text-sm">Product ID: {product.id}</p>
    <p className="text-sm">Price: ${product.price}</p>
    <p className="text-sm">{product.description}</p>
    {product.images && product.images.length > 0 && (
      <div className="mt-2">
        <h5 className="font-semibold">Images:</h5>
        <div className="flex gap-2">
          {product.images.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`${product.name} image ${index + 1}`}
              className="w-24 h-24 object-cover rounded"
            />
          ))}
        </div>
      </div>
    )}
  </div>
);

export function Sellerchatbote({ currentSellerId }: { currentSellerId: string }) {
  const t = useTranslations('Sellerchatbote');
  const locale = useLocale();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState({ uses: 0, limit: 10, status: 'free', isSubscribed: false, enabled: true });

  const chatRef = useRef<HTMLDivElement>(null);

  // استرجاع حالة الشات بوت وإعداداته
  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const response = await fetch(`/api/seller/ai-status?sellerId=${currentSellerId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch AI status');
        }
        const data = await response.json();
        setAiStatus(data);
      } catch (error) {
        toast.error(t('fetchAIStatusError'));
        console.error('Error fetching AI status:', error);
      }
    };

    if (isChatOpen && currentSellerId) {
      fetchAIStatus();
    }
  }, [isChatOpen, currentSellerId, t]);

  // استرجاع سجل المحادثة
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await fetch(`/api/seller/chat-history?sellerId=${currentSellerId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }
        const data = await response.json();
        setMessages(data.messages || []);
      } catch (error) {
        toast.error(t('fetchHistoryError'));
        console.error('Error fetching chat history:', error);
      }
    };

    if (isChatOpen && currentSellerId) {
      fetchChatHistory();
    }
  }, [isChatOpen, currentSellerId, t]);

  const generateResponse = async (inputText: string): Promise<{ content: string; template?: any; product?: any }> => {
    try {
      // التحقق من تفعيل الشات بوت
      if (!aiStatus.enabled) {
        return {
          content: t('aiDisabled'),
        };
      }

      // التحقق من الحد المجاني
      if (aiStatus.status === 'free' && aiStatus.uses >= aiStatus.limit) {
        return {
          content: t('limitExceeded', { link: '/premium' }),
        };
      }

      const response = await fetch('/api/seller/chat-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputText,
          history: messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'model' : 'tool',
            content: msg.content,
            ...(msg.template && { functionCall: { name: 'createTemplate', args: msg.template } }),
            ...(msg.product && { functionCall: { name: 'createProduct', args: msg.product } }),
          })),
          currentSellerId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('apiError'));
      }

      const data = await response.json();

      // زيادة عداد الاستخدام
      if (aiStatus.status === 'free') {
        await fetch(`/api/seller/ai-uses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sellerId: currentSellerId }),
        });
        setAiStatus((prev) => ({ ...prev, uses: prev.uses + 1 }));
      }

      return {
        content: data.response,
        template: data.template,
        product: data.product,
      };
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return {
        content: t('apiError') + ': ' + (error instanceof Error ? error.message : String(error)),
      };
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
      const { content, template, product } = await generateResponse(userMsg.content);
      const assistantMsg: Message = {
        role: 'assistant',
        content,
        ...(template && { template }),
        ...(product && { product }),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // حفظ الرسائل في قاعدة البيانات
      await fetch('/api/seller/chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: currentSellerId,
          messages: [...messages, userMsg, assistantMsg],
        }),
      });
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
        disabled={!aiStatus.enabled}
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
                {!aiStatus.enabled && (
                  <div className="text-red-500 text-sm">{t('aiDisabled')}</div>
                )}
                {aiStatus.enabled && aiStatus.status === 'free' && aiStatus.uses >= aiStatus.limit && (
                  <div className="text-red-500 text-sm">
                    {t('limitExceeded', { link: '/premium' })}
                    <Link href="/premium" className="underline">
                      {t('subscribeNow')}
                    </Link>
                  </div>
                )}
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
                      {msg.template && <TemplatePreview template={msg.template} />}
                      {msg.product && <ProductPreview product={msg.product} />}
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
                    disabled={isLoading || !aiStatus.enabled || (aiStatus.status === 'free' && aiStatus.uses >= aiStatus.limit)}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !aiStatus.enabled || (aiStatus.status === 'free' && aiStatus.uses >= aiStatus.limit)}
                  >
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