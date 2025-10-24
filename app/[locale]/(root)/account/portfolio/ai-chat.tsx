'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface Message {
 role: 'user' | 'assistant';
 content: string;
}

export default function AIChat() {
 const t = useTranslations('AccountPortfolio');
 const [messages, setMessages] = useState<Message[]>([]);
 const [newMessage, setNewMessage] = useState('');

 const handleSendMessage = async () => {
 if (!newMessage.trim()) {
 toast.error(t('emptyMessage'));
 return;
 }

 const userMessage: Message = { role: 'user', content: newMessage };
 setMessages([...messages, userMessage]);
 setNewMessage('');

 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/converse`, {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${localStorage.getItem('userToken')}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ messages: [...messages, userMessage] }),
 });
 const data = await response.json();
 if (data.response) {
 setMessages([...messages, userMessage, { role: 'assistant', content: data.response }]);
 } else {
 toast.error(data.error || t('operationFailed'));
 }
 } catch (error) {
 toast.error(t('operationFailed'));
 }
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle>{t('aiChat')}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="mb-4 h-64 overflow-y-auto border p-4 rounded">
 {messages.map((msg, index) => (
 <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
 <strong>{msg.role === 'user' ? t('you') : t('assistant')}:</strong> {msg.content}
 </div>
 ))}
 </div>
 <div className="flex gap-2">
 <Input
 value={newMessage}
 onChange={(e) => setNewMessage(e.target.value)}
 placeholder={t('typeMessage')}
 />
 <Button onClick={handleSendMessage}>{t('send')}</Button>
 </div>
 </CardContent>
 </Card>
 );
}