'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface ContactInfo {
  _id: string;
  phone: string;
  socialLinks: { platform: string; url: string }[];
}

export default function ContactInfo() {
  const t = useTranslations('AccountPortfolio');
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [newContactInfo, setNewContactInfo] = useState({
    phone: '',
    socialLinks: [{ platform: '', url: '' }],
  });
  const [editing, setEditing] = useState(false);

  const fetchContactInfo = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/contact`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setContactInfo(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const handleAddOrUpdateContactInfo = async () => {
    const url = contactInfo
      ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/contact`
      : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/contact`;
    const method = contactInfo ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContactInfo),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(contactInfo ? t('updateSuccess') : t('addSuccess'));
        fetchContactInfo();
        setNewContactInfo({ phone: '', socialLinks: [{ platform: '', url: '' }] });
        setEditing(false);
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleEdit = () => {
    if (contactInfo) {
      setNewContactInfo({
        phone: contactInfo.phone,
        socialLinks: contactInfo.socialLinks,
      });
      setEditing(true);
    }
  };

  const handleAddLink = () => {
    setNewContactInfo({
      ...newContactInfo,
      socialLinks: [...newContactInfo.socialLinks, { platform: '', url: '' }],
    });
  };

  const handleRemoveLink = (index: number) => {
    setNewContactInfo({
      ...newContactInfo,
      socialLinks: newContactInfo.socialLinks.filter((_, i) => i !== index),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('contactInfo')}</CardTitle>
      </CardHeader>
      <CardContent>
        {contactInfo && !editing ? (
          <div className="mb-4">
            <p>{t('phone')}: {contactInfo.phone}</p>
            <h3>{t('socialLinks')}:</h3>
            {contactInfo.socialLinks.map((link, index) => (
              <p key={index}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.platform}
                </a>
              </p>
            ))}
            <Button onClick={handleEdit}>{t('edit')}</Button>
          </div>
        ) : (
          <div className="mb-4">
            <Input
              placeholder={t('phone')}
              value={newContactInfo.phone}
              onChange={(e) => setNewContactInfo({ ...newContactInfo, phone: e.target.value })}
            />
            {newContactInfo.socialLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={t('platform')}
                  value={link.platform}
                  onChange={(e) => {
                    const newLinks = [...newContactInfo.socialLinks];
                    newLinks[index].platform = e.target.value;
                    setNewContactInfo({ ...newContactInfo, socialLinks: newLinks });
                  }}
                />
                <Input
                  placeholder={t('url')}
                  value={link.url}
                  onChange={(e) => {
                    const newLinks = [...newContactInfo.socialLinks];
                    newLinks[index].url = e.target.value;
                    setNewContactInfo({ ...newContactInfo, socialLinks: newLinks });
                  }}
                />
                <Button onClick={() => handleRemoveLink(index)}>{t('removeLink')}</Button>
              </div>
            ))}
            <Button onClick={handleAddLink}>{t('addLink')}</Button>
            <Button onClick={handleAddOrUpdateContactInfo}>
              {contactInfo ? t('updateContactInfo') : t('addContactInfo')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}