'use client';

import { useEffect, useState, useCallback, JSX, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { PlusCircle, Trash2, GripVertical } from 'lucide-react';
import Image from 'next/image';
// import crypto from '@/lib/utils/encryption';
import crypto from 'crypto';


// Constants
const ItemType = 'CONTENT_ITEM';

// Interfaces
interface ContentItem {
  id: string;
  type: 'image' | 'video' | 'article' | 'button' | 'divider';
  data: any;
}

interface Integration {
  id: string;
  providerName: string;
  credentials: Record<string, string>;
  type: 'payment' | 'warehouse' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'analytics' | 'automation' | 'communication' | 'education' | 'security' | 'advertising' | 'tax' | 'other';
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  sandbox: boolean;
  webhook?: {
    enabled: boolean;
    url: string;
    secret: string;
    events: WebhookEvent[];
  };
  apiEndpoints?: Record<string, string>;
  settings?: {
    supportedCurrencies?: string[];
    supportedCountries?: string[];
    amountMultiplier?: number;
    apiUrl?: string;
    authType?: 'Bearer' | 'Basic' | 'APIKey' | 'OAuth';
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    responseMapping?: Record<string, string>;
    retryOptions?: {
      maxRetries?: number;
      initialDelay?: number;
    };
  };
  oauth?: {
    enabled: boolean;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
  };
  pricing?: {
    isFree: boolean;
    commissionRate?: number;
    requiredPlanIds?: string[];
  };
  videos?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  images?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  articles?: Array<{
    id: string;
    title: string;
    content: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
  }>;
  buttons?: Array<{
    id: string;
    label: string;
    link: string;
    type: 'primary' | 'secondary' | 'link';
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
  }>;
  dividers?: Array<{
    id: string;
    style: string;
  }>;
  autoRegister?: {
    enabled: boolean;
    fields?: { key: string; label: string; type: 'text' | 'email' | 'password' | 'number'; required: boolean }[];
  };
  history?: Array<{
    event: string;
    date: string;
    userId?: string;
  }>;
}

// Webhook Event Type
type WebhookEvent =
  | 'order created'
  | 'order updated'
  | 'order fulfilled'
  | 'order cancelled'
  | 'order payment completed'
  | 'order shipment updated'
  | 'payment succeeded'
  | 'shipment updated'
  | 'tax transaction created'
  | 'tax report created'
  | 'product created'
  | 'product updated'
  | 'product deleted'
  | 'product imported'
  | 'product synced'
  | 'inventory updated'
  | 'customer created'
  | 'customer updated'
  | 'withdrawal created'
  | 'withdrawal updated'
  | 'seller registered'
  | 'seller updated'
  | 'campaign updated'
  | 'ad performance updated'
  | 'transaction recorded'
  | 'analytics updated'
  | 'automation triggered'
  | 'message sent'
  | 'course updated'
  | 'security alert'
  | string; // Allow custom events for 'other' type

// Zod Schema
const cssValue = z.string().regex(/^\d+(px|rem|em|%)$/, 'Invalid CSS value').optional();
const colorValue = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color value').optional();

const integrationSchema = z.object({
  selectedIntegrationId: z.string().optional(),
  providerName: z.string().min(2, 'admin integrations add.validation provider name min').regex(/^[\w\s-]+$/, 'admin integrations add.validation provider name format'),
  type: z.enum([
    'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing', 'accounting',
    'crm', 'analytics', 'automation', 'communication', 'education', 'security', 'advertising', 'tax', 'other',
  ]),
  description: z.string().max(500, 'admin integrations add.validation description max').optional(),
  logoUrl: z.string().url('admin integrations add.validation logo format').optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  sandbox: z.boolean().default(false),
  credentials: z.record(z.string().min(1, 'admin integrations add.credential value'), z.string()).optional(),

  oauth: z.object({
    enabled: z.boolean().default(false),
    authorizationUrl: z.string().url('admin integrations add.validation authorization url').optional().or(z.literal('')),
    tokenUrl: z.string().url('admin integrations add.validation token url').optional().or(z.literal('')),
    scopes: z.array(z.string()).optional(),
  }).optional(),
  webhook: z.object({
    enabled: z.boolean().default(false),
    url: z.string().url('admin integrations add.validation webhook url').optional().or(z.literal('')),
    secret: z.string().optional(),
    events: z.array(z.string()).default([]), // Allow any string for custom events
  }).optional(),
  apiEndpoints: z.record(z.string().url('admin integrations add.validation endpoint value'), z.union([z.string(), z.literal('')])).optional(),

  settings: z.object({
    supportedCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/, 'admin integrations add.validation supported currencies')).optional(),
    supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/, 'admin integrations add.validation supported countries')).optional(),
    amountMultiplier: z.number().min(0).default(1),
    apiUrl: z.string().url('admin integrations add.validation api url').optional().or(z.literal('')),
    authType: z.enum(['Bearer', 'Basic', 'APIKey', 'OAuth']).optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    redirectUri: z.string().url('admin integrations add.validation redirect uri').optional().or(z.literal('')),
    responseMapping: z.record(z.string(), z.string()).optional(),

    retryOptions: z.object({
      maxRetries: z.number().min(0).default(3).optional(),
      initialDelay: z.number().min(0).default(1000).optional(),
    }).optional(),
  }).optional(),
  pricing: z.object({
    isFree: z.boolean().default(true),
    commissionRate: z.number().min(0).max(1).optional(),
    requiredPlanIds: z.array(z.string()).optional(),
  }).optional(),
  videos: z.array(
    z.object({
      id: z.string().default(() => crypto.randomUUID()),
      url: z.string().url('admin integrations add.validation video url'),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),
      fontSize: cssValue,
      fontFamily: z.string().optional(),
      margin: cssValue,
      padding: cssValue,
      customPosition: z
        .object({
          position: z.enum(['absolute', 'relative', 'fixed']).optional(),
          top: cssValue,
          left: cssValue,
        })
        .optional(),
    })
  ).optional(),
  images: z.array(
    z.object({
      id: z.string().default(() => crypto.randomUUID()),
      url: z.string().url('admin integrations add.validation image url'),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),
      fontSize: cssValue,
      fontFamily: z.string().optional(),
      margin: cssValue,
      padding: cssValue,
      customPosition: z
        .object({
          position: z.enum(['absolute', 'relative', 'fixed']).optional(),
          top: cssValue,
          left: cssValue,
        })
        .optional(),
    })
  ).optional(),
  articles: z.array(
    z.object({
      id: z.string().default(() => crypto.randomUUID()),
      title: z.string().min(2, 'admin integrations add.validation article title'),
      content: z.string().min(10, 'admin integrations add.validation article content'),
      backgroundColor: colorValue,
      textColor: colorValue,
      fontSize: cssValue,
      fontFamily: z.string().optional(),
    })
  ).optional(),
  buttons: z.array(
    z.object({
      id: z.string().default(() => crypto.randomUUID()),
      label: z.string().min(2, 'admin integrations add.validation button label'),
      link: z.string().url('admin integrations add.validation button link'),
      type: z.enum(['primary', 'secondary', 'link']).default('primary'),
      backgroundColor: colorValue,
      textColor: colorValue,
      borderRadius: cssValue,
      padding: cssValue,
    })
  ).optional(),
  dividers: z.array(
    z.object({
      id: z.string().default(() => crypto.randomUUID()),
      style: z.string().default('solid 1px gray'),
    })
  ).optional(),
  autoRegister: z.object({
    enabled: z.boolean().default(false),
    fields: z.array(
      z.object({
        key: z.string().min(1, 'admin integrations add.validation field key'),
        label: z.string().min(1, 'admin integrations add.validation field label'),
        type: z.enum(['text', 'email', 'password', 'number']).default('text'),
        required: z.boolean().default(true),
      })
    ).optional(),
  }).optional(),
  history: z.array(
    z.object({
      event: z.string(),
      date: z.string().datetime(),
      userId: z.string().optional(),
    })
  ).optional(),
});

type IntegrationForm = z.infer<typeof integrationSchema>;

// Draggable Item Component
interface DraggableItemProps {
  item: ContentItem;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  removeItem: (index: number) => void;
  renderItem: (item: ContentItem) => JSX.Element;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, index, moveItem, removeItem, renderItem }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  drag(drop(ref));

  const t = useTranslations('admin integrations add');

  return (
    <div
      ref={ref}
      className={`flex items-center space-x-2 p-2 bg-gray-50 rounded ${isDragging ? 'opacity-50' : ''}`}
      role="button"
      aria-label={t('drag item', { type: item.type, index: index + 1 })}
    >
      <GripVertical className="h-5 w-5 cursor-move" aria-hidden="true" />
      <div className="flex-1">{renderItem(item)}</div>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => removeItem(index)}
        aria-label={t('remove item', { type: item.type })}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Main Component
export default function AddIntegrationPage() {
  const t = useTranslations('admin integrations add');
  const { toast } = useToast();
  const router = useRouter();
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<{ id: string; name: string }[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic-info');

  const form = useForm<IntegrationForm>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      selectedIntegrationId: '',
      providerName: '',
      type: 'payment',
      description: '',
      logoUrl: '',
      isActive: true,
      sandbox: false,
      credentials: {},
      oauth: { enabled: false, authorizationUrl: '', tokenUrl: '', scopes: [] },
      webhook: { enabled: false, url: '', secret: '', events: [] },
      apiEndpoints: {},
      settings: {
        supportedCurrencies: [],
        supportedCountries: [],
        amountMultiplier: 1,
        apiUrl: '',
        authType: 'APIKey',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        responseMapping: {},
        retryOptions: { maxRetries: 3, initialDelay: 1000 },
      },
      pricing: { isFree: true, commissionRate: 0, requiredPlanIds: [] },
      videos: [],
      images: [],
      articles: [],
      buttons: [],
      dividers: [],
      autoRegister: { enabled: false, fields: [] },
      history: [],
    },
  });

  const {
    fields: videoFields,
    append: appendVideo,
    remove: removeVideo,
  } = useFieldArray({
    control: form.control,
    name: 'videos',
  });

  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({
    control: form.control,
    name: 'images',
  });

  const {
    fields: articleFields,
    append: appendArticle,
    remove: removeArticle,
  } = useFieldArray({
    control: form.control,
    name: 'articles',
  });

  const {
    fields: buttonFields,
    append: appendButton,
    remove: removeButton,
  } = useFieldArray({
    control: form.control,
    name: 'buttons',
  });

  const {
    fields: dividerFields,
    append: appendDivider,
    remove: removeDivider,
  } = useFieldArray({
    control: form.control,
    name: 'dividers',
  });

  const {
    fields: autoRegisterFields,
    append: appendAutoRegisterField,
    remove: removeAutoRegisterField,
  } = useFieldArray({
    control: form.control,
    name: 'autoRegister.fields',
  });

  // Sync tabs with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = [
        'basic-info',
        'credentials',
        'webhook',
        'api-endpoints',
        'settings',
        'pricing',
        'content',
        'auto-register',
      ];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab('basic-info');
        window.history.replaceState(null, '', '#basic-info');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch subscription plans and integrations
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [plansResponse, integrationsResponse] = await Promise.all([
          fetch('/api/admin/subscription-plans'),
          fetch('/api/admin/integrations'),
        ]);

        if (!plansResponse.ok) throw new Error(t('error.message'));
        const plansData = await plansResponse.json();
        if (plansData.success) {
          setSubscriptionPlans(plansData.data.map((plan: any) => ({ id: plan.id, name: plan.name })));
        } else {
          throw new Error(plansData.message || t('error.message'));
        }

        if (!integrationsResponse.ok) throw new Error(t('error.message'));
        const integrationsData = await integrationsResponse.json();
        if (integrationsData.success) {
          setIntegrations(integrationsData.data);
        } else {
          throw new Error(integrationsData.message || t('error.message'));
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error.title'),
          description: error instanceof Error ? error.message : t('error.message'),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [t, toast]);

  // Update form when an integration is selected
  useEffect(() => {
    const selectedIntegrationId = form.watch('selectedIntegrationId');
    if (selectedIntegrationId) {
      const selectedIntegration = integrations.find((int) => int.id === selectedIntegrationId);
      if (selectedIntegration) {
        form.reset({
          selectedIntegrationId,
          providerName: selectedIntegration.providerName,
          type: selectedIntegration.type,
          description: selectedIntegration.description || '',
          logoUrl: selectedIntegration.logoUrl || '',
          isActive: selectedIntegration.isActive,
          sandbox: selectedIntegration.sandbox,
          credentials: selectedIntegration.credentials || {},
          oauth: selectedIntegration.oauth || { enabled: false, authorizationUrl: '', tokenUrl: '', scopes: [] },
          webhook: selectedIntegration.webhook || { enabled: false, url: '', secret: '', events: [] },
          apiEndpoints: selectedIntegration.apiEndpoints || {},
          settings: selectedIntegration.settings || {
            supportedCurrencies: [],
            supportedCountries: [],
            amountMultiplier: 1,
            apiUrl: '',
            authType: 'APIKey',
            clientId: '',
            clientSecret: '',
            redirectUri: '',
            responseMapping: {},
            retryOptions: { maxRetries: 3, initialDelay: 1000 },
          },
          pricing: selectedIntegration.pricing || { isFree: true, commissionRate: 0, requiredPlanIds: [] },
          videos: selectedIntegration.videos || [],
          images: selectedIntegration.images || [],
          articles: selectedIntegration.articles || [],
          buttons: selectedIntegration.buttons || [],
          dividers: selectedIntegration.dividers || [],
          autoRegister: selectedIntegration.autoRegister || { enabled: false, fields: [] },
          history: selectedIntegration.history || [],
        });
      }
    }
  }, [form, integrations]);

  // Auto-generate webhook URL and redirectUri
  useEffect(() => {
    const providerName = form.watch('providerName');
    const sandbox = form.watch('sandbox');
    const selectedIntegrationId = form.watch('selectedIntegrationId');
    if (providerName) {
      const slug = providerName
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]/g, '');
      form.setValue(
        'webhook.url',
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/integrations?provider=${slug}&sandbox=${sandbox}`
      );
      form.setValue(
        'settings.redirectUri',
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/${selectedIntegrationId || slug}/callback?sandbox=${sandbox}`
      );
    }
  }, [form]);

  // Update content items for drag-and-drop
  useEffect(() => {
    const items: ContentItem[] = [
      ...(form.getValues('images') || []).map((img, idx) => ({
        id: imageFields[idx]?.id || crypto.randomUUID(),
        type: 'image' as const,
        data: img || {
          url: '',
          position: 'center',
          size: 'medium',
        },
      })),
      ...(form.getValues('videos') || []).map((vid, idx) => ({
        id: videoFields[idx]?.id || crypto.randomUUID(),
        type: 'video' as const,
        data: vid || {
          url: '',
          position: 'center',
          size: 'medium',
        },
      })),
      ...(form.getValues('articles') || []).map((art, idx) => ({
        id: articleFields[idx]?.id || crypto.randomUUID(),
        type: 'article' as const,
        data: art || {
          title: '',
          content: '',
        },
      })),
      ...(form.getValues('buttons') || []).map((btn, idx) => ({
        id: buttonFields[idx]?.id || crypto.randomUUID(),
        type: 'button' as const,
        data: btn || {
          label: '',
          link: '',
          type: 'primary',
        },
      })),
      ...(form.getValues('dividers') || []).map((div, idx) => ({
        id: dividerFields[idx]?.id || crypto.randomUUID(),
        type: 'divider' as const,
        data: div || { style: 'solid 1px gray' },
      })),
    ];
    setContentItems(items);
  }, [imageFields, videoFields, articleFields, buttonFields, dividerFields, form]);

  // Add content item
  const addContentItem = useCallback((type: ContentItem['type']) => {
    const id = crypto.randomUUID();
    switch (type) {
      case 'image':
        appendImage({
          id,
          url: '',
          position: 'center',
          size: 'medium',
          fontSize: '16px',
          fontFamily: 'Arial',
          margin: '10px',
          padding: '10px',
          customPosition: { position: 'relative', top: '0px', left: '0px' },
        });
        break;
      case 'video':
        appendVideo({
          id,
          url: '',
          position: 'center',
          size: 'medium',
          fontSize: '16px',
          fontFamily: 'Arial',
          margin: '10px',
          padding: '10px',
          customPosition: { position: 'relative', top: '0px', left: '0px' },
        });
        break;
      case 'article':
        appendArticle({
          id,
          title: '',
          content: '',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          fontSize: '16px',
          fontFamily: 'Arial',
        });
        break;
      case 'button':
        appendButton({
          id,
          label: '',
          link: '',
          type: 'primary',
          backgroundColor: '#007bff',
          textColor: '#ffffff',
          borderRadius: '4px',
          padding: '8px 16px',
        });
        break;
      case 'divider':
        appendDivider({
          id,
          style: 'solid 1px gray',
        });
        break;
    }
  }, [appendImage, appendVideo, appendArticle, appendButton, appendDivider]);

  // Remove content item
  const removeContentItem = useCallback((index: number, type: ContentItem['type']) => {
    switch (type) {
      case 'image':
        removeImage(index);
        break;
      case 'video':
        removeVideo(index);
        break;
      case 'article':
        removeArticle(index);
        break;
      case 'button':
        removeButton(index);
        break;
      case 'divider':
        removeDivider(index);
        break;
    }
  }, [removeImage, removeVideo, removeArticle, removeButton, removeDivider]);

  // Move content item
  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    const draggedItem = contentItems[dragIndex];
    if (!draggedItem) return;
    const newItems = [...contentItems];
    newItems.splice(dragIndex, 1);
    newItems.splice(hoverIndex, 0, draggedItem);
    setContentItems(newItems);

    const type = draggedItem.type;
    switch (type) {
      case 'image':
        const images = [...(form.getValues('images') || [])];
        if (images[dragIndex]) {
          images.splice(dragIndex, 1);
          images.splice(hoverIndex, 0, draggedItem.data);
          form.setValue('images', images);
        } else {
          console.error('No image found at dragIndex:', dragIndex);
        }
        break;
      case 'video':
        const videos = [...(form.getValues('videos') || [])];
        if (videos[dragIndex]) {
          videos.splice(dragIndex, 1);
          videos.splice(hoverIndex, 0, draggedItem.data);
          form.setValue('videos', videos);
        } else {
          console.error('No video found at dragIndex:', dragIndex);
        }
        break;
      case 'article':
        const articles = [...(form.getValues('articles') || [])];
        if (articles[dragIndex]) {
          articles.splice(dragIndex, 1);
          articles.splice(hoverIndex, 0, draggedItem.data);
          form.setValue('articles', articles);
        } else {
          console.error('No article found at dragIndex:', dragIndex);
        }
        break;
      case 'button':
        const buttons = [...(form.getValues('buttons') || [])];
        if (buttons[dragIndex]) {
          buttons.splice(dragIndex, 1);
          buttons.splice(hoverIndex, 0, draggedItem.data);
          form.setValue('buttons', buttons);
        } else {
          console.error('No button found at dragIndex:', dragIndex);
        }
        break;
      case 'divider':
        const dividers = [...(form.getValues('dividers') || [])];
        if (dividers[dragIndex]) {
          dividers.splice(dragIndex, 1);
          dividers.splice(hoverIndex, 0, draggedItem.data);
          form.setValue('dividers', dividers);
        } else {
          console.error('No divider found at dragIndex:', dragIndex);
        }
        break;
      default:
        console.error('Unknown item type:', type);
    }
  }, [contentItems, form, setContentItems]);

  // Render content item for preview
  const renderContentItem = useCallback((item: ContentItem): JSX.Element => {
    const t = useTranslations('admin integrations add');
    const style: React.CSSProperties = {
      margin: item.data.margin || '10px',
      padding: item.data.padding || '10px',
      fontSize: item.data.fontSize || '16px',
      fontFamily: item.data.fontFamily || 'Arial',
      ...(item.data.customPosition
        ? {
            position: item.data.customPosition.position,
            top: item.data.customPosition.top,
            left: item.data.customPosition.left,
          }
        : {}),
      backgroundColor: item.data.backgroundColor,
      color: item.data.textColor,
      borderRadius: item.data.borderRadius,
    };

    switch (item.type) {
      case 'image':
        return (
          <Image
            src={item.data.url || '/placeholder.png'}
            alt={t('integration image')}
            width={item.data.size === 'small' ? 150 : item.data.size === 'medium' ? 300 : 600}
            height={item.data.size === 'small' ? 100 : item.data.size === 'medium' ? 200 : 400}
            className={`object-cover ${item.data.position}`}
            style={style}
            onError={(e) => (e.currentTarget.src = '/placeholder.png')}
          />
        );
      case 'video':
        return (
          <video
            src={item.data.url}
            controls
            className={`w-full ${item.data.size === 'small' ? 'max-w-xs' : item.data.size === 'medium' ? 'max-w-md' : 'max-w-lg'}`}
            style={style}
            aria-label={t('integration video')}
          >
            {t('video not supported')}
          </video>
        );
      case 'article':
        return (
          <div style={style} aria-label={t('integration article')}>
            <h4 className="text-lg font-semibold">{item.data.title}</h4>
            <p>{item.data.content}</p>
          </div>
        );
      case 'button':
        return (
          <Button
            variant={item.data.type === 'primary' ? 'default' : item.data.type === 'secondary' ? 'outline' : 'link'}
            style={style}
            asChild
          >
            <a href={item.data.link} target="_blank" rel="noopener noreferrer" aria-label={item.data.label}>
              {item.data.label}
            </a>
          </Button>
        );
      case 'divider':
        return <hr style={{ border: item.data.style }} aria-hidden="true" />;
      default:
        return <div aria-hidden="true" />;
    }
  }, []);

  // Handle form submission
  const onSubmit = async (data: IntegrationForm) => {
    console.log('Form Data:', data);
    setIsLoading(true);
    try {
      const endpoint = data.selectedIntegrationId
        ? `/api/admin/integrations/${data.selectedIntegrationId}`
        : '/api/admin/integrations';
      const method = data.selectedIntegrationId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'UNSUPPORTED_EVENT') {
          throw new Error(t('error.unsupported_event', { event: error.event }));
        } else if (error.code === 'INVALID_EVENT_TYPE') {
          throw new Error(t('error.invalid_event_type', { event: error.event, type: error.type }));
        }
        throw new Error(error.message || t('error.message'));
      }

      toast({
        title: t('success.title'),
        description: data.selectedIntegrationId ? t('success.update') : t('success.message'),
      });
      router.push('/admin/integrations');
    } catch (error) {
      console.error('Submit Error:', error);
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: error instanceof Error ? error.message : t('error.message'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tab change and update URL hash
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.pushState(null, '', `#${value}`);
  };

  // Handle preview
  const onPreview = async () => {
    setPreviewLoading(true);
    try {
      const data = form.getValues();
      const response = await fetch('/api/admin/integrations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(t('error.preview'));
      }
      const { previewUrl } = await response.json();
      window.open(previewUrl, '_blank');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: error instanceof Error ? error.message : t('error.message'),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
        <div className="flex space-x-6">
          {/* Sidebar */}
          <nav className="w-64 bg-gray-100 p-4 rounded-lg" aria-label={t('sidebar navigation')}>
            <ul className="space-y-2">
              {[
                'basic-info',
                'credentials',
                'webhook',
                'api-endpoints',
                'settings',
                'pricing',
                'content',
                'auto-register',
              ].map((section) => (
                <li key={section}>
                  <a
                    href={`#${section}`}
                    className={`block text-blue-600 hover:underline ${activeTab === section ? 'font-bold underline' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange(section);
                    }}
                    aria-current={activeTab === section ? 'page' : undefined}
                  >
                    {t(section.replace('-', ' '))}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {/* Main Content */}
          <div className="flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="mb-4">
                    {[
                      'basic-info',
                      'credentials',
                      'webhook',
                      'api-endpoints',
                      'settings',
                      'pricing',
                      'content',
                      'auto-register',
                    ].map((tab) => (
                      <TabsTrigger key={tab} value={tab}>
                        {t(tab.replace('-', ' '))}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {/* Basic Info */}
                  <TabsContent value="basic-info">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('basic info')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="selectedIntegrationId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('select integration')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger aria-label={t('select integration')}>
                                    <SelectValue placeholder={t('select integration placeholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="new">{t('new integration')}</SelectItem>
                                  {integrations.map((integration) => (
                                    <SelectItem key={integration.id} value={integration.id}>
                                      {integration.providerName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="providerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('provider name')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('provider name placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('type')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger aria-label={t('type')}>
                                    <SelectValue placeholder={t('select type')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {[
                                    'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing',
                                    'accounting', 'crm', 'analytics', 'automation', 'communication', 'education',
                                    'security', 'advertising', 'tax', 'other',
                                  ].map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(`types.${type}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('description')}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t('description placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="logoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('logo url')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('logo url placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex space-x-4">
                          <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-label={t('is active')}
                                  />
                                </FormControl>
                                <FormLabel>{t('is active')}</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="sandbox"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-label={t('sandbox mode')}
                                  />
                                </FormControl>
                                <FormLabel>{t('sandbox mode')}</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Credentials */}
                  <TabsContent value="credentials">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('credentials')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="credentials"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('credentials')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder={t('credential key')}
                                      id="credentialKey"
                                      aria-label={t('credential key')}
                                    />
                                    <Input
                                      placeholder={t('credential value')}
                                      id="credentialValue"
                                      type="password"
                                      aria-label={t('credential value')}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const keyInput = document.getElementById('credentialKey') as HTMLInputElement;
                                          const valueInput = document.getElementById('credentialValue') as HTMLInputElement;
                                          if (keyInput.value && valueInput.value) {
                                            const newCredentials = { ...(field.value || {}), [keyInput.value]: valueInput.value };
                                            field.onChange(newCredentials);
                                            keyInput.value = '';
                                            valueInput.value = '';
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    {Object.entries(field.value || {}).map(([key, value]) => (
                                      <div key={key} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{`${key}: ${value}`}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newCredentials = { ...(field.value || {}) };
                                            delete newCredentials[key];
                                            field.onChange(newCredentials);
                                          }}
                                          aria-label={t('remove credential')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Webhook */}
                  <TabsContent value="webhook">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('webhook')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="webhook.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  aria-label={t('enable webhook')}
                                />
                              </FormControl>
                              <FormLabel>{t('enable webhook')}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="webhook.url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('webhook url')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('webhook url placeholder')}
                                  {...field}
                                  readOnly
                                  aria-readonly
                                />
                              </FormControl>
                              <FormDescription>
                                {t('webhook url description')} {t('register this in provider settings')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="webhook.secret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('webhook secret')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('webhook secret placeholder')}
                                  type="password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="webhook.events"
                          render={({ field }) => {
                            const integrationType = form.watch('type');
                            const supportedEvents: Record<string, string[]> = {
                              payment: ['order payment completed', 'payment succeeded', 'withdrawal created', 'withdrawal updated'],
                              marketplace: [
                                'order created', 'order updated', 'order fulfilled', 'order cancelled', 'order shipment updated',
                                'product created', 'product updated', 'product deleted', 'product imported', 'product synced',
                                'seller registered', 'seller updated'
                              ],
                              warehouse: ['product created', 'product updated', 'product deleted', 'product imported', 'product synced', 'inventory updated'],
                              dropshipping: ['order fulfilled', 'product created', 'product updated', 'product deleted', 'product imported', 'product synced'],
                              shipping: ['order shipment updated', 'shipment updated'],
                              tax: ['tax transaction created', 'tax report created'],
                              crm: ['customer created', 'customer updated'],
                              marketing: ['campaign updated', 'ad performance updated'],
                              advertising: ['campaign updated', 'ad performance updated'],
                              analytics: ['analytics updated'],
                              automation: ['automation triggered'],
                              communication: ['message sent'],
                              education: ['course updated'],
                              security: ['security alert'],
                              accounting: ['transaction recorded'],
                              other: [],
                            };

                            return (
                              <FormItem>
                                <FormLabel>{t('webhook events')}</FormLabel>
                                <FormControl>
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <Select
                                        onValueChange={(value: string) => {
                                          if (!value) return;
                                          if (field.value?.includes(value)) {
                                            toast({
                                              variant: 'destructive',
                                              title: t('error.title'),
                                              description: t('webhook event already added', { event: t(`events.${value}`) }),
                                            });
                                            return;
                                          }
                                          const newEvents = [...(field.value || []), value];
                                          field.onChange(newEvents);
                                        }}
                                      >
                                        <SelectTrigger aria-label={t('select webhook event')}>
                                          <SelectValue placeholder={t('select webhook event')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(supportedEvents[integrationType] || []).map((event) => (
                                            <SelectItem key={event} value={event}>
                                              {t(`events.${event}`)}
                                            </SelectItem>
                                          ))}
                                          {integrationType === 'other' && (
                                            <div className="px-2 py-1">
                                              <Input
                                                placeholder={t('custom event placeholder')}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && e.currentTarget.value) {
                                                    const customEvent = e.currentTarget.value;
                                                    if (field.value?.includes(customEvent)) {
                                                      toast({
                                                        variant: 'destructive',
                                                        title: t('error.title'),
                                                        description: t('webhook event already added', { event: customEvent }),
                                                      });
                                                      return;
                                                    }
                                                    const newEvents = [...(field.value || []), customEvent];
                                                    field.onChange(newEvents);
                                                    e.currentTarget.value = '';
                                                  }
                                                }}
                                              />
                                            </div>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          const allEvents = supportedEvents[integrationType] || [];
                                          field.onChange(allEvents);
                                          toast({
                                            title: t('success.title'),
                                            description: t('all events selected'),
                                          });
                                        }}
                                        aria-label={t('select all events')}
                                      >
                                        {t('select all events')}
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {(field.value || []).map((event: string, idx: number) => (
                                        <div key={idx} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                          <span>{t(`events.${event}`, { defaultValue: event })}</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const newEvents = (field.value || []).filter((e: string) => e !== event);
                                              field.onChange(newEvents);
                                            }}
                                            aria-label={t('remove webhook event')}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                    {(field.value || []).length > 0 && (
                                      <div className="mt-4">
                                        <h4 className="text-lg font-semibold">{t('selected events preview')}</h4>
                                        <ul className="list-disc pl-5">
                                          {(field.value || []).map((event: string, idx: number) => (
                                            <li key={idx}>{t(`events.${event}`, { defaultValue: event })}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  {t('webhook events description')}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const slug = form
                              .watch('providerName')
                              .toLowerCase()
                              .replace(/[\s_]+/g, '-')
                              .replace(/[^\w-]/g, '');
                            form.setValue('webhook', {
                              enabled: false,
                              url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/integrations?provider=${slug}&sandbox=${form.watch('sandbox')}`,
                              secret: '',
                              events: [],
                            });
                            toast({
                              title: t('success.title'),
                              description: t('webhook reset'),
                            });
                          }}
                          aria-label={t('reset webhook')}
                        >
                          {t('reset webhook')}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* API Endpoints */}
                  <TabsContent value="api-endpoints">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('api endpoints')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="apiEndpoints"
                          render={({ field }) => {
                            const integrationType = form.watch('type');
                            const supportedEndpoints: Record<string, { key: string; value: string }[]> = {
                              payment: [
                                { key: 'create_payment', value: '/api/payments/create' },
                                { key: 'refund_payment', value: '/api/payments/refund' },
                              ],
                              marketplace: [
                                { key: 'create_order', value: '/api/orders/create' },
                                { key: 'update_product', value: '/api/products/update' },
                              ],
                              warehouse: [
                                { key: 'update_inventory', value: '/api/inventory/update' },
                                { key: 'sync_product', value: '/api/products/sync' },
                              ],
                              dropshipping: [
                                { key: 'fulfill_order', value: '/api/orders/fulfill' },
                                { key: 'import_product', value: '/api/products/import' },
                              ],
                              shipping: [
                                { key: 'create_shipment', value: '/api/shipments/create' },
                                { key: 'track_shipment', value: '/api/shipments/track' },
                              ],
                              tax: [
                                { key: 'calculate_tax', value: '/api/taxes/calculate' },
                                { key: 'generate_report', value: '/api/taxes/report' },
                              ],
                              crm: [
                                { key: 'create_customer', value: '/api/customers/create' },
                                { key: 'update_customer', value: '/api/customers/update' },
                              ],
                              marketing: [
                                { key: 'create_campaign', value: '/api/campaigns/create' },
                                { key: 'get_analytics', value: '/api/campaigns/analytics' },
                              ],
                              advertising: [
                                { key: 'create_ad', value: '/api/ads/create' },
                                { key: 'get_performance', value: '/api/ads/performance' },
                              ],
                              analytics: [
                                { key: 'get_analytics', value: '/api/analytics' },
                              ],
                              automation: [
                                { key: 'trigger_automation', value: '/api/automations/trigger' },
                              ],
                              communication: [
                                { key: 'send_message', value: '/api/messages/send' },
                              ],
                              education: [
                                { key: 'update_course', value: '/api/courses/update' },
                              ],
                              security: [
                                { key: 'security_check', value: '/api/security/check' },
                              ],
                              accounting: [
                                { key: 'record_transaction', value: '/api/transactions/record' },
                              ],
                              other: [],
                            };

                            return (
                              <FormItem>
                                <FormLabel>{t('api endpoints')}</FormLabel>
                                <FormControl>
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <Select
                                        onValueChange={(value: string) => {
                                          const selectedEndpoint = supportedEndpoints[integrationType]?.find((e) => e.key === value);
                                          if (!selectedEndpoint) return;
                                          if (Object.keys(field.value || {}).includes(selectedEndpoint.key)) {
                                            toast({
                                              variant: 'destructive',
                                              title: t('error.title'),
                                              description: t('endpoint already added', { key: selectedEndpoint.key }),
                                            });
                                            return;
                                          }
                                          const newEndpoints = {
                                            ...(field.value || {}),
                                            [selectedEndpoint.key]: selectedEndpoint.value,
                                          };
                                          field.onChange(newEndpoints);
                                        }}
                                      >
                                        <SelectTrigger aria-label={t('select endpoint')}>
                                          <SelectValue placeholder={t('select endpoint')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(supportedEndpoints[integrationType] || []).map((endpoint) => (
                                            <SelectItem key={endpoint.key} value={endpoint.key}>
                                              {t(`endpoints.${endpoint.key}`)}
                                            </SelectItem>
                                          ))}
                                          {integrationType === 'other' && (
                                            <div className="px-2 py-1">
                                              <Input
                                                placeholder={t('endpoint key')}
                                                id="endpointKey"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && e.currentTarget.value) {
                                                    const keyInput = e.currentTarget;
                                                    const valueInput = document.getElementById('endpointValue') as HTMLInputElement;
                                                    if (keyInput.value && valueInput.value) {
                                                      if (Object.keys(field.value || {}).includes(keyInput.value)) {
                                                        toast({
                                                          variant: 'destructive',
                                                          title: t('error.title'),
                                                          description: t('endpoint already added', { key: keyInput.value }),
                                                        });
                                                        return;
                                                      }
                                                      const newEndpoints = { ...(field.value || {}), [keyInput.value]: valueInput.value };
                                                      field.onChange(newEndpoints);
                                                      keyInput.value = '';
                                                      valueInput.value = '';
                                                    }
                                                  }
                                                }}
                                              />
                                              <Input
                                                placeholder={t('endpoint value')}
                                                id="endpointValue"
                                                className="mt-2"
                                              />
                                            </div>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          const allEndpoints = supportedEndpoints[integrationType] || [];
                                          const newEndpoints = allEndpoints.reduce((acc, endpoint) => ({
                                            ...acc,
                                            [endpoint.key]: endpoint.value,
                                          }), {});
                                          field.onChange(newEndpoints);
                                          toast({
                                            title: t('success.title'),
                                            description: t('all endpoints selected'),
                                          });
                                        }}
                                        aria-label={t('select all endpoints')}
                                      >
                                        {t('select all endpoints')}
                                      </Button>
                                    </div>
                                    <div className="space-y-1">
                                      {Object.entries(field.value || {}).map(([key, value]) => (
                                        <div key={key} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                          <span>{`${t(`endpoints.${key}`, { defaultValue: key })}: ${value}`}</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              const newEndpoints = { ...(field.value || {}) };
                                              delete newEndpoints[key];
                                              field.onChange(newEndpoints);
                                            }}
                                            aria-label={t('remove endpoint')}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Settings */}
                  <TabsContent value="settings">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('settings')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="settings.apiUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('api url')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('api url placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.authType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('auth type')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger aria-label={t('auth type')}>
                                    <SelectValue placeholder={t('select auth type')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {['Bearer', 'Basic', 'APIKey', 'OAuth'].map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.clientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('client id')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('client id placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.clientSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('client secret')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('client secret placeholder')}
                                  type="password"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.redirectUri"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('redirect uri')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('redirect uri placeholder')}
                                  value={field.value || `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/${form.watch('selectedIntegrationId') || form.watch('providerName').toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '')}/callback?sandbox=${form.watch('sandbox')}`}
                                  disabled
                                  aria-readonly
                                />
                              </FormControl>
                              <FormDescription>
                                {t('redirect uri description')} {t('register this in provider settings')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.responseMapping"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('response mapping')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder={t('mapping key')}
                                      id="mappingKey"
                                      aria-label={t('mapping key')}
                                    />
                                    <Input
                                      placeholder={t('mapping path')}
                                      id="mappingPath"
                                      aria-label={t('mapping path')}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const keyInput = document.getElementById('mappingKey') as HTMLInputElement;
                                          const pathInput = document.getElementById('mappingPath') as HTMLInputElement;
                                          if (keyInput.value && pathInput.value) {
                                            const newMapping = { ...(field.value || {}), [keyInput.value]: pathInput.value };
                                            field.onChange(newMapping);
                                            keyInput.value = '';
                                            pathInput.value = '';
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    {Object.entries(field.value || {}).map(([key, path]) => (
                                      <div key={key} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{`${key}: ${path}`}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newMapping = { ...(field.value || {}) };
                                            delete newMapping[key];
                                            field.onChange(newMapping);
                                          }}
                                          aria-label={t('remove mapping')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.retryOptions.maxRetries"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('max retries')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="3"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.retryOptions.initialDelay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('retry delay')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="1000"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.amountMultiplier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('amount multiplier')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="1"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.supportedCurrencies"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('supported currencies')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input
                                    placeholder={t('add currency')}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.currentTarget.value) {
                                        const newCurrencies = [...(field.value || []), e.currentTarget.value.toUpperCase()];
                                        field.onChange(newCurrencies);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    aria-label={t('add currency')}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    {(field.value || []).map((currency: string, idx: number) => (
                                      <div key={idx} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{currency}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newCurrencies = (field.value || []).filter((c: string) => c !== currency);
                                            field.onChange(newCurrencies);
                                          }}
                                          aria-label={t('remove currency')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="settings.supportedCountries"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('supported countries')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input
                                    placeholder={t('add country')}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.currentTarget.value) {
                                        const newCountries = [...(field.value || []), e.currentTarget.value.toUpperCase()];
                                        field.onChange(newCountries);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    aria-label={t('add country')}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    {(field.value || []).map((country: string, idx: number) => (
                                      <div key={idx} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{country}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newCountries = (field.value || []).filter((c: string) => c !== country);
                                            field.onChange(newCountries);
                                          }}
                                          aria-label={t('remove country')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="oauth.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  aria-label={t('enable oauth')}
                                />
                              </FormControl>
                              <FormLabel>{t('enable oauth')}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="oauth.authorizationUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('authorization url')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('authorization url placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="oauth.tokenUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('token url')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('token url placeholder')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="oauth.scopes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('oauth scopes')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input
                                    placeholder={t('add scope')}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.currentTarget.value) {
                                        const newScopes = [...(field.value || []), e.currentTarget.value];
                                        field.onChange(newScopes);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                    aria-label={t('add scope')}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    {(field.value || []).map((scope: string, idx: number) => (
                                      <div key={idx} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{scope}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newScopes = (field.value || []).filter((s: string) => s !== scope);
                                            field.onChange(newScopes);
                                          }}
                                          aria-label={t('remove scope')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Pricing */}
                  <TabsContent value="pricing">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('pricing')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="pricing.isFree"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  aria-label={t('is free')}
                                />
                              </FormControl>
                              <FormLabel>{t('is free')}</FormLabel>
                            </FormItem>
                          )}
                        />
                        {!form.watch('pricing.isFree') && (
                          <>
                            <FormField
                              control={form.control}
                              name="pricing.commissionRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('commission rate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.05"
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="pricing.requiredPlanIds"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('required plans')}</FormLabel>
                                  <FormControl>
                                    <Select
                                      onValueChange={(value) => {
                                        const newPlans = [...(field.value || []), value];
                                        field.onChange(newPlans);
                                      }}
                                    >
                                      <SelectTrigger aria-label={t('select plans')}>
                                        <SelectValue placeholder={t('select plans')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {subscriptionPlans.map((plan) => (
                                          <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {(field.value || []).map((planId: string, idx: number) => (
                                      <div key={idx} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                                        <span>{subscriptionPlans.find((p) => p.id === planId)?.name}</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newPlans = (field.value || []).filter((p: string) => p !== planId);
                                            field.onChange(newPlans);
                                          }}
                                          aria-label={t('remove plan')}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Content */}
                  <TabsContent value="content">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('content')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Select
                            onValueChange={(value) => {
                              if (value === 'image-preset-1') {
                                appendImage({
                                  id: crypto.randomUUID(),
                                  url: 'https://example.com/image.jpg',
                                  position: 'center',
                                  size: 'medium',
                                  fontSize: '16px',
                                  fontFamily: 'Arial',
                                  margin: '10px',
                                  padding: '10px',
                                  customPosition: { position: 'relative', top: '0px', left: '0px' },
                                });
                              } else if (value === 'video-preset-1') {
                                appendVideo({
                                  id: crypto.randomUUID(),
                                  url: 'https://example.com/video.mp4',
                                  position: 'center',
                                  size: 'medium',
                                  fontSize: '16px',
                                  fontFamily: 'Arial',
                                  margin: '10px',
                                  padding: '10px',
                                  customPosition: { position: 'relative', top: '0px', left: '0px' },
                                });
                              } else if (value === 'article-preset-1') {
                                appendArticle({
                                  id: crypto.randomUUID(),
                                  title: 'Sample Article',
                                  content: 'This is a sample article content.',
                                  backgroundColor: '#ffffff',
                                  textColor: '#000000',
                                  fontSize: '16px',
                                  fontFamily: 'Arial',
                                });
                              } else if (value === 'button-preset-1') {
                                appendButton({
                                  id: crypto.randomUUID(),
                                  label: 'Click Me',
                                  link: 'https://example.com',
                                  type: 'primary',
                                  backgroundColor: '#007bff',
                                  textColor: '#ffffff',
                                  borderRadius: '4px',
                                  padding: '8px 16px',
                                });
                              }
                            }}
                          >
                            <SelectTrigger aria-label={t('select preset')}>
                              <SelectValue placeholder={t('select preset')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image-preset-1">{t('image preset 1')}</SelectItem>
                              <SelectItem value="video-preset-1">{t('video preset 1')}</SelectItem>
                              <SelectItem value="article-preset-1">{t('article preset 1')}</SelectItem>
                              <SelectItem value="button-preset-1">{t('button preset 1')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['image', 'video', 'article', 'button', 'divider'].map((type) => (
                            <Button
                              key={type}
                              type="button"
                              variant="outline"
                              onClick={() => addContentItem(type as ContentItem['type'])}
                              disabled={isLoading}
                              aria-label={t(`add ${type}`)}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" /> {t(`add ${type}`)}
                            </Button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {contentItems.map((item, index) => (
                            <DraggableItem
                              key={item.id}
                              item={item}
                              index={index}
                              moveItem={moveItem}
                              removeItem={() => removeContentItem(index, item.type)}
                              renderItem={renderContentItem}
                            />
                          ))}
                        </div>
                        {/* Content Customization */}
                        {imageFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded mt-4">
                            <h4 className="text-lg font-semibold">{t('image')} {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`images.${index}.url`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('image url')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('image url placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.position`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('position')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('position')}>
                                        <SelectValue placeholder={t('select position')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['left', 'center', 'right'].map((pos) => (
                                        <SelectItem key={pos} value={pos}>{t(pos)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.size`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('size')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('size')}>
                                        <SelectValue placeholder={t('select size')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['small', 'medium', 'large'].map((size) => (
                                        <SelectItem key={size} value={size}>{t(size)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.fontSize`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font size')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="16px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.fontFamily`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font family')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Arial" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.margin`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('margin')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="10px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.padding`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('padding')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="10px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.customPosition.position`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('custom position')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('custom position')}>
                                        <SelectValue placeholder={t('select custom position')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['absolute', 'relative', 'fixed'].map((pos) => (
                                        <SelectItem key={pos} value={pos}>{t(pos)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.customPosition.top`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('top')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`images.${index}.customPosition.left`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('left')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                        {videoFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded mt-4">
                            <h4 className="text-lg font-semibold">{t('video')} {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`videos.${index}.url`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('video url')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('video url placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.position`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('position')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('position')}>
                                        <SelectValue placeholder={t('select position')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['left', 'center', 'right'].map((pos) => (
                                        <SelectItem key={pos} value={pos}>{t(pos)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.size`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('size')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('size')}>
                                        <SelectValue placeholder={t('select size')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['small', 'medium', 'large'].map((size) => (
                                        <SelectItem key={size} value={size}>{t(size)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.fontSize`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font size')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="16px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.fontFamily`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font family')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Arial" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.margin`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('margin')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="10px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.padding`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('padding')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="10px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.customPosition.position`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('custom position')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('custom position')}>
                                        <SelectValue placeholder={t('select custom position')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {['absolute', 'relative', 'fixed'].map((pos) => (
                                        <SelectItem key={pos} value={pos}>{t(pos)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.customPosition.top`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('top')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`videos.${index}.customPosition.left`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('left')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                        {articleFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded mt-4">
                            <h4 className="text-lg font-semibold">{t('article')} {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`articles.${index}.title`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('article title')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('article title placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`articles.${index}.content`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('article content')}</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder={t('article content placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`articles.${index}.backgroundColor`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('background color')}</FormLabel>
                                  <FormControl>
                                    <Input type="color" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`articles.${index}.textColor`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('text color')}</FormLabel>
                                  <FormControl>
                                    <Input type="color" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`articles.${index}.fontSize`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font size')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="16px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`articles.${index}.fontFamily`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('font family')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Arial" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}

                        {buttonFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded mt-4">
                            <h4 className="text-lg font-semibold">{t('button')} {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('button label')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('button label placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.link`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('button link')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('button link placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('button type')}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger aria-label={t('button type')}>
                                        <SelectValue placeholder={t('select button type')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="primary">{t('button type.primary')}</SelectItem>
                                      <SelectItem value="secondary">{t('button type.secondary')}</SelectItem>
                                      <SelectItem value="link">{t('button type.link')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.backgroundColor`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('background color')}</FormLabel>
                                  <FormControl>
                                    <Input type="color" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.textColor`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('text color')}</FormLabel>
                                  <FormControl>
                                    <Input type="color" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.borderRadius`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('border radius')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="4px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`buttons.${index}.padding`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('padding')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="8px 16px" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                        {dividerFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded mt-4">
                            <h4 className="text-lg font-semibold">{t('divider')} {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`dividers.${index}.style`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('divider style')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="solid 1px gray" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                      </CardContent>

                    </Card>
                  </TabsContent>

                  {/* Auto Register */}
                  <TabsContent value="auto-register">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('auto register')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="autoRegister.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  aria-label={t('enable auto register')}
                                />
                              </FormControl>
                              <FormLabel>{t('enable auto register')}</FormLabel>
                            </FormItem>
                          )}
                        />
                        {form.watch('autoRegister.enabled') && (
                          <div className="space-y-4">
                            {autoRegisterFields.map((field, index) => (
                              <div key={field.id} className="border p-4 rounded">
                                <h4 className="text-lg font-semibold">{t('field')} {index + 1}</h4>
                                <FormField
                                  control={form.control}
                                  name={`autoRegister.fields.${index}.key`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('field key')}</FormLabel>
                                      <FormControl>
                                        <Input placeholder={t('field key placeholder')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`autoRegister.fields.${index}.label`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('field label')}</FormLabel>
                                      <FormControl>
                                        <Input placeholder={t('field label placeholder')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`autoRegister.fields.${index}.type`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t("field type")}</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger aria-label={t("field type")}>
                                            <SelectValue placeholder={t("select field type")} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="text">{t("field type text")}</SelectItem>
                                          <SelectItem value="email">{t("field type email")}</SelectItem>
                                          <SelectItem value="password">{t("field type password")}</SelectItem>
                                          <SelectItem value="number">{t("field type number")}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`autoRegister.fields.${index}.required`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          aria-label={t('field required')}
                                        />
                                      </FormControl>
                                      <FormLabel>{t('field required')}</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeAutoRegisterField(index)}
                                  aria-label={t('remove field')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">{t('remove field')}</span>
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => appendAutoRegisterField({ key: '', label: '', type: 'text', required: true })}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" /> {t('add field')}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onPreview}
                    disabled={previewLoading}
                    aria-label={t('preview')}
                  >
                    {previewLoading ? t('loading') : t('preview')}
                  </Button>
                  <Button type="submit" disabled={isLoading} aria-label={t('save')}>
                    {isLoading ? t('loading') : t('save')}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}