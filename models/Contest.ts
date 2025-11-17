import mongoose, { Schema, Document } from 'mongoose';

export interface IProblem {
    contestId: number;
    index: string; // A, B, C, etc.
    name: string;
    type: string;
    rating?: number;
    tags: string[];
    points?: number;
    solvedCount?: number;
}

export interface IContest extends Document {
    id: number;
    name: string;
    type: string;
    phase: string;
    frozen: boolean;
    durationSeconds: number;
    startTimeSeconds: number;
    relativeTimeSeconds?: number;
    problems: IProblem[];
    preparedBy?: string;
    websiteUrl?: string;
    description?: string;
    difficulty?: number;
    kind?: string;
    icpcRegion?: string;
    country?: string;
    city?: string;
    season?: string;
    lastSynced: Date;
}

const ProblemSchema = new Schema<IProblem>({
    contestId: { type: Number, required: true },
    index: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    rating: { type: Number },
    tags: [{ type: String }],
    points: { type: Number },
    solvedCount: { type: Number }
}, { _id: false });

const ContestSchema = new Schema<IContest>({
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    phase: { type: String, required: true, index: true },
    frozen: { type: Boolean, default: false },
    durationSeconds: { type: Number, required: true },
    startTimeSeconds: { type: Number, required: true, index: true },
    relativeTimeSeconds: { type: Number },
    problems: [ProblemSchema],
    preparedBy: { type: String },
    websiteUrl: { type: String },
    description: { type: String },
    difficulty: { type: Number },
    kind: { type: String },
    icpcRegion: { type: String },
    country: { type: String },
    city: { type: String },
    season: { type: String },
    lastSynced: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Index for faster queries
ContestSchema.index({ startTimeSeconds: -1 });
ContestSchema.index({ phase: 1, startTimeSeconds: -1 });

export default mongoose.model<IContest>('Contest', ContestSchema);
