/**
 * 💬 PROMPTS: reusable message templates
 *
 * MCP Prompts are pre-built message templates that users/clients
 * can invoke. They're like "slash commands" for your AI.
 *
 * Think of them as system prompts with slots you can fill in.
 *
 * Key concepts shown here:
 *  - Prompt arguments (optional and required)
 *  - Returning role-based messages (user/assistant)
 *  - Combining static instructions with dynamic content
 */

import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// ── Prompt 1: code-review ─────────────────────────────────────────────────────
export const codeReviewPromptDef = {
    name: "code-review",
    description:
        "Generate a structured code review prompt for a given language and code snippet.",
    arguments: [
        {
            name: "language",
            description: "Programming language (e.g. TypeScript, Python, Go)",
            required: true,
        },
        {
            name: "focus",
            description:
                "Review focus area: security | performance | readability | all",
            required: false,
        },
    ],
};

const CodeReviewArgsSchema = z.object({
    language: z.string().min(1),
    focus: z
        .enum(["security", "performance", "readability", "all"])
        .default("all"),
});

export function handleCodeReviewPrompt(args: Record<string, string>) {
    const parsed = CodeReviewArgsSchema.safeParse(args);
    if (!parsed.success) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid prompt arguments: ${parsed.error.message}`
        );
    }

    const { language, focus } = parsed.data;

    const focusInstructions =
        focus === "all"
            ? "- Check for bugs and logical errors\n- Evaluate security vulnerabilities\n- Assess performance implications\n- Review code readability and style"
            : focus === "security"
                ? "- Identify injection vulnerabilities\n- Check for improper authentication/authorization\n- Look for data exposure risks\n- Assess input validation"
                : focus === "performance"
                    ? "- Identify bottlenecks and O(n²) or worse algorithms\n- Check for unnecessary re-renders or recomputations\n- Assess memory usage patterns\n- Look for missing caching opportunities"
                    : "- Evaluate variable and function naming\n- Check for code duplication (DRY principle)\n- Assess modularity and single responsibility\n- Review comments and documentation";

    return {
        messages: [
            {
                role: "user" as const,
                content: {
                    type: "text" as const,
                    text: `You are an expert ${language} code reviewer. Please review the code I provide with a focus on ${focus}.

For your review, please:
${focusInstructions}

Structure your response as:
1. **Summary** — overall assessment (1-2 sentences)
2. **Issues Found** — list each issue with severity (🔴 critical / 🟡 warning / 🟢 suggestion)
3. **Code Examples** — show fixed code where applicable
4. **Positive Highlights** — what's done well

Please wait for me to share the code.`,
                },
            },
        ],
    };
}

// ── Prompt 2: explain-concept ─────────────────────────────────────────────────
export const explainConceptPromptDef = {
    name: "explain-concept",
    description:
        "Generate a prompt asking the AI to explain a technical concept at a specific level.",
    arguments: [
        {
            name: "concept",
            description: "The technical concept to explain (e.g. 'MCP Resources')",
            required: true,
        },
        {
            name: "level",
            description: "Explanation level: beginner | intermediate | expert",
            required: false,
        },
    ],
};

const ExplainConceptArgsSchema = z.object({
    concept: z.string().min(1),
    level: z.enum(["beginner", "intermediate", "expert"]).default("beginner"),
});

export function handleExplainConceptPrompt(args: Record<string, string>) {
    const parsed = ExplainConceptArgsSchema.safeParse(args);
    if (!parsed.success) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid prompt arguments: ${parsed.error.message}`
        );
    }

    const { concept, level } = parsed.data;

    const audienceDesc =
        level === "beginner"
            ? "someone completely new to programming"
            : level === "intermediate"
                ? "a developer with 1-3 years of experience"
                : "a senior engineer";

    return {
        messages: [
            {
                role: "user" as const,
                content: {
                    type: "text" as const,
                    text: `Explain "${concept}" to ${audienceDesc}.

Your explanation should:
${level === "beginner"
                            ? "- Use simple analogies from everyday life\n- Avoid jargon (or define it when necessary)\n- Include a simple code example if applicable\n- Keep it under 300 words"
                            : level === "intermediate"
                                ? "- Connect it to concepts the reader likely already knows\n- Include a practical code example\n- Mention common pitfalls\n- Around 400 words"
                                : "- Dive into implementation details and trade-offs\n- Compare with alternative approaches\n- Discuss edge cases and performance implications\n- Include advanced usage patterns"
                        }`,
                },
            },
        ],
    };
}
