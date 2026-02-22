/**
 * 🔧 TOOL: calculator
 *
 * MCP Tools are like function calls — the AI sends structured input,
 * your server runs logic, and returns a result. Think of them as
 * "actions" the AI can take.
 *
 * Key concepts shown here:
 *  - Zod schema for input validation
 *  - Returning text content to the AI
 *  - Error handling inside a tool
 */

import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// ── Input schema (validated using Zod) ────────────────────────────────────────
export const CalculatorInputSchema = z.object({
    operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("The arithmetic operation to perform"),
    a: z.number().describe("The first number"),
    b: z.number().describe("The second number"),
});

export type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

// ── Tool definition (what the AI sees) ────────────────────────────────────────
export const calculatorToolDefinition = {
    name: "calculator",
    description:
        "Perform basic arithmetic operations: add, subtract, multiply, or divide two numbers.",
    inputSchema: {
        type: "object" as const,
        properties: {
            operation: {
                type: "string",
                enum: ["add", "subtract", "multiply", "divide"],
                description: "The arithmetic operation to perform",
            },
            a: { type: "number", description: "The first number" },
            b: { type: "number", description: "The second number" },
        },
        required: ["operation", "a", "b"],
    },
};

// ── Tool handler (your actual logic) ──────────────────────────────────────────
export function handleCalculator(args: unknown) {
    // Always validate inputs — never trust untyped data!
    const parsed = CalculatorInputSchema.safeParse(args);
    if (!parsed.success) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid input: ${parsed.error.message}`
        );
    }

    const { operation, a, b } = parsed.data;

    let result: number;

    switch (operation) {
        case "add":
            result = a + b;
            break;
        case "subtract":
            result = a - b;
            break;
        case "multiply":
            result = a * b;
            break;
        case "divide":
            if (b === 0) {
                throw new McpError(ErrorCode.InvalidParams, "Cannot divide by zero");
            }
            result = a / b;
            break;
    }

    // Tools return an array of content items
    return {
        content: [
            {
                type: "text" as const,
                text: `${a} ${operation} ${b} = ${result}`,
            },
        ],
    };
}
