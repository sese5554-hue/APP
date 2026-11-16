import type { EXPAND_SYMBOL } from './index.js';
export type Raw = {
    toSqlString(): string;
};
export type Expand = {
    readonly [EXPAND_SYMBOL]: true;
    readonly value: Record<string, SqlValue> | Map<string, SqlValue>;
};
/** Avoids the global `Temporal` namespace so consumers don't need TS's ESNext.Temporal lib. */
export type TemporalValue = {
    readonly [Symbol.toStringTag]: `Temporal.${string}`;
    readonly epochMilliseconds?: number;
    toString(): string;
};
export type SqlValue = string | number | bigint | boolean | Date | TemporalValue | Buffer | Uint8Array | Raw | Expand | Record<string, unknown> | SqlValue[] | Set<SqlValue> | Map<string, SqlValue> | null | undefined;
export type Timezone = 'local' | 'Z' | (string & NonNullable<unknown>);
export type SqlMode = {
    /** The server runs with the `ANSI_QUOTES` SQL mode: double quotes delimit identifiers, not strings. */
    ansiQuotes?: boolean;
};
