// /home/mark/Music/my-nextjs-project-clean/lib/reducer.ts
import { State, Action, SellerConfigurations, Integration, Product, ProductInput, Section, ShippingProvider, PaymentMethod, Supplier } from './types';
import { defaultCategories, supportedCurrencies, layoutOptions, maxImages } from './config';

export const initialState: State = {
  formValues: {
    name: '',
    slug: '',
    description: '',
    price: 0,
    listPrice: 0,
    countInStock: 0,
    category: '',
    brand: '',
    featured: false,
    isPublished: false,
    pricing: {
      basePrice: 0,
      finalPrice: 0,
      currency: '',
      markup: 30,
      profit: 0,
      commission: 0,
      discount: { type: 'none' },
    },
    images: [],
    translations: [{ locale: '', name: '', description: '' }],
    sections: [],
    layout: 'default',
    tags: [],
    sellerId: '',
    availability: 'out_of_stock',
    metadata: {},
  },
  images: [],
  previewUrls: [],
  categories: defaultCategories,
  warehouses: [],
  relatedProducts: [],
  dropshippingProviders: [],
  paymentMethods: [],
  shippingProviders: [],
  suppliers: [],
  supportedCurrencies,
  layoutOptions,
  maxImages,
  sandboxMode: false,
  showVendor: true,
  isLoadingIntegrations: false,
  currency: 'USD',
  sections: [],
  configurations: {
    warehouses: [],
    paymentMethods: [],
    shippingProviders: [],
    dropshippingProviders: [],
    categories: defaultCategories,
    productStatuses: ['draft', 'pending', 'active', 'rejected'],
    dynamicSources: [],
    layouts: layoutOptions,
  },
  integrations: [],
};

export const formReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_FORM_VALUES':
      return {
        ...state,
        formValues: { ...state.formValues, ...(action.payload as ProductInput) },
      };
    case 'SET_IMAGES':
      return {
        ...state,
        images: action.payload as string[],
        previewUrls: action.payload as string[],
      };
    case 'SET_PREVIEW_URLS':
      return {
        ...state,
        previewUrls: action.payload as string[],
      };
    case 'CLEAR_PREVIEW_URLS':
      return {
        ...state,
        previewUrls: [],
      };
    case 'SET_CATEGORIES':
      return {
        ...state,
        categories: action.payload as string[],
      };
    case 'SET_WAREHOUSES':
      return {
        ...state,
        warehouses: action.payload as Integration[],
      };
    case 'SET_RELATED_PRODUCTS':
      return {
        ...state,
        relatedProducts: (action.payload as Product[]).map(product => ({
          _id: product._id.toString(),
          name: product.name,
        })),
      };
    case 'SET_DROPSHIPPING_PROVIDERS':
      return {
        ...state,
        dropshippingProviders: action.payload as Integration[],
      };
    case 'SET_PAYMENT_METHODS':
      return {
        ...state,
        paymentMethods: action.payload as PaymentMethod[],
      };
    case 'SET_SHIPPING_PROVIDERS':
      return {
        ...state,
        shippingProviders: action.payload as ShippingProvider[],
      };
    case 'SET_SANDBOX_MODE':
      return {
        ...state,
        sandboxMode: action.payload as boolean,
      };
    case 'SET_SHOW_VENDOR':
      return {
        ...state,
        showVendor: action.payload as boolean,
      };
    case 'SET_CONFIGURATIONS':
      return {
        ...state,
        configurations: action.payload as SellerConfigurations,
        warehouses: (action.payload as SellerConfigurations).warehouses || [],
        paymentMethods: (action.payload as SellerConfigurations).paymentMethods || [],
        shippingProviders: (action.payload as SellerConfigurations).shippingProviders || [],
        dropshippingProviders: (action.payload as SellerConfigurations).dropshippingProviders || [],
      };
    case 'SET_INTEGRATIONS':
      return {
        ...state,
        integrations: action.payload as Integration[],
        warehouses: (action.payload as Integration[])
          .filter(integration => integration.provider.includes('warehouse'))
          .map(integration => ({
            ...integration,
            location: integration.location ?? '',
          })),
        dropshippingProviders: (action.payload as Integration[])
          .filter(integration => integration.provider.includes('dropshipping')),
        isLoadingIntegrations: false,
      };
    case 'SET_SECTIONS':
      return {
        ...state,
        sections: action.payload as Section[],
      };
    case 'SET_CURRENCY':
      return {
        ...state,
        currency: action.payload as string,
      };
    case 'SET_SUPPLIERS':
      return {
        ...state,
        suppliers: action.payload as Supplier[],
      };
    default:
      return state;
  }
};