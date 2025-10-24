// /lib/db/models/blog.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import validator from 'validator';

interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  category: string;
  tags: string[];
  image?: string;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metrics: {
    views: number;
    likes: number;
    commentsCount: number;
  };
}

const BlogSchema: Schema<IBlog> = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[a-z0-9-]+$/.test(v),
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      },
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      minlength: [50, 'Content must be at least 50 characters'],
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    authorName: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }),
        message: 'Invalid image URL',
      },
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    metrics: {
      views: { type: Number, default: 0, min: 0 },
      likes: { type: Number, default: 0, min: 0 },
      commentsCount: { type: Number, default: 0, min: 0 },
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

BlogSchema.index({ slug: 1 }, { unique: true });
BlogSchema.index({ authorId: 1, isPublished: 1 });

const Blog = mongoose.models.Blog || mongoose.model<IBlog>('Blog', BlogSchema);
export default Blog;