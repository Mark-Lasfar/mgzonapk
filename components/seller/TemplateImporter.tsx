'use client';

import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { TemplateFormDataSchema, Template } from '@/lib/types/settings';
import { useSession } from 'next-auth/react';
import sanitizeHtml from 'sanitize-html';

interface Props {
  onImport: (template: Template) => void;
  storeId: string;
}

export default function TemplateImporter({ onImport, storeId }: Props) {
  const t = useTranslations('TemplateImporter');
  const { toast } = useToast();
  const { data: session } = useSession();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast({
          title: t('error'),
          description: t('noFilesSelected'),
          variant: 'destructive',
        });
        return;
      }

      const file = acceptedFiles[0];
      if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const template = JSON.parse(e.target?.result as string) as Template;
            TemplateFormDataSchema.parse(template);
            const sanitizedTemplate = {
              ...template,
              sections: template.sections?.map((section) => ({
                ...section,
                customHTML: sanitizeHtml(section.customHTML || ''),
                customCSS: section.customCSS || '',
              })),
            };
            onImport(sanitizedTemplate);
            toast({
              title: t('success'),
              description: t('templateImported'),
            });
          } catch (error) {
            toast({
              title: t('error'),
              description: t('invalidTemplate'),
              variant: 'destructive',
            });
          }
        };
        reader.readAsText(file);
      } else if (file.name.endsWith('.zip')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const zip = await JSZip.loadAsync(e.target?.result as ArrayBuffer);
            const templateFile = zip.file('template.json');
            if (!templateFile) {
              throw new Error(t('noTemplateJson'));
            }
            const templateContent = await templateFile.async('string');
            const template = JSON.parse(templateContent) as Template;
            TemplateFormDataSchema.parse(template);

            // Sanitize sections
            const sanitizedSections = template.sections?.map((section) => ({
              ...section,
              customHTML: sanitizeHtml(section.customHTML || ''),
            }));

            // Upload assets to Cloudinary
            const assets = await Promise.all(
              Object.keys(zip.files)
                .filter((name) => name.match(/\.(jpg|jpeg|png|css|js)$/))
                .map(async (name) => {
                  const fileContent = await zip.file(name)!.async('arraybuffer'); // Changed to arraybuffer
                  const blob = new Blob([fileContent], {
                    type: name.match(/\.(jpg|jpeg|png)$/) ? `image/${name.split('.').pop()}` : 'application/octet-stream',
                  });
                  const formData = new FormData();
                  formData.append('file', new File([blob], name));
                  formData.append(
                    'options',
                    JSON.stringify({
                      folder: `stores/${storeId}/assets`,
                      resource_type: name.match(/\.(jpg|jpeg|png)$/) ? 'image' : 'raw',
                      public_id: `asset-${name}`,
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
                    throw new Error(result.error || t('uploadFailed'));
                  }

                  return { name, url: result.data.secureUrl };
                })
            );

            onImport({ ...template, sections: sanitizedSections, assets });
            toast({
              title: t('success'),
              description: t('websiteImported'),
            });
          } catch (error) {
            toast({
              title: t('error'),
              description: error instanceof Error ? error.message : t('invalidZip'),
              variant: 'destructive',
            });
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast({
          title: t('error'),
          description: t('onlyJsonOrZipSupported'),
          variant: 'destructive',
        });
      }
    },
    [onImport, storeId, t, toast, session]
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/json': ['.json'], 'application/zip': ['.zip'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop,
  });

  return (
    <div className="border-2 border-dashed border-gray-300 p-4 rounded-md cursor-pointer hover:border-gray-400">
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        <p className="text-center text-gray-500">{t('dragDropTemplate')} {t('orClick')}</p>
      </div>
    </div>
  );
}