/**
 * 📄 RESOURCE: notes
 *
 * MCP Resources are like "files" or "documents" the AI can READ.
 * They're different from tools — resources are for READING data,
 * not executing actions.
 *
 * Resources have a URI scheme (like a URL) that identifies them.
 * Examples:
 *   notes://all           → list all notes
 *   notes://1             → read note with ID 1
 *
 * Key concepts shown here:
 *  - Resource URI templates
 *  - Static vs dynamic resource listing
 *  - Returning text content from a resource
 */

// ── In-memory notes store (simulates a database) ──────────────────────────────
interface Note {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    tags: string[];
}

// Seed data — in a real server this would come from a DB or filesystem
export const notesStore: Note[] = [
    {
        id: 1,
        title: "What is MCP?",
        content: `Model Context Protocol (MCP) is an open standard by Anthropic.
It lets LLMs connect to external data sources and tools in a structured way.

Key primitives:
- Tools: actions the AI can take (like function calls)
- Resources: data the AI can read (like files/documents)
- Prompts: reusable message templates`,
        createdAt: "2025-01-01T10:00:00Z",
        tags: ["mcp", "learning"],
    },
    {
        id: 2,
        title: "MCP Transport Types",
        content: `MCP supports two main transports:

1. stdio — standard input/output
   - Best for local tools run as subprocesses (e.g. Claude Desktop)
   - Simple, no networking needed

2. Streamable HTTP — HTTP with streaming
   - Best for networked/cloud deployments
   - Supports multiple concurrent clients`,
        createdAt: "2025-01-02T12:00:00Z",
        tags: ["mcp", "transport"],
    },
    {
        id: 3,
        title: "Why use Zod for validation?",
        content: `Zod is a TypeScript-first schema validation library.

In MCP servers, you should ALWAYS validate tool inputs because:
1. The AI might send unexpected data types
2. Malformed inputs could crash your server
3. Good error messages help the AI self-correct

Example:
  const schema = z.object({ name: z.string(), age: z.number().min(0) });
  const result = schema.safeParse(input); // never throws`,
        createdAt: "2025-01-03T09:00:00Z",
        tags: ["typescript", "zod", "validation"],
    },
];

// ── Resource list entries (what the AI sees when it lists resources) ──────────
export function getNotesResourceList() {
    return notesStore.map((note) => ({
        uri: `notes://${note.id}`,
        name: note.title,
        description: `Note #${note.id} — tags: ${note.tags.join(", ")}`,
        mimeType: "text/plain",
    }));
}

// ── Resource reader ────────────────────────────────────────────────────────────
export function readNoteResource(uri: string) {
    // notes://all → return a summary list
    if (uri === "notes://all") {
        const summary = notesStore
            .map(
                (n) =>
                    `[${n.id}] ${n.title}\n    Tags: ${n.tags.join(", ")}\n    Created: ${n.createdAt}`
            )
            .join("\n\n");

        return {
            contents: [
                {
                    uri,
                    mimeType: "text/plain",
                    text: `📝 All Notes (${notesStore.length} total)\n\n${summary}`,
                },
            ],
        };
    }

    // notes://<id> → return single note content
    const match = uri.match(/^notes:\/\/(\d+)$/);
    if (match) {
        const id = parseInt(match[1], 10);
        const note = notesStore.find((n) => n.id === id);

        if (!note) {
            throw new Error(`Note with ID ${id} not found`);
        }

        return {
            contents: [
                {
                    uri,
                    mimeType: "text/plain",
                    text: `📝 ${note.title}\nCreated: ${note.createdAt}\nTags: ${note.tags.join(", ")}\n\n${note.content}`,
                },
            ],
        };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
}
