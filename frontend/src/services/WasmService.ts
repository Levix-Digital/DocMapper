import { instantiate } from "@assemblyscript/loader";

interface WasmModule {
    processDocument(docType: number, content: number): number;
    memory: WebAssembly.Memory;
    __newString(str: string): number;
    __getString(ptr: number): string;
    __pin(ptr: number): number;
    __unpin(ptr: number): void;
    __collect(): void;
    [key: string]: unknown;
}

export class WasmService {
    private static instance: WasmService;
    private module: WasmModule | null = null;
    private loadingPromise: Promise<void> | null = null;

    private constructor() { }

    public static getInstance(): WasmService {
        if (!WasmService.instance) {
            WasmService.instance = new WasmService();
        }
        return WasmService.instance;
    }

    public async init(): Promise<void> {
        if (this.module) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                // Load from the public URL (Vite serves it) or imported URL
                // We use ?url to get the asset path
                const wasmUrl = new URL('../modules/core-wasm/build/release.wasm', import.meta.url).href;

                const response = await fetch(wasmUrl);
                const result = await instantiate<WasmModule>(response, {
                    env: {
                        abort: (_msg: number, _file: number, line: number, column: number) => {
                            console.error(`WASM Abort at ${line}:${column}`);
                        }
                    }
                });

                this.module = result.exports;
                console.log("WASM Module Loaded Successfully");
            } catch (e) {
                console.error("Critical: Failed to load WASM module", e);
                // Implementation of EC-001 (Critical Failure)
                throw new Error("Security Module Missing");
            }
        })();

        return this.loadingPromise;
    }

    public async process(docType: string, content: string): Promise<string> {
        await this.init();

        if (!this.module) {
            throw new Error("WASM Engine not ready");
        }

        // 1. Lift strings to WASM memory
        const ptrDocType = this.module.__newString(docType);
        const ptrContent = this.module.__newString(content);

        // Pin them so Garbage Collector doesn't eat them during execution
        this.module.__pin(ptrDocType);
        this.module.__pin(ptrContent);

        try {
            // 2. Execute
            const ptrResult = this.module.processDocument(ptrDocType, ptrContent);

            // 3. Read result back
            const result = this.module.__getString(ptrResult);
            return result;
        } finally {
            // 4. Clean up input memory
            this.module.__unpin(ptrDocType);
            this.module.__unpin(ptrContent);
            // Optionally trigger collection if needed, but AS GC is usually auto or manual
        }
    }
}
