// /lib/db/models/about.model.ts
import { Schema, model, models, Document } from 'mongoose';

export interface IAbout extends Document {
  intro: {
    title: string;
    description: string;
    integrationsDescription: string;
  };
  developers: Array<{
    name: string;
    role: string;
    email: string;
    image: string;
  }>;
  partners: Array<{
    name: string;
    email: string;
    image: string;
    slug: string;
  }>;
  team: Array<{
    name: string;
    role: string;
    image: string;
  }>;
  integrations: Array<{
    name: string;
    link: string;
    image?: string;
    text?: string;
  }>;
  contactInfo: {
    email: string;
    socialLinks: string[];
  };
}

const AboutSchema = new Schema<IAbout>(
  {
    intro: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      integrationsDescription: { type: String, required: true },
    },
    developers: [
      {
        name: { type: String, required: true },
        role: { type: String, required: true },
        email: { type: String, required: true },
        image: { type: String, required: true },
      },
    ],
    partners: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        image: { type: String, required: true },
        slug: { type: String, required: true },
      },
    ],
    team: [
      {
        name: { type: String, required: true },
        role: { type: String, required: true },
        image: { type: String, required: true },
      },
    ],
    integrations: [
      {
        name: { type: String, required: true },
        link: { type: String, required: true },
        image: { type: String },
        text: { type: String },
      },
    ],
    contactInfo: {
      email: { type: String, required: true },
      socialLinks: [{ type: String }],
    },
  },
  { timestamps: true }
);

// Check if model exists before compiling
const About = models.About || model<IAbout>('About', AboutSchema);
export default About;