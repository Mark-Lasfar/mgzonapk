import mongoose, { Schema, Document } from 'mongoose';

interface IScore extends Document {
  user: mongoose.Types.ObjectId;
  score: number;
  date: Date;
}

const ScoreSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

ScoreSchema.index({ score: -1 });
ScoreSchema.index({ user: 1 });

export default mongoose.models.Score || mongoose.model<IScore>('Score', ScoreSchema);