'use client';

import * as React from 'react';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

type ToastVariant = 'default' | 'destructive';

interface ToastData {
  id: number;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: ToastVariant;
}

const ToastContext = React.createContext<{
  toast: (data: Omit<ToastData, 'id'>) => void;
} | null>(null);

let toastId = 0;

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const showToast = (data: Omit<ToastData, 'id'>) => {
    toastId += 1;
    const id = toastId;
    setToasts((prev) => [...prev, { ...data, id }]);

    // auto-dismiss after 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      <ToastProvider>
        {toasts.map((toast) => (
          <Toast key={toast.id} variant={toast.variant}>
            <div className="grid gap-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
            {toast.action}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within <Toaster />');
  }

  return context;
}
