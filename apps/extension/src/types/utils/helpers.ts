/**
 * Utility types for common patterns
 */

// Make specific properties optional
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific properties required
export type RequiredKeys<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Deep partial
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Prettify complex types for better IntelliSense
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

// Extract promise type
export type Awaited<T> = T extends Promise<infer U> ? U : T;

// Function type helpers
export type AsyncFunction<Args extends any[] = any[], Return = any> = (
    ...args: Args
) => Promise<Return>;

export type SyncFunction<Args extends any[] = any[], Return = any> = (
    ...args: Args
) => Return;

// Array element type
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

// Object value types
export type ValueOf<T> = T[keyof T];

// Non-nullable
export type NonNullable<T> = Exclude<T, null | undefined>;

// JSON types
export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// Branded/Nominal types helper
export type Brand<T, B> = T & { __brand: B };

// Mutable (remove readonly)
export type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};

// At least one property required
export type AtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>> &
    {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
    }[Keys];

// Exactly one property required
export type ExactlyOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>> &
    {
        [K in Keys]: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
    }[Keys];

// Conditional types
export type If<Condition extends boolean, Then, Else> = Condition extends true ? Then : Else;

// String manipulation types
export type Lowercase<S extends string> = S extends `${infer First}${infer Rest}`
    ? `${Lowercase<First>}${Rest}`
    : S;

export type Uppercase<S extends string> = S extends `${infer First}${infer Rest}`
    ? `${Uppercase<First>}${Rest}`
    : S;

// Omit by type
export type OmitByType<T, ValueType> = {
    [Key in keyof T as T[Key] extends ValueType ? never : Key]: T[Key];
};

// Pick by type
export type PickByType<T, ValueType> = {
    [Key in keyof T as T[Key] extends ValueType ? Key : never]: T[Key];
};
