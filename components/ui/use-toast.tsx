'use client';

import * as React from 'react';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast';
import { useToast as useToastHook } from '@/components/ui/toast';

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  );
}

export function useToast() {
  const { toast, ...rest } = useToastHook();

  return {
    toast: ({
      title,
      description,
      action,
      variant = 'default',
      ...props
    }: {
      title?: string;
      description?: string;
      action?: React.ReactNode;
      variant?: 'default' | 'destructive';
    }) => {
      return toast({
        title,
        description,
        action,
        variant,
        ...props,
      });
    },
    ...rest,
  };
}