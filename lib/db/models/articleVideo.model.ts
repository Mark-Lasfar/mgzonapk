import { Document, Model, model, models, Schema, Types } from 'mongoose'

export interface IArticleVideoInput {
  articleId?: string
  videoUrl: string
  caption: string
  position: number
}

export interface IArticleVideo extends Document, IArticleVideoInput {
  _id: string
}

const articleVideoSchema = new Schema<IArticleVideo>(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: 'NewsArticle',
      required: true,
    },
    videoUrl: {
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

const ArticleVideo =
  (models.ArticleVideo as Model<IArticleVideo>) ||
  model<IArticleVideo>('ArticleVideo', articleVideoSchema)

export default ArticleVideo