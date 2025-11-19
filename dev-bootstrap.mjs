// Dev bootstrap: register handlers, then programmatically load ts-node ESM and server
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:');
    if (err && err.stack) console.error(err.stack);
    else console.error(err);
    if (err && typeof err === 'object' && !('stack' in err)) {
        try { console.error('Thrown object details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2)); } catch {}
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:');
    if (reason && reason.stack) console.error(reason.stack);
    else console.error(reason);
    if (reason && typeof reason === 'object' && !('stack' in reason)) {
        try { console.error('Rejection object details:', JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2)); } catch {}
    }
    process.exit(1);
});

(async () => {
    try {
        // Load ts-node ESM runtime programmatically
        const tsnode = await import('ts-node/esm');
        if (tsnode && typeof tsnode.register === 'function') {
            tsnode.register({});
        }
        // Now import the server (TypeScript ESM entry)
        await import('./server.ts');
    } catch (err) {
        console.error('Bootstrap load error:');
        if (err && err.stack) console.error(err.stack);
        else console.error(err);
        if (err && typeof err === 'object' && !('stack' in err)) {
            try { console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2)); } catch {}
        }
        process.exit(1);
    }
})();
