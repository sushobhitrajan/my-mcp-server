/**
 * 🚀 My Learning MCP Server — Main Entry Point
 *
 * This is the entry point for our MCP server. Here we:
 *  1. Create the MCP Server instance
 *  2. Register all request handlers (tools, resources, prompts)
 *  3. Connect via stdio transport (used by Claude Desktop and most local hosts)
 *
 * ─── MCP Primitives Overview ────────────────────────────────────────────────
 *
 *  🔧 TOOLS     — Actions the AI can execute (like API calls, computations)
 *                 Triggered by: tools/call
 *
 *  📄 RESOURCES — Data the AI can read (like files, database records)
 *                 Triggered by: resources/list, resources/read
 *
 *  💬 PROMPTS   — Reusable message templates (like slash commands)
 *                 Triggered by: prompts/list, prompts/get
 *
 * ─── Transport ──────────────────────────────────────────────────────────────
 *
 *  We use stdio transport here, which means:
 *  - The client (Claude Desktop, Inspector, etc.) spawns THIS process
 *  - Communication happens via stdin/stdout
 *  - ALL logging MUST go to stderr (never stdout!) to avoid corrupting the protocol
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    McpError,
    ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

// Tools
import { calculatorToolDefinition, handleCalculator } from "./tools/calculator.js";
import { weatherToolDefinition, handleGetWeather } from "./tools/weather.js";

// Resources
import { getNotesResourceList, readNoteResource } from "./resources/notes.js";

// Prompts
import {
    codeReviewPromptDef,
    handleCodeReviewPrompt,
    explainConceptPromptDef,
    handleExplainConceptPrompt,
} from "./prompts/templates.js";

// ── 1. Create the MCP Server ──────────────────────────────────────────────────
const server = new Server(
    {
        name: "my-mcp-server",        // Identifies your server to clients
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},       // Advertise that we support tools
            resources: {},   // Advertise that we support resources
            prompts: {},     // Advertise that we support prompts
        },
    }
);

// ── 2A. Register Tool Handlers ────────────────────────────────────────────────

// tools/list — returns the list of available tools to the client
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            calculatorToolDefinition,
            weatherToolDefinition,
        ],
    };
});

// tools/call — executes a specific tool by name
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Log to stderr — NEVER to stdout in a stdio server!
    process.stderr.write(`[tool:call] name=${name}\n`);

    switch (name) {
        case "calculator":
            return handleCalculator(args);

        case "get_weather":
            return await handleGetWeather(args);

        default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
});

// ── 2B. Register Resource Handlers ───────────────────────────────────────────

// resources/list — returns enumerable resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            // Static "all notes" resource
            {
                uri: "notes://all",
                name: "All Notes",
                description: "A summary list of all learning notes",
                mimeType: "text/plain",
            },
            // Dynamic per-note resources
            ...getNotesResourceList(),
        ],
    };
});

// resources/read — reads the content of a specific resource by URI
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    process.stderr.write(`[resource:read] uri=${uri}\n`);

    if (uri.startsWith("notes://")) {
        return readNoteResource(uri);
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
});

// ── 2C. Register Prompt Handlers ─────────────────────────────────────────────

// prompts/list — returns available prompt templates
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [codeReviewPromptDef, explainConceptPromptDef],
    };
});

// prompts/get — instantiates a prompt with arguments
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    process.stderr.write(`[prompt:get] name=${name}\n`);

    switch (name) {
        case "code-review":
            return handleCodeReviewPrompt(args as Record<string, string>);

        case "explain-concept":
            return handleExplainConceptPrompt(args as Record<string, string>);

        default:
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown prompt: ${name}`
            );
    }
});

// ── 3. Connect Transport & Start Server ───────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Must use stderr for logging in stdio servers
    process.stderr.write("✅ My MCP Server is running via stdio\n");
    process.stderr.write("   Tools     : calculator, get_weather\n");
    process.stderr.write("   Resources : notes://all, notes://1, notes://2, notes://3\n");
    process.stderr.write("   Prompts   : code-review, explain-concept\n");
}

main().catch((error) => {
    process.stderr.write(`❌ Fatal error: ${error}\n`);
    process.exit(1);
});
