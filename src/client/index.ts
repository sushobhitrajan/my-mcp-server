/**
 * 🤖 MCP Client — powered by Google Gemini
 *
 * This is a full MCP CLIENT that:
 *  1. Spawns your MCP server as a child process
 *  2. Asks it: "what tools do you have?"
 *  3. Converts those tools into Gemini function declarations
 *  4. Accepts a message from you in the terminal
 *  5. Sends it to Gemini 2.0 Flash with the tool definitions
 *  6. If Gemini wants to call a tool → calls your MCP server
 *  7. Sends the tool result back to Gemini
 *  8. Gemini produces a final answer → prints it
 *  9. Loops — you can keep chatting!
 *
 * ─── Key Concepts ────────────────────────────────────────────────────────────
 *
 *  Function Calling: Gemini can say "I want to call calculator with these args"
 *  instead of making up an answer. Your client intercepts that, runs the tool
 *  on the MCP server, and feeds the real result back to Gemini.
 *
 *  The "agentic loop": model → tool call → result → model → tool call → ...
 *  This continues until the model returns a plain text response.
 */

import "dotenv/config";
import * as readline from "readline";
import { GoogleGenerativeAI, Tool, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";

// ── Validate API key ───────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    console.error(
        "❌  GEMINI_API_KEY is not set!\n" +
        "    1. Go to https://aistudio.google.com/app/apikey\n" +
        "    2. Create a free API key\n" +
        "    3. Paste it into your .env file:\n" +
        "       GEMINI_API_KEY=your_actual_key_here\n"
    );
    process.exit(1);
}

// ── Helper: convert MCP JSON Schema → Gemini SchemaType ───────────────────────
function toGeminiSchemaType(type: string): SchemaType {
    const map: Record<string, SchemaType> = {
        string: SchemaType.STRING,
        number: SchemaType.NUMBER,
        integer: SchemaType.INTEGER,
        boolean: SchemaType.BOOLEAN,
        array: SchemaType.ARRAY,
        object: SchemaType.OBJECT,
    };
    return map[type] ?? SchemaType.STRING;
}

// ── Helper: convert an MCP tool → Gemini FunctionDeclaration ──────────────────
function mcpToolToGeminiFn(tool: McpTool): FunctionDeclaration {
    const schema = tool.inputSchema as {
        properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
        required?: string[];
    };

    const parameters: Record<string, unknown> = {
        type: SchemaType.OBJECT,
        properties: {} as Record<string, unknown>,
        required: schema.required ?? [],
    };

    if (schema.properties) {
        for (const [key, val] of Object.entries(schema.properties)) {
            (parameters.properties as Record<string, unknown>)[key] = {
                type: toGeminiSchemaType(val.type),
                description: val.description ?? "",
                ...(val.enum ? { enum: val.enum } : {}),
            };
        }
    }

    return {
        name: tool.name,
        description: tool.description ?? "",
        parameters: parameters as unknown as FunctionDeclaration["parameters"],
    };
}

// ── Main: connect, chat, loop ──────────────────────────────────────────────────
async function main() {
    console.log("🚀 Connecting to MCP server...");

    // 1. Create an MCP Client and connect to your server via stdio
    const mcpClient = new Client({ name: "gemini-mcp-client", version: "1.0.0" });

    const transport = new StdioClientTransport({
        command: "tsx",          // runs your TypeScript server directly
        args: ["src/index.ts"],  // your MCP server entry point
    });

    await mcpClient.connect(transport);
    console.log("✅ Connected to MCP server\n");

    // 2. Ask the MCP server what tools it has
    const { tools: mcpTools } = await mcpClient.listTools();
    console.log(`🔧 Available tools: ${mcpTools.map((t) => t.name).join(", ")}\n`);

    // 3. Convert MCP tools → Gemini function declarations
    const geminiTools: Tool[] = [
        {
            functionDeclarations: mcpTools.map(mcpToolToGeminiFn),
        },
    ];

    // 4. Set up Gemini and dynamically detect model
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY as string);
    let modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    
    if (!process.env.GEMINI_MODEL) {
        try {
            console.log("🔍 Auto-detecting latest Gemini Flash model...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
            const data = await response.json();
            if (data.models) {
                const flashModels = data.models
                    .map((m: any) => m.name.replace("models/", ""))
                    .filter((name: string) => name.includes("flash") && !name.includes("preview") && !name.includes("lite"))
                    .sort((a: string, b: string) => b.localeCompare(a));
                
                if (flashModels.length > 0) {
                    modelName = flashModels[0];
                    console.log(`✨ Using dynamic model: ${modelName}\n`);
                }
            }
        } catch (err) {
            console.log("⚠️ Failed to auto-detect model, using default.\n");
        }
    }

    const model = genAI.getGenerativeModel({
        model: modelName,
        tools: geminiTools,
    });

    // Start a persistent chat session
    const chat = model.startChat();

    // 5. Terminal chat loop
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log("💬 Chat with Gemini (it will use your MCP tools automatically)");
    console.log('   Type "exit" to quit\n');
    console.log("─".repeat(60));

    const askQuestion = () => {
        rl.question("\nYou: ", async (userInput) => {
            if (userInput.trim().toLowerCase() === "exit") {
                console.log("\n👋 Goodbye!");
                await mcpClient.close();
                rl.close();
                return;
            }

            if (!userInput.trim()) {
                askQuestion();
                return;
            }

            try {
                // 6. Send user message to Gemini
                let response = await chat.sendMessage(userInput);
                let candidate = response.response;

                // 7. Agentic loop — keep going while Gemini wants to call tools
                while (true) {
                    const functionCalls = candidate.functionCalls();

                    if (!functionCalls || functionCalls.length === 0) {
                        // No more tool calls — print the final text response
                        const text = candidate.text();
                        console.log(`\n🤖 Gemini: ${text}`);
                        break;
                    }

                    // Process each tool call Gemini requested
                    const toolResults = [];

                    for (const call of functionCalls) {
                        console.log(`\n⚙️  Calling tool: ${call.name}(${JSON.stringify(call.args)})`);

                        // 8. Call the tool on your MCP server
                        const toolResult = await mcpClient.callTool({
                            name: call.name,
                            arguments: call.args as Record<string, unknown>,
                        });

                        const resultText =
                            (toolResult.content as Array<{ type: string; text: string }>)
                                .filter((c) => c.type === "text")
                                .map((c) => c.text)
                                .join("\n");

                        console.log(`   ✅ Result: ${resultText}`);

                        toolResults.push({
                            functionResponse: {
                                name: call.name,
                                response: { result: resultText },
                            },
                        });
                    }

                    // 9. Send tool results back to Gemini for the next step
                    response = await chat.sendMessage(toolResults);
                    candidate = response.response;
                }
            } catch (err) {
                console.error(`\n❌ Error: ${err instanceof Error ? err.message : err}`);
            }

            askQuestion(); // loop back for next user message
        });
    };

    askQuestion();
}

main().catch((err) => {
    console.error("❌ Fatal:", err);
    process.exit(1);
});
