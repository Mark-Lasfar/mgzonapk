'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@apollo/client/react';
import { UPDATE_SELLER, SUSPEND_SELLER, DELETE_SELLER, UNSUSPEND_SELLER } from '@/graphql/admin/seller/mutations';
import { GET_SELLER } from '@/graphql/admin/seller/queries';

interface SellerEditFormProps {
  seller: any;
}

export default function SellerEditForm({ seller }: SellerEditFormProps) {
  const t = useTranslations('Admin.sellers');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [suspendReason, setSuspendReason] = useState<string>('');

  const [updateSeller] = useMutation(UPDATE_SELLER, {
    onCompleted: (data) => {
      if (data.updateSeller.success) {
        toast({ description: t('updateSuccess') });
        setEditField(null);
        setEditValue('');
        queryClient.refetchQueries({ include: [GET_SELLER] });
      } else {
        toast({ variant: 'destructive', description: data.updateSeller.message });
      }
    },
    onError: (error) => {
      toast({ variant: 'destructive', description: error.message });
    }
  });

  const [suspendSeller] = useMutation(SUSPEND_SELLER, {
    onCompleted: (data) => {
      if (data.suspendSeller.success) {
        toast({ description: t('suspendSuccess') });
        setSuspendReason('');
        queryClient.refetchQueries({ include: [GET_SELLER] });
      } else {
        toast({ variant: 'destructive', description: data.suspendSeller.message });
      }
    }
  });

  const [deleteSeller] = useMutation(DELETE_SELLER, {
    onCompleted: (data) => {
      if (data.deleteSeller.success) {
        toast({ description: t('deleteSuccess') });
      } else {
        toast({ variant: 'destructive', description: data.deleteSeller.message });
      }
    }
  });

  const [unsuspendSeller] = useMutation(UNSUSPEND_SELLER, {
    onCompleted: (data) => {
      if (data.unsuspendSeller.success) {
        toast({ description: 'Seller unsuspended successfully' });
        queryClient.refetchQueries({ include: [GET_SELLER] });
      } else {
        toast({ variant: 'destructive', description: data.unsuspendSeller.message });
      }
    }
  });

  const handleEdit = (field: string, value: string) => {
    setEditField(field);
    setEditValue(value);
  };

  const handleSave = () => {
    if (!editField || !editValue) return;
    
    updateSeller({
      variables: {
        sellerId: seller._id,
        input: { [editField]: editValue }
      }
    });
  };

  const handleSuspend = () => {
    if (!suspendReason) {
      toast({ variant: 'destructive', description: t('suspendReasonRequired') });
      return;
    }

    suspendSeller({
      variables: {
        input: {
          sellerId: seller._id,
          reason: suspendReason
        }
      }
    });
  };

  const handleDelete = () => {
    if (confirm(t('confirmDelete'))) {
      deleteSeller({
        variables: {
          input: { sellerId: seller._id }
        }
      });
    }
  };

  const handleUnsuspend = () => {
    unsuspendSeller({ variables: { sellerId: seller._id } });
  };

  const renderField = (field: string, label: string, value: string, type: 'text' | 'email' | 'textarea' = 'text') => (
    <div className="space-y-2">
      <label className="font-medium">{label}:</label>
      <div className="flex items-center gap-2">
        {editField === field ? (
          <>
            {type === 'textarea' ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
              />
            ) : (
              <Input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
              />
            )}
            <Button onClick={handleSave} size="sm">{t('save')}</Button>
            <Button onClick={() => setEditField(null)} variant="outline" size="sm">{t('cancel')}</Button>
          </>
        ) : (
          <>
            <span className="px-2 py-1 bg-gray-100 rounded">{value || t('na')}</span>
            <Button
              onClick={() => handleEdit(field, value)}
              variant="outline"
              size="sm"
            >
              {t('edit')}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('editSeller')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderField('businessName', t('businessName'), seller.businessName)}
          {renderField('email', t('email'), seller.email, 'email')}
          {renderField('phone', t('phone'), seller.phone)}
          {renderField('description', t('description'), seller.description || '', 'textarea')}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">{t('adminActions')}</h3>
          
          {seller.suspended ? (
            <div>
              <p className="text-yellow-600">{t('suspendedReason')}: {seller.suspendReason}</p>
              <Button onClick={handleUnsuspend} variant="outline">
                {t('unsuspend')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder={t('suspendReasonPlaceholder')}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
              <Button onClick={handleSuspend} className="bg-yellow-600">
                {t('suspend')}
              </Button>
            </div>
          )}

          <Button onClick={handleDelete} variant="destructive">
            {t('deleteSeller')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}