'use client';

import { useTranslations } from 'next-intl';
import { useMutation } from '@apollo/client/react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';
import { UPDATE_PRODUCT, DELETE_IMAGE } from '@/graphql/product/mutations';
import { useSession } from 'next-auth/react';
import { State, Action } from '@/lib/types';

interface ImagesSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  productId?: string; // إضافة productId لو كنت بتحدث منتج موجود
}

export default function ImagesSection({ state, dispatch, productId }: ImagesSectionProps) {
  const t = useTranslations('Seller.ProductForm');
  const { toast } = useToast();
  const { data: session } = useSession();
  const [updateProduct, { loading: updateLoading }] = useMutation(UPDATE_PRODUCT);
  const [deleteImage, { loading: deleteLoading }] = useMutation(DELETE_IMAGE);

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) {
      toast({ variant: 'destructive', title: t('error'), description: t('noFilesSelected') });
      return;
    }

    if (state.images.length + files.length > state.maxImages) {
      toast({ variant: 'destructive', title: t('tooManyImages'), description: t('maxImages', { max: state.maxImages }) });
      return;
    }

    dispatch({ type: 'SET_PREVIEW_URLS', payload: Array.from(files).map((file) => URL.createObjectURL(file)) });

    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append(
            'options',
            JSON.stringify({
              folder: 'products',
              resource_type: 'image',
              public_id: `product-${Date.now()}`,
            })
          );

          const response = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.user?.token}`,
              'x-locale': t('locale'),
            },
            body: formData,
          });

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || t('imageUploadFailed'));
          }

          return result.data.secureUrl;
        })
      );

      const newImages = [...state.images, ...uploadedUrls];
      dispatch({ type: 'SET_IMAGES', payload: newImages });

      // تحديث المنتج في قاعدة البيانات لو فيه productId
      if (productId) {
        await updateProduct({
          variables: {
            id: productId,
            input: {
              ...state.formValues,
              images: newImages,
            },
          },
        });
      }

      toast({ description: t('imagesUploaded', { count: uploadedUrls.length }) });
    } catch (error) {
      toast({ variant: 'destructive', title: t('error'), description: t('imageUploadFailed') });
    } finally {
      dispatch({ type: 'CLEAR_PREVIEW_URLS' });
    }
  };

  const handleImageDelete = async (image: string, index: number) => {
    if (!confirm(t('confirmDeleteImage'))) return;

    try {
      const publicId = image.split('/').slice(-2).join('/').split('.')[0];
      await deleteImage({ variables: { publicId } });

      const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.user?.token}`,
          'x-locale': t('locale'),
        },
        body: JSON.stringify({ publicId }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || t('imageDeleteFailed'));
      }

      const newImages = state.images.filter((_: string, i: number) => i !== index);
      dispatch({ type: 'SET_IMAGES', payload: newImages });

      // تحديث المنتج في قاعدة البيانات لو فيه productId
      if (productId) {
        await updateProduct({
          variables: {
            id: productId,
            input: {
              ...state.formValues,
              images: newImages,
            },
          },
        });
      }

      toast({ description: t('imageDeleted') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('error'), description: t('imageDeleteFailed') });
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2>{t('productImages')}</h2>
      </CardHeader>
      <CardContent>
        {(updateLoading || deleteLoading) && <div className="text-center mb-4">{t('uploading')}</div>}
        <div className="flex flex-wrap gap-4">
          {state.images.map((image: string, index: number) => (
            <Card key={index} className="relative w-[150px] h-[150px]">
              <CardContent className="p-0">
                <Image
                  src={image}
                  alt={`${t('productImage')} ${index + 1}`}
                  width={150}
                  height={150}
                  className="object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => handleImageDelete(image, index)}
                  disabled={updateLoading || deleteLoading}
                  aria-label={t('deleteImage')}
                >
                  ×
                </Button>
              </CardContent>
            </Card>
          ))}
          {state.previewUrls.map((url: string, index: number) => (
            <Card key={`preview-${index}`} className="relative w-[150px] h-[150px] opacity-50">
              <CardContent className="p-0">
                <Image
                  src={url}
                  alt={`${t('previewImage')} ${index + 1}`}
                  width={150}
                  height={150}
                  className="object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          ))}
          {state.images.length + state.previewUrls.length < state.maxImages && (
            <Card className="w-[150px] h-[150px] flex items-center justify-center">
              <CardContent className="p-0">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  onChange={(e) => e.target.files && handleImageUpload(Array.from(e.target.files))}
                  disabled={updateLoading || deleteLoading}
                  aria-label={t('uploadImages')}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{t('imageRequirements')}</p>
      </CardContent>
    </Card>
  );
}