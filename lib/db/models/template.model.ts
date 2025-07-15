import { Schema, model, models, Document } from 'mongoose';

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
  layout: {
    header: string;
    footer: string;
    main: string[];
  };
  testimonials: {
    id: string;
    name: string;
    quote: string;
    rating: number;
    image?: string;
  }[];
  backgroundImage: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
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
    layout: {
      header: {
        type: String,
        required: [true, 'Header layout is required'],
        trim: true,
      },
      footer: {
        type: String,
        required: [true, 'Footer layout is required'],
        trim: true,
      },
      main: [
        {
          type: String,
          required: [true, 'Main layout component is required'],
          trim: true,
        },
      ],
    },
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
    createdBy: {
      type: String,
      required: [true, 'Created by is required'],
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Template = models.Template || model<ITemplate>('Template', templateSchema);
export default Template;