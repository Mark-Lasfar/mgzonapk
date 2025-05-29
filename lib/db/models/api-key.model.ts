  // lib/db/models/api-key.model.ts

  import { Schema, model, models, Document, Model } from 'mongoose';
  import { ApiKey as ApiKeyType, ApiPermission } from '@/lib/api/types';
  import crypto from 'crypto';

  // Mongoose's Document interface, extending ApiKeyType to include '_id'
  export interface IApiKey extends Document, Omit<ApiKeyType, 'id'> {
    _id: string;  // MongoDB _id field (Mongoose adds this automatically)
  }

  const apiKeySchema = new Schema<IApiKey>(
    {
      // The userId is the reference to the user who owns the API key
      userId: {
        type: String,
        required: true,
        index: true,  // Adds an index for efficient querying
      },
      
      // Name of the API key, such as "Admin Access", "Read Only", etc.
      name: {
        type: String,
        required: true,
      },
      
      // API key string itself, unique for each key
      key: {
        type: String,
        required: true,
        unique: true,  // Ensure this field is unique in the database
      },
      
      // Secret key, used for verifying the API requests
      secret: {
        type: String,
        required: true,
      },
      
      // List of permissions assigned to this API key (such as read/write access)
      permissions: {
        type: [String],
        enum: [
          'products:read',
          'products:write',
          'orders:read',
          'orders:write',
          'customers:read',
          'customers:write',
          'inventory:read',
          'inventory:write',
          'analytics:read',
        ],
        default: ['products:read', 'orders:read'], // Default permissions
      },
      
      // Timestamp for when the API key was created
      createdAt: {
        type: Date,
        default: Date.now, // Default to current date if not provided
      },
      
      // Timestamp for when the API key was last used
      lastUsed: {
        type: Date,
      },
      
      // Expiration date for the API key
      expiresAt: {
        type: Date,
      },
      
      // Whether the API key is currently active (can be deactivated if needed)
      isActive: {
        type: Boolean,
        default: true, // Default to true (active)
      },
    },
    { timestamps: false } // Disable Mongoose's built-in `createdAt` and `updatedAt` as we handle it manually
  );

  // Pre-save hook to generate the API key and secret automatically before saving
  apiKeySchema.pre<IApiKey>('save', function (next) {
    if (this.isNew) {
      // Generate a random key using crypto and assign it
      this.key = `mgz_${crypto.randomBytes(16).toString('hex')}`;
      
      // Generate a random secret for the API key
      this.secret = crypto.randomBytes(32).toString('hex');
    }
    next();
  });

  // Creating or reusing the model if already exists
  const ApiKey: Model<IApiKey> = models.ApiKey || model<IApiKey>('ApiKey', apiKeySchema);

  export default ApiKey;
