'use client';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

interface CreativeInputProps {
  index: number;
  removeCreative: (index: number) => void;
  control: any;
  t: any;
}

export function CreativeInput({ index, removeCreative, control, t }: CreativeInputProps) {
  return (
    <div className="flex space-x-2 mb-3 items-center">
      <FormField
        control={control}
        name={`creatives.${index}.type`}
        render={({ field }) => (
          <FormItem>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="image">{t('Image')}</SelectItem>
                <SelectItem value="video">{t('Video')}</SelectItem>
                <SelectItem value="text">{t('Text')}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`creatives.${index}.url`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder={t('Creative Url Placeholder')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button type="button" variant="destructive" onClick={() => removeCreative(index)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}