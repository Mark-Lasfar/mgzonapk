'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface Notification {
 _id: string;
 message: string;
 read: boolean;
 timestamp: string;
}

export default function NotificationList() {
 const t = useTranslations('AccountPortfolio');
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [subscriptionStatus, setSubscriptionStatus] = useState('unsubscribed');

 const fetchNotifications = async () => {
 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/notifications`, {
 headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` },
 });
 const data = await response.json();
 if (data.success) setNotifications(data.data);
 else toast.error(t('fetchError'));
 } catch (error) {
 toast.error(t('fetchError'));
 }
 };

 const checkSubscription = async () => {
 if ('serviceWorker' in navigator && 'PushManager' in window) {
 const registration = await navigator.serviceWorker.ready;
 const subscription = await registration.pushManager.getSubscription();
 setSubscriptionStatus(subscription ? 'subscribed' : 'unsubscribed');
 }
 };

 useEffect(() => {
 fetchNotifications();
 checkSubscription();
 }, []);

 const handleSubscribe = async () => {
 try {
 const registration = await navigator.serviceWorker.ready;
 const subscription = await registration.pushManager.subscribe({
 userVisibleOnly: true,
 applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 });
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/subscribe`, {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${localStorage.getItem('userToken')}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(subscription),
 });
 const data = await response.json();
 if (data.message) {
 toast.success(t('subscriptionSuccess'));
 setSubscriptionStatus('subscribed');
 } else {
 toast.error(data.error || t('operationFailed'));
 }
 } catch (error) {
 toast.error(t('operationFailed'));
 }
 };

 const handleMarkAsRead = async (id: string) => {
 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/notifications/${id}/read`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` },
 });
 const data = await response.json();
 if (data.success) {
 toast.success(t('markReadSuccess'));
 fetchNotifications();
 } else {
 toast.error(data.error || t('operationFailed'));
 }
 } catch (error) {
 toast.error(t('operationFailed'));
 }
 };

 const handleDelete = async (id: string) => {
 if (!confirm(t('confirmDelete'))) return;
 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/notifications/${id}`, {
 method: 'DELETE',
 headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` },
 });
 const data = await response.json();
 if (data.success) {
 toast.success(t('deleteSuccess'));
 fetchNotifications();
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
 <CardTitle>{t('notifications')}</CardTitle>
 </CardHeader>
 <CardContent>
 {subscriptionStatus === 'unsubscribed' && (
 <Button onClick={handleSubscribe} className="mb-4">
 {t('subscribeToNotifications')}
 </Button>
 )}
 <div className="grid gap-4">
 {notifications.map((notification) => (
 <Card key={notification._id}>
 <CardContent>
 <p className={notification.read ? 'text-gray-500' : 'font-bold'}>
 {notification.message}
 </p>
 <p>{t('date')}: {new Date(notification.timestamp).toLocaleString()}</p>
 {!notification.read && (
 <Button onClick={() => handleMarkAsRead(notification._id)}>{t('markRead')}</Button>
 )}
 <Button onClick={() => handleDelete(notification._id)} variant="destructive">
 {t('delete')}
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}