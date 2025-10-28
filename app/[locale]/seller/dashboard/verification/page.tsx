'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { uploadSellerDocument, getSellerByUserId } from '@/lib/actions/seller.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerificationPage() {
  const t = useTranslations('settings.verification');
  const { data: session, status } = useSession();
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');

  useEffect(() => {
    const fetchSeller = async () => {
      if (status !== 'authenticated' || !session?.user?.id) return;
      try {
        setLoading(true);
        const result = await getSellerByUserId(session.user.id);
        if (result.success) {
          setSeller(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(t('errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchSeller();
  }, [status, session, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadDocument = async () => {
    if (!file || !documentType || !session?.user?.id) {
      alert(t('errors.missingFields'));
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const result = await uploadSellerDocument(session.user.id, formData);
      if (result.success) {
        alert(t('documentUploaded'));
        setFile(null);
        setDocumentType('');
        const updatedSeller = await getSellerByUserId(session.user.id);
        if (updatedSeller.success) {
          setSeller(updatedSeller.data);
        }
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert(t('errors.uploadFailed'));
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <div className="p-6">{t('errors.unauthenticated')}</div>;
  }

  if (session?.user?.role !== 'SELLER') {
    return <div className="p-6">{t('errors.accessDenied')}</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => window.location.reload()}>{t('retry')}</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <Card>
        <CardHeader>
          <CardTitle>{t('verificationStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {t('status')}: <span className="font-semibold">{seller?.verification?.status || 'pending'}</span>
          </p>
          <p>
            {t('submittedAt')}:{' '}
            {seller?.verification?.submittedAt
              ? new Date(seller.verification.submittedAt).toLocaleDateString()
              : '-'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('uploadDocument')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="text"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              placeholder={t('documentTypePlaceholder')}
            />
            <Input type="file" accept=".pdf,.jpg,.png" onChange={handleFileChange} />
            <Button onClick={handleUploadDocument} disabled={!file || !documentType}>
              {t('upload')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('documents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documentType')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('uploadedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seller?.verification?.documents &&
                Array.from(seller.verification.documents.entries()).map(([type, doc]: [string, any]) => (
                  <TableRow key={type}>
                    <TableCell>{type}</TableCell>
                    <TableCell>{doc.status}</TableCell>
                    <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}