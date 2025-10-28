export const USER_PERMISSIONS = ['profile:read', 'profile:write'] as const;
export const SELLER_PERMISSIONS = [
  'profile:read', 'profile:write',
  'products:read', 'products:write',
  'orders:read', 'orders:write',
  'customers:read', 'customers:write',
  'inventory:read', 'inventory:write',
  'analytics:read',
] as const;