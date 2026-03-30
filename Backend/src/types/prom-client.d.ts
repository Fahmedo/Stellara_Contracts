declare module 'prom-client' {
    export class Gauge<T extends string = string> {
        constructor(config: { name: string; help: string; labelNames?: T[] });
        set (labels: Partial<Record<T, string>>, value: number): void;
        set (value: number): void;
        reset (): void;
    }

    export class Counter<T extends string = string> {
        constructor(config: { name: string; help: string; labelNames?: T[] });
        inc (labels: Partial<Record<T, string>>, value?: number): void;
        inc (value?: number): void;
        reset (): void;
    }

    export class Histogram<T extends string = string> {
        constructor(config: { name: string; help: string; labelNames?: T[]; buckets?: number[] });
        observe (labels: Partial<Record<T, string>>, value: number): void;
        observe (value: number): void;
        reset (): void;
    }

    export const register: {
        getSingleMetric (name: string): Gauge<string> | Counter<string> | Histogram<string> | undefined;
        registerMetric (metric: unknown): void;
        clear (): void;
    };
}