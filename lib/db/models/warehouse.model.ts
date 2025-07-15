import { Schema, model, models, Document, Model } from 'mongoose';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import {
  WarehouseProduct,
  ShipmentStatus,
  CreateShipmentRequest,
  CreateProductRequest,
  UpdateProductRequest,
} from '@/lib/services/warehouse/types';
import { logger } from '@/lib/api/services/logging';
import Integration from './integration.model';

export interface IShipmentEvent {
  date: Date;
  status: 'created' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'exception';
  location: string;
  description?: string;
}

export interface IShipment extends Document {
  trackingId: string;
  orderId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'exception';
  location?: string;
  estimatedDeliveryDate?: Date;
  events: IShipmentEvent[];
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  items: {
    productId: Schema.Types.ObjectId;
    quantity: number;
  }[];
  warehouseId: Schema.Types.ObjectId;
  integrationId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface IWarehouseStock {
  productId: Schema.Types.ObjectId;
  sku: string;
  name: string;
  quantity: number;
  location?: string;
  lastSync: Date;
  lastUpdated: Date;
  updatedBy: string;
}

export interface IWarehouse extends Document {
  name: string;
  code: string;
  integrationId: Schema.Types.ObjectId;
  location: string;
  isActive: boolean;
  products: Map<string, IWarehouseStock>;
  shipments: IShipment[];
  settings: {
    autoSync: boolean;
    syncInterval: number;
    lastSyncAt?: Date;
    webhookUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  createShipment(request: CreateShipmentRequest): Promise<{ trackingId: string }>;
  getShipmentStatus(trackingId: string): Promise<ShipmentStatus>;
  syncInventory(productId?: string): Promise<void>;
  updateStock(productId: string, quantity: number): Promise<void>;
}

const shipmentSchema = new Schema<IShipment>({
  trackingId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'exception'],
    default: 'pending',
  },
  location: String,
  estimatedDeliveryDate: Date,
  events: [
    {
      date: { type: Date, required: true },
      status: { type: String, required: true },
      location: { type: String, required: true },
      description: String,
    },
  ],
  shippingAddress: {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: String,
  },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
    },
  ],
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

const warehouseStockSchema = new Schema<IWarehouseStock>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  location: String,
  lastSync: Date,
  lastUpdated: Date,
  updatedBy: String,
});

const warehouseSchema = new Schema<IWarehouse>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true },
  integrationId: { type: Schema.Types.ObjectId, ref: 'Integration', required: true },
  location: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  products: { type: Map, of: warehouseStockSchema, default: new Map() },
  shipments: [shipmentSchema],
  settings: {
    autoSync: { type: Boolean, default: true },
    syncInterval: { type: Number, default: 3600000 },
    lastSyncAt: Date,
    webhookUrl: String,
  },
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

warehouseSchema.index({ integrationId: 1 });
warehouseSchema.index({ isActive: 1 });
warehouseSchema.index({ 'shipments.trackingId': 1 });
warehouseSchema.index({ 'products.sku': 1 });

warehouseSchema.methods.createShipment = async function (request: CreateShipmentRequest) {
  try {
    const integration = await Integration.findById(this.integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    for (const item of request.items) {
      const stock = this.products.get(item.productId);
      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    const response = await fetch(`${integration.credentials.apiUrl}/shipments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.credentials.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to create shipment');
    }

    const { trackingId } = await response.json();
    const shipment = {
      trackingId,
      orderId: request.orderId,
      status: 'pending',
      shippingAddress: request.shippingAddress,
      items: request.items,
      warehouseId: this._id,
      integrationId: this.integrationId,
      events: [{ date: new Date(), status: 'created', location: this.location }],
      createdBy: 'SYSTEM',
      updatedBy: 'SYSTEM',
    };

    this.shipments.push(shipment);
    await this.save();

    for (const item of request.items) {
      await this.updateStock(item.productId, this.products.get(item.productId)!.quantity - item.quantity);
    }

    await WebhookDispatcher.dispatch(this.createdBy, 'warehouse.shipment.created', {
      warehouseId: this._id,
      trackingId,
      orderId: request.orderId,
    });

    return { trackingId };
  } catch (error) {
    logger.error('Shipment creation failed', { error });
    throw error;
  }
};

warehouseSchema.methods.getShipmentStatus = async function (trackingId: string) {
  const shipment = this.shipments.find((s: IShipment) => s.trackingId === trackingId);
  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const integration = await Integration.findById(this.integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  const response = await fetch(`${integration.credentials.apiUrl}/shipments/${trackingId}`, {
    headers: {
      Authorization: `Bearer ${integration.credentials.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch shipment status');
  }

  const status = await response.json();
  return {
    trackingId: shipment.trackingId,
    status: shipment.status,
    location: shipment.location,
    estimatedDeliveryDate: shipment.estimatedDeliveryDate,
    events: shipment.events,
    ...status,
  };
};

warehouseSchema.methods.syncInventory = async function (productId?: string) {
  try {
    const integration = await Integration.findById(this.integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const url = productId
      ? `${integration.credentials.apiUrl}/inventory/${productId}`
      : `${integration.credentials.apiUrl}/inventory`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${integration.credentials.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to sync inventory');
    }

    const inventoryData = await response.json();
    for (const item of inventoryData) {
      this.products.set(item.productId, {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        location: item.location,
        lastSync: new Date(),
        lastUpdated: new Date(),
        updatedBy: 'SYSTEM',
      });
    }

    this.settings.lastSyncAt = new Date();
    await this.save();

    await WebhookDispatcher.dispatch(this.createdBy, 'warehouse.inventory.synced', {
      warehouseId: this._id,
      products: Array.from(this.products.values()),
    });
  } catch (error) {
    logger.error('Inventory sync failed', { error });
    throw error;
  }
};

warehouseSchema.methods.updateStock = async function (productId: string, quantity: number) {
  try {
    const integration = await Integration.findById(this.integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    await fetch(`${integration.credentials.apiUrl}/inventory/${productId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${integration.credentials.apiKey}`,
      },
      body: JSON.stringify({ quantity }),
    });

    const stock = this.products.get(productId);
    if (stock) {
      this.products.set(productId, {
        ...stock,
        quantity,
        lastUpdated: new Date(),
        updatedBy: 'SYSTEM',
      });
    }

    await this.save();

    await WebhookDispatcher.dispatch(this.createdBy, 'warehouse.stock.updated', {
      warehouseId: this._id,
      productId,
      quantity,
    });
  } catch (error) {
    logger.error('Stock update failed', { error });
    throw error;
  }
};

const Warehouse = models.Warehouse as Model<IWarehouse> || model<IWarehouse>('Warehouse', warehouseSchema);
export default Warehouse;