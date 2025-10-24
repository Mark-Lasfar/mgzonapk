import { Document, Model, model, models, Schema, Types } from 'mongoose'

export interface IArticleTagInput {
  articleId?: string
  tagId?: string
}

export interface IArticleTag extends Document, IArticleTagInput {
  _id: string
}

const articleTagSchema = new Schema<IArticleTag>(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: 'NewsArticle',
      required: true,
    },
    tagId: {
      type: Schema.Types.ObjectId,
      ref: 'Tag',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const ArticleTag =
  (models.ArticleTag as Model<IArticleTag>) ||
  model<IArticleTag>('ArticleTag', articleTagSchema)

export default ArticleTag