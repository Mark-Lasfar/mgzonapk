export interface ShipBobProduct {
  reference_id: string;
  name: string;
  sku: string;
  barcode?: string;
  bundle?: boolean;
  bundle_items?: Array<{
    reference_id: string;
    quantity: number;
  }>;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  inventory_settings?: {
    reorder_point: number;
    restock_level: number;
  };
}

export interface ShipBobOrder {
  reference_id: string;
  shipping_method: string;
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    phone?: string;
    email?: string;
  };
  items: Array<{
    reference_id: string;
    quantity: number;
  }>;
  shipping_carrier?: string;
  shipping_service?: string;
  shipping_notes?: string;
  gift?: boolean;
  gift_message?: string;
}

export interface ShipBobInventory {
  product_id: string;
  reference_id: string;
  on_hand: number;
  available: number;
  reserved: number;
  allocated: number;
  locations: Array<{
    location_id: string;
    name: string;
    on_hand: number;
    available: number;
  }>;
}