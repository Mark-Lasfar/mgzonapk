'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface ProfilePictureData {
  image: string;
}

export default function ProfilePicture() {
  const t = useTranslations('AccountPortfolio');
  const [profilePicture, setProfilePicture] = useState<ProfilePictureData | null>(null);
  const [newImage, setNewImage] = useState<File | null>(null);

  const fetchProfilePicture = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/picture`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setProfilePicture(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchProfilePicture();
  }, []);

  const handleUpdatePicture = async () => {
    if (!newImage) return toast.error(t('noImageSelected'));

    const formData = new FormData();
    formData.append('image', newImage);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/picture`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('updateSuccess'));
        fetchProfilePicture();
        setNewImage(null);
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleDeletePicture = async () => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/picture`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('deleteSuccess'));
        setProfilePicture(null);
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
        <CardTitle>{t('profilePicture')}</CardTitle>
      </CardHeader>
      <CardContent>
        {profilePicture?.image && (
          <div className="mb-4">
            <img src={profilePicture.image} alt="Profile Picture" className="w-32 h-32 rounded-full" />
            <Button onClick={handleDeletePicture} variant="destructive" className="mt-2">
              {t('delete')}
            </Button>
          </div>
        )}
        <Input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setNewImage(e.target.files?.[0] || null)}
        />
        <Button onClick={handleUpdatePicture} disabled={!newImage}>
          {t('updatePicture')}
        </Button>
      </CardContent>
    </Card>
  );
}