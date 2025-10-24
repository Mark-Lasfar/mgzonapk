import { Document, Model, model, models, Schema } from 'mongoose'

export interface ICategoryInput {
  name: string
  slug: string
  description: string
}

export interface ICategory extends Document, ICategoryInput {
  _id: string
}

const categorySchema = new Schema<ICategory>(
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
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const Category =
  (models.Category as Model<ICategory>) ||
  model<ICategory>('Category', categorySchema)

export default Category