import { Notification, IProductInput as ApiProductInput } from '@/lib/api/types';

export interface IUserInput {
  email: string;
  name: string;
  role: 'user' | 'Admin' | 'SELLER';
  image?: string;
}

export interface ISettingInput {
  availablePaymentMethods: PaymentMethodField[];
  defaultPaymentMethod: string;
}

export interface PaymentMethodField {
  name: string;
  commission: number;
}

export interface IProductInput extends ApiProductInput {}

export { Notification };