// /home/mark/Music/my-nextjs-project-clean/lib/db/models/template.model.ts
import mongoose, { Schema, model, models, Document } from 'mongoose';

interface ITemplate extends Document {
  templateId: string;
  theme: 'light' | 'dark';
  font: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
  components: string[];

  testimonials: {
    id: string;
    name: string;
    quote: string;
    rating: number;
    image?: string;
  }[];
  backgroundImage: string;
  // createdBy: string;
  createdAt: Date;
  updatedAt: Date;


  name: string;
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  layout: string[];
  heroConfig: {
    title: string;
    subtitle: string;
  };
  sections: Array<{
    id: string;
    type: 'text' | 'image' | 'video' | 'button' | 'carousel' | 'countdown' | 'reviews';
    content: Record<string, any>;
    position: number;
    customCSS?: string; // Added for developer mode
    customHTML?: string; // Added for developer mode
  }>;
  assets?: Array<{ name: string; url: string }>; // Added for assets in templates
}

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: false },
    layout: { type: [String], default: [] },
    heroConfig: {
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
    },
    sections: [{
      id: { type: String, required: true },
      type: { type: String, enum: ['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews', 'products', 'testimonials', 'faq'], required: true },
      content: { type: Schema.Types.Mixed, default: {} },
      position: { type: Number, required: true },
      customCSS: { type: String, default: '' }, // New field for custom CSS
      customHTML: { type: String, default: '' }, // New field for custom HTML
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    templateId: {
      type: String,
      required: [true, 'Template ID is required'],
      unique: true,
      trim: true,
    },
    theme: {
      type: String,
      enum: {
        values: ['light', 'dark'],
        message: '{VALUE} is not a valid theme',
      },
      required: [true, 'Theme is required'],
    },
    font: {
      type: String,
      required: [true, 'Font is required'],
      trim: true,
    },
    colors: {
      primary: {
        type: String,
        required: [true, 'Primary color is required'],
        match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
      },
      secondary: {
        type: String,
        required: [true, 'Secondary color is required'],
        match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
      },
      background: {
        type: String,
        required: [true, 'Background color is required'],
        match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
      },
    },
    components: [
      {
        type: String,
        required: [true, 'Component is required'],
        trim: true,
      },
    ],
    testimonials: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        quote: { type: String, required: true, trim: true },
        rating: {
          type: Number,
          required: true,
          min: [1, 'Rating must be at least 1'],
          max: [5, 'Rating cannot exceed 5'],
        },
        image: { type: String, trim: true },
        _id: false,
      },
    ],
    backgroundImage: {
      type: String,
      required: [true, 'Background image is required'],
      trim: true,
    },
    assets: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
    }], // New field for assets

  },
  {
    timestamps: true,
  }
);


const Template = models.Template || model<ITemplate>('Template', templateSchema);
export default Template;