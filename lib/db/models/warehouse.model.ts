import { Schema, model, models, Document, Model } from 'mongoose';
import {
  WarehouseProduct,
  ShipmentStatus,
  CreateShipmentRequest,
  WarehouseProvider,
} from '@/lib/services/warehouse/types';

export interface IShipmentEvent {
  date: Date;
  status: string;
  location: string;
}

export interface IShipment extends Document {
  trackingId: string;
  orderId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
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
    phone: string;
  };
  items: {
    productId: Schema.Types.ObjectId;
    quantity: number;
  }[];
  warehouseId: Schema.Types.ObjectId;
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
  location: string;
  lastSync: Date;
  lastUpdated: Date;
  updatedBy: string;
}

export interface IWarehouse extends Document {
  name: string;
  code: string;
  provider: string;
  apiKey: string;
  apiUrl: string;
  location: string;
  isActive: boolean;
  products: Map<string, IWarehouseStock>;
  shipments: IShipment[];
  settings: {
    autoSync: boolean;
    syncInterval: number;
    lastSyncAt?: Date;
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
  trackingId: {
    type: String,
    required: true,
    unique: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered'],
    default: 'pending',
  },
  location: String,
  estimatedDeliveryDate: Date,
  events: [
    {
      date: { type: Date, required: true },
      status: { type: String, required: true },
      location: { type: String, required: true },
    },
  ],
  shippingAddress: {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
    },
  ],
  warehouseId: {
    type: Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
  },
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

const warehouseSchema = new Schema<IWarehouse>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  provider: {
    type: String,
    required: true,
  },
  apiKey: {
    type: String,
    required: true,
  },
  apiUrl: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  products: {
    type: Map,
    of: new Schema({
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      sku: { type: String, required: true },
      name: { type: String, required: true },
      quantity: { type: Number, default: 0 },
      location: String,
      lastSync: Date,
      lastUpdated: Date,
      updatedBy: String,
    }),
    default: new Map(),
  },
  shipments: [shipmentSchema],
  settings: {
    autoSync: { type: Boolean, default: true },
    syncInterval: { type: Number, default: 3600000 },
    lastSyncAt: Date,
  },
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

warehouseSchema.index({ provider: 1 });
warehouseSchema.index({ isActive: 1 });
warehouseSchema.index({ 'shipments.trackingId': 1 });
warehouseSchema.index({ 'products.sku': 1 });
warehouseSchema.index({ updatedAt: -1 });

warehouseSchema.methods.createShipment = async function (request: CreateShipmentRequest) {
  try {
    console.log(`[${new Date().toISOString()}] Creating shipment for order ${request.orderId}`);

    for (const item of request.items) {
      const stock = this.products.get(item.productId);
      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    const provider: WarehouseProvider = {
      name: this.provider,
      createShipment: async () => ({ trackingId: `TRK-${Date.now()}` }),
      getShipmentStatus: async () => ({
        trackingId: '',
        status: 'pending',
        events: [],
      }),
      getInventory: async () => ({
        id: '',
        sku: '',
        name: '',
        quantity: 0,
        location: '',
      }),
      updateInventory: async () => {},
    };

    const { trackingId } = await provider.createShipment(request);

    const shipment = {
      trackingId,
      orderId: request.orderId,
      status: 'pending' as const,
      shippingAddress: request.shippingAddress,
      items: request.items,
      warehouseId: this._id,
      events: [{
        date: new Date(),
        status: 'created',
        location: this.location,
      }],
      createdBy: 'SYSTEM',
      updatedBy: 'SYSTEM',
    };

    this.shipments.push(shipment);
    await this.save();

    for (const item of request.items) {
      await this.updateStock(
        item.productId,
        (this.products.get(item.productId)?.quantity || 0) - item.quantity
      );
    }

    return { trackingId };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Shipment creation error:`, error);
    throw error;
  }
};

warehouseSchema.methods.getShipmentStatus = async function (trackingId: string) {
  const shipment = this.shipments.find((s) => s.trackingId === trackingId);
  if (!shipment) {
    throw new Error('Shipment not found');
  }

  return {
    trackingId: shipment.trackingId,
    status: shipment.status,
    location: shipment.location,
    estimatedDeliveryDate: shipment.estimatedDeliveryDate,
    events: shipment.events,
  };
};

warehouseSchema.methods.syncInventory = async function (productId?: string) {
  const provider: WarehouseProvider = {
    name: this.provider,
    createShipment: async () => ({ trackingId: '' }),
    getShipmentStatus: async () => ({
      trackingId: '',
      status: 'pending',
      events: [],
    }),
    getInventory: async () => ({
      id: '',
      sku: '',
      name: '',
      quantity: 0,
      location: '',
    }),
    updateInventory: async () => {},
  };

  try {
    console.log(`[${new Date().toISOString()}] Syncing inventory for warehouse ${this.name}`);

    if (productId) {
      const inventory = await provider.getInventory(productId);
      this.products.set(productId, {
        ...inventory,
        productId,
        lastSync: new Date(),
        lastUpdated: new Date(),
        updatedBy: 'SYSTEM',
      });
    } else {
      for (const [productId] of this.products) {
        const inventory = await provider.getInventory(productId);
        this.products.set(productId, {
          ...inventory,
          productId,
          lastSync: new Date(),
          lastUpdated: new Date(),
          updatedBy: 'SYSTEM',
        });
      }
    }

    this.settings.lastSyncAt = new Date();
    await this.save();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Inventory sync error:`, error);
    throw error;
  }
};

warehouseSchema.methods.updateStock = async function (productId: string, quantity: number) {
  try {
    const provider: WarehouseProvider = {
      name: this.provider,
      createShipment: async () => ({ trackingId: '' }),
      getShipmentStatus: async () => ({
        trackingId: '',
        status: 'pending',
        events: [],
      }),
      getInventory: async () => ({
        id: '',
        sku: '',
        name: '',
        quantity: 0,
        location: '',
      }),
      updateInventory: async () => {},
    };

    await provider.updateInventory(productId, quantity);

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
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Stock update error:`, error);
    throw error;
  }
};

const Warehouse = (models.Warehouse as Model<IWarehouse>) || model<IWarehouse>('Warehouse', warehouseSchema);

export default Warehouse;