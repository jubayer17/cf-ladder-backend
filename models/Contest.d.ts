import mongoose, { Document } from 'mongoose';
export interface IProblem {
    contestId: number;
    index: string;
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
declare const _default: mongoose.Model<IContest, {}, {}, {}, mongoose.Document<unknown, {}, IContest, {}, mongoose.DefaultSchemaOptions> & IContest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any, IContest>;
export default _default;
//# sourceMappingURL=Contest.d.ts.map