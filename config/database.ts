// config/database.ts
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    throw new Error('❌ MONGODB_URI is not set in environment variables');
}

// Use a global cache so serverless cold-starts reuse connections when possible
type Cached = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

declare global {
    // eslint-disable-next-line no-var
    var _mongooseCache: Cached | undefined;
}

const globalRef: any = globalThis as any;
if (!globalRef._mongooseCache) {
    globalRef._mongooseCache = { conn: null, promise: null } as Cached;
}

const options = {
    // tuned for serverless reuse; keep pools small
    // Mongoose type-safety: any used to avoid TS complaining on options in some versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

export default async function connectDB(): Promise<void> {
    if (globalRef._mongooseCache.conn) {
        // already connected
        return;
    }

    if (!globalRef._mongooseCache.promise) {
        // disable mongoose buffering (so ops error fast if disconnected)
        mongoose.set('bufferCommands', false);
        mongoose.set('strictQuery', false);

        globalRef._mongooseCache.promise = mongoose
            .connect(MONGO_URI!, {
                // keep pool size small for serverless
                maxPoolSize: 5,
                minPoolSize: 1,
                serverSelectionTimeoutMS: 10000, // 10s
                socketTimeoutMS: 45000,
                // retryWrites true is common in Atlas URIs; included here if not in URI
                // other options can be merged via URI query params
            })
            .then((mongooseInstance) => {
                globalRef._mongooseCache.conn = mongooseInstance;
                console.log('✅ MongoDB (mongoose) connected');
                return mongooseInstance;
            })
            .catch((err: any) => {
                // reset promise so next invocation can retry
                globalRef._mongooseCache.promise = null;
                console.error('❌ MongoDB connect failed:', err?.message ?? err);
                throw err;
            });
    }

    await globalRef._mongooseCache.promise;
}
