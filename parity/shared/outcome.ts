// The result of calling a module function: what it returned, or what it threw.

export type ThrownError = { name: string; message: string }

export type Outcome = { output: unknown } | { error: ThrownError }

export type ModuleFunction = (...args: never[]) => unknown

export type ModuleTable = Record<string, Record<string, ModuleFunction>>

/** A value that JSON cannot carry exactly, found at `path`. */
export class UnrepresentableValue extends Error {
    constructor(readonly path: string, readonly reason: string) {
        super(`value at ${path} cannot be written as JSON exactly: ${reason}`)
        this.name = 'UnrepresentableValue'
    }
}

/**
 * Throws UnrepresentableValue when `value` holds something JSON.stringify would
 * drop or change silently (undefined, NaN, infinities, negative zero, functions,
 * bigints, symbols, class instances other than arrays and plain objects).
 */
export function assertRepresentable(value: unknown, path = '$'): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new UnrepresentableValue(path, `non-finite number ${value}`)
        if (Object.is(value, -0)) throw new UnrepresentableValue(path, 'negative zero')
        return
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertRepresentable(item, `${path}[${index}]`))
        return
    }
    if (typeof value === 'object') {
        const prototype = Object.getPrototypeOf(value)
        if (prototype !== Object.prototype && prototype !== null) {
            throw new UnrepresentableValue(path, `instance of ${prototype?.constructor?.name ?? 'unknown class'}`)
        }
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            assertRepresentable(item, `${path}.${key}`)
        }
        return
    }
    throw new UnrepresentableValue(path, typeof value)
}

function toThrownError(thrown: unknown): ThrownError {
    if (thrown instanceof Error) return { name: thrown.name, message: thrown.message }
    return { name: 'NonError', message: String(thrown) }
}

/**
 * Calls `fn(...input)` and captures its outcome. An output JSON cannot carry
 * exactly raises UnrepresentableValue: it is a defect of the case or of the
 * module's table, never an outcome.
 */
export function evaluate(fn: ModuleFunction, input: unknown[]): Outcome {
    let output: unknown
    try {
        output = (fn as (...args: unknown[]) => unknown)(...input)
    } catch (thrown) {
        return { error: toThrownError(thrown) }
    }
    assertRepresentable(output, '$.output')
    return { output }
}

/** Finds a function in the module table, or explains why it is missing. */
export function resolveFunction(table: ModuleTable, module: string, fnName: string): ModuleFunction {
    const functions = Object.hasOwn(table, module) ? table[module] : undefined
    if (!functions) throw new Error(`unknown module '${module}'`)
    const fn = Object.hasOwn(functions, fnName) ? functions[fnName] : undefined
    if (!fn) throw new Error(`unknown function '${fnName}' in module '${module}'`)
    return fn
}
