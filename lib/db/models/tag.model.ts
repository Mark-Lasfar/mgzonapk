import { Document, Model, model, models, Schema } from 'mongoose'

export interface ITagInput {
  name: string
  slug: string
}

export interface ITag extends Document, ITagInput {
  _id: string
}

const tagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
)

const Tag =
  (models.Tag as Model<ITag>) ||
  model<ITag>('Tag', tagSchema)

export default Tag