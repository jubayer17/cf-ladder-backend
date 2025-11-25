import mongoose from 'mongoose';
type Cached = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};
declare global {
    var _mongooseCache: Cached | undefined;
}
export default function connectDB(): Promise<void>;
export {};
//# sourceMappingURL=database.d.ts.map