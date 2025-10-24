// /home/mark/Music/my-nextjs-project-clean/components/seller/order-management/OrderManagement.tsx

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ORDERS, UPDATE_ORDER_STATUS } from '@/graphql/order/queries';
import { GetOrdersResponse, UpdateOrderStatusResponse, Order } from '@/lib/types';

export default function OrderManagement() {
  const t = useTranslations('Seller.OrderManagement');
  const { toast } = useToast();
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [latePayments, setLatePayments] = useState<Order[]>([]);

  const { data, loading, error } = useQuery<GetOrdersResponse>(GET_ORDERS, {
    variables: { sellerId: session?.user?.id },
    skip: !session?.user?.id,
  });

  const [updateOrderStatus] = useMutation<UpdateOrderStatusResponse>(UPDATE_ORDER_STATUS);

  useEffect(() => {
    if (data?.orders) {
      setOrders(data.orders);
    } else if (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('ordersFetchFailed'),
      });
    }
  }, [data, error, t]);

  // جلب المدفوعات المتأخرة
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchLatePayments = async () => {
      try {
        const response = await fetch('/api/orders/late-payments', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        if (result.success) {
          setLatePayments(result.data);
        } else {
          toast({
            variant: 'destructive',
            title: t('error'),
            description: t('latePaymentsFetchFailed'),
          });
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('latePaymentsFetchFailed'),
        });
      }
    };
    fetchLatePayments();
  }, [session?.user?.id, t]);

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { data } = await updateOrderStatus({
        variables: { orderId, status },
      });
      if (data?.updateOrderStatus) {
        setOrders(orders.map((order) =>
          order.id === orderId ? { ...order, status } : order
        ));
        toast({
          title: t('success'),
          description: t('orderStatusUpdated'),
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('orderStatusUpdateFailed'),
      });
    }
  };

  const handleTrackOrder = async (order: Order) => {
    if (!order.supplierId || !order.trackingNumber) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('missingTrackingInfo'),
      });
      return;
    }
    try {
      const response = await fetch('/api/order/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: order.supplierId, trackingNumber: order.trackingNumber }),
      });
      const result = await response.json();
      if (result.success) {
        setOrders(orders.map((o) =>
          o.id === order.id ? { ...o, trackingUrl: result.data.trackingUrl } : o
        ));
        toast({
          title: t('success'),
          description: t('trackingUpdated'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('trackingFailed'),
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('trackingFailed'),
      });
    }
  };

  const handleRemindCustomer = async (order: Order) => {
    try {
      await fetch('/api/notifications/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          userId: session?.user?.id,
          type: 'payment_reminder',
          title: 'Payment Reminder',
          message: `Please complete the payment for order ${order.id}. Amount: ${order.amount} ${order.currency}.`,
          channels: ['email', 'in_app'],
          priority: 'high',
        }),
      });
      toast({
        title: t('success'),
        description: t('paymentReminderSent'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('paymentReminderFailed'),
      });
    }
  };

  if (loading) return <div>{t('loading')}</div>;

  return (
    <Card>
      <CardHeader>
        <h2>{t('title')}</h2>
      </CardHeader>
      <CardContent>
        {/* قسم المدفوعات المتأخرة */}
        {latePayments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold">{t('latePayments')}</h3>
            <ul className="space-y-4">
              {latePayments.map((order) => (
                <li key={order.id} className="border p-4 rounded bg-red-50">
                  <p>{t('orderId')}: {order.id}</p>
                  <p>{t('productId')}: {order.productId}</p>
                  <p>{t('amount')}: {order.amount} {order.currency}</p>
                  <p>{t('createdAt')}: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <Button onClick={() => handleRemindCustomer(order)}>
                    {t('remindCustomer')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* قسم الطلبات */}
        {orders.length === 0 ? (
          <p>{t('noOrders')}</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="border p-4 rounded">
                <p>{t('orderId')}: {order.id}</p>
                <p>{t('productId')}: {order.productId}</p>
                <p>{t('status')}: {t(order.status)}</p>
                {order.supplierId && (
                  <p>{t('supplierId')}: {order.supplierId}</p>
                )}
                {order.trackingNumber && (
                  <p>{t('trackingNumber')}: {order.trackingNumber}</p>
                )}
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                    {t('trackOrder')}
                  </a>
                )}
                <div className="mt-2 space-x-2">
                  <Button onClick={() => handleUpdateStatus(order.id, 'pending_supply')}>
                    {t('setPendingSupply')}
                  </Button>
                  <Button onClick={() => handleUpdateStatus(order.id, 'processing')}>
                    {t('setProcessing')}
                  </Button>
                  <Button onClick={() => handleUpdateStatus(order.id, 'shipped')}>
                    {t('setShipped')}
                  </Button>
                  <Button onClick={() => handleTrackOrder(order)}>
                    {t('updateTracking')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}