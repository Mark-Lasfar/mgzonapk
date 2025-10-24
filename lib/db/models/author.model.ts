import { Document, Model, model, models, Schema } from 'mongoose'

export interface IAuthorInput {
  userId: string
  name: string
  bio: string
  profileImageUrl: string
  socialLinks: Record<string, string>
}

export interface IAuthor extends Document, IAuthorInput {
  _id: string
}

const authorSchema = new Schema<IAuthor>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      required: true,
    },
    profileImageUrl: {
      type: String,
      default: 'https://mark-elasfar.web.app/assets/img/default-avatar.png',
    },
    socialLinks: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

const Author =
  (models.Author as Model<IAuthor>) ||
  model<IAuthor>('Author', authorSchema)

export default Author