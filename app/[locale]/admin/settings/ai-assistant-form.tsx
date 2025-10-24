'use client';

import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ISettingInput } from '@/types';

interface AIAssistantFormProps {
  id: string;
}

export default function AIAssistantForm({ id }: AIAssistantFormProps) {
  const t = useTranslations('Admin.settings');
  const form = useFormContext<ISettingInput>();
  const { register, watch } = form;
  const enabled = watch('aiAssistant.enabled');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('aiAssistantSettings')}</h3>
      <div className="flex items-center space-x-2">
        <Switch
          id={`${id}.enabled`}
          {...register('aiAssistant.enabled')}
          checked={enabled}
        />
        <Label htmlFor={`${id}.enabled`}>{t('aiAssistantEnabled')}</Label>
      </div>
      <div>
        <Label htmlFor={`${id}.price`}>{t('aiAssistantPrice')}</Label>
        <Input
          id={`${id}.price`}
          type="number"
          step="0.01"
          {...register('aiAssistant.price', { valueAsNumber: true })}
          placeholder="7.00"
          disabled={!enabled}
        />
      </div>
      <div>
        <Label htmlFor={`${id}.description`}>{t('aiAssistantDescription')}</Label>
        <Textarea
          id={`${id}.description`}
          {...register('aiAssistant.description')}
          placeholder={t('aiAssistantDescriptionPlaceholder')}
          disabled={!enabled}
        />
      </div>
      <div>
        <Label htmlFor={`${id}.image`}>{t('aiAssistantImage')}</Label>
        <Input
          id={`${id}.image`}
          type="url"
          {...register('aiAssistant.image')}
          placeholder="https://mgzonai.vercel.app/static/images/mg.svg"
          disabled={!enabled}
        />
      </div>
      <div>
        <Label htmlFor={`${id}.freeLimit`}>{t('aiAssistantFreeLimit')}</Label>
        <Input
          id={`${id}.freeLimit`}
          type="number"
          {...register('aiAssistant.freeLimit', { valueAsNumber: true })}
          placeholder="10"
          disabled={!enabled}
        />
      </div>
    </div>
  );
}