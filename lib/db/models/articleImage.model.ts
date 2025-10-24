import { Document, Model, model, models, Schema, Types } from 'mongoose'

export interface IArticleImageInput {
  articleId?: string
  imageUrl: string
  altText: string
  caption: string
  position: number
}

export interface IArticleImage extends Document, IArticleImageInput {
  _id: string
}

const articleImageSchema = new Schema<IArticleImage>(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: 'NewsArticle',
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: '',
    },
    position: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const ArticleImage =
  (models.ArticleImage as Model<IArticleImage>) ||
  model<IArticleImage>('ArticleImage', articleImageSchema)

export default ArticleImage