'use client';

import { useState } from 'react';
import { updateSellerById, suspendSeller, deleteSeller } from '@/lib/actions/seller.actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import Seller from '@/lib/db/models/seller.model';

interface Seller {
  _id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  description?: string;
}

interface SellerEditFormProps {
  seller: Seller;
  locale: string;
}

export default function SellerEditForm({ seller, locale }: SellerEditFormProps) {
  const t = useTranslations('Admin.sellers');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const router = useRouter();

  const handleEdit = (field: string, value: string) => {
    setEditField(field);
    setEditValue(value);
  };

  const handleSave = async () => {
    const updateData: Partial<Seller> = { [editField!]: editValue };
    const result = await updateSellerById(seller.userId, updateData, { revalidate: true }, locale);

    if (result.success) {
      setSuccess(t('updateSuccess'));
      setEditField(null);
      setEditValue('');
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } else {
      setError(`${t('error')}: ${result.error}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason) {
      setError(t('suspendReasonRequired'));
      setTimeout(() => setError(null), 3000);
      return;
    }

    const result = await suspendSeller(seller._id, suspendReason, locale);

    if (result.success) {
      setSuccess(t('suspendSuccess'));
      setSuspendReason('');
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } else {
      setError(`${t('error')}: ${result.error}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (confirm(t('confirmDelete'))) {
      const result = await deleteSeller(seller.userId, locale);

      if (result.success) {
        setSuccess(t('deleteSuccess'));
        setTimeout(() => router.push(`/${locale}/admin/sellers`), 2000);
      } else {
        setError(`${t('error')}: ${result.error}`);
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  return (
    <div>
      {success && <p className="text-green-600 mb-4">{success}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="font-medium">{t('businessName')}:</label>
          <div className="flex items-center">
            {editField === 'businessName' ? (
              <Input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mr-2"
              />
            ) : (
              <span className="mr-2">{seller.businessName}</span>
            )}
            {editField === 'businessName' ? (
              <>
                <Button onClick={handleSave} size="sm" className="mr-2">
                  {t('save')}
                </Button>
                <Button onClick={() => setEditField(null)} variant="outline" size="sm">
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleEdit('businessName', seller.businessName)}
                variant="link"
                size="sm"
              >
                {t('edit')}
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="font-medium">{t('email')}:</label>
          <div className="flex items-center">
            {editField === 'email' ? (
              <Input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mr-2"
              />
            ) : (
              <span className="mr-2">{seller.email}</span>
            )}
            {editField === 'email' ? (
              <>
                <Button onClick={handleSave} size="sm" className="mr-2">
                  {t('save')}
                </Button>
                <Button onClick={() => setEditField(null)} variant="outline" size="sm">
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleEdit('email', seller.email)}
                variant="link"
                size="sm"
              >
                {t('edit')}
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="font-medium">{t('phone')}:</label>
          <div className="flex items-center">
            {editField === 'phone' ? (
              <Input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mr-2"
              />
            ) : (
              <span className="mr-2">{seller.phone}</span>
            )}
            {editField === 'phone' ? (
              <>
                <Button onClick={handleSave} size="sm" className="mr-2">
                  {t('save')}
                </Button>
                <Button onClick={() => setEditField(null)} variant="outline" size="sm">
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleEdit('phone', seller.phone)}
                variant="link"
                size="sm"
              >
                {t('edit')}
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="font-medium">{t('description')}:</label>
          <div className="flex items-center">
            {editField === 'description' ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mr-2 w-full"
              />
            ) : (
              <span className="mr-2">{seller.description || t('na')}</span>
            )}
            {editField === 'description' ? (
              <>
                <Button onClick={handleSave} size="sm" className="mr-2">
                  {t('save')}
                </Button>
                <Button onClick={() => setEditField(null)} variant="outline" size="sm">
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleEdit('description', seller.description || '')}
                variant="link"
                size="sm"
              >
                {t('edit')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-2xl font-semibold mb-4">{t('adminActions')}</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-medium">{t('suspendSeller')}:</label>
            <Input
              type="text"
              placeholder={t('suspendReasonPlaceholder')}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mr-2 w-full md:w-1/2"
            />
            <Button
              onClick={handleSuspend}
              className="bg-yellow-600 text-white mt-2"
            >
              {t('suspend')}
            </Button>
          </div>
          <div>
            <Button
              onClick={handleDelete}
              className="bg-red-600 text-white"
            >
              {t('deleteSeller')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}