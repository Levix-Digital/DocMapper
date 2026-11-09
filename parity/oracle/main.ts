// Parity oracle: newline-delimited JSON requests on stdin, one response line
// per request on stdout, in order. Exits when stdin closes.

import { createInterface } from 'node:readline'
import { handleRequest } from './handler'
import { MODULES } from './modules'

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })

lines.on('line', (line) => {
    if (line.trim() === '') return
    process.stdout.write(`${JSON.stringify(handleRequest(line, MODULES))}\n`)
})
