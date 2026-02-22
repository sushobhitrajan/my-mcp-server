/**
 * 🔧 TOOL: get_weather
 *
 * This tool shows:
 *  - How to handle async operations (e.g., calling an external API)
 *  - How to return structured JSON data inside a text response
 *  - Using a mock/simulation when no real API key is available
 *
 * In a real project you'd call: https://api.open-meteo.com (free, no key needed)
 * or OpenWeatherMap, WeatherAPI, etc.
 */

import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// ── Input schema ───────────────────────────────────────────────────────────────
export const WeatherInputSchema = z.object({
    city: z.string().min(1).describe("Name of the city to get weather for"),
    unit: z
        .enum(["celsius", "fahrenheit"])
        .default("celsius")
        .describe("Temperature unit"),
});

export type WeatherInput = z.infer<typeof WeatherInputSchema>;

// ── Tool definition ────────────────────────────────────────────────────────────
export const weatherToolDefinition = {
    name: "get_weather",
    description:
        "Get the current weather for a city. Returns temperature, humidity, and conditions.",
    inputSchema: {
        type: "object" as const,
        properties: {
            city: {
                type: "string",
                description: "Name of the city to get weather for",
            },
            unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "Temperature unit (default: celsius)",
            },
        },
        required: ["city"],
    },
};

// ── Mock weather data ──────────────────────────────────────────────────────────
// In production, replace this with a real HTTP call
const MOCK_WEATHER: Record<
    string,
    { tempC: number; humidity: number; condition: string }
> = {
    london: { tempC: 12, humidity: 80, condition: "Cloudy" },
    "new york": { tempC: 18, humidity: 60, condition: "Sunny" },
    tokyo: { tempC: 22, humidity: 55, condition: "Partly Cloudy" },
    paris: { tempC: 14, humidity: 70, condition: "Rainy" },
    sydney: { tempC: 25, humidity: 50, condition: "Sunny" },
};

// ── Tool handler ───────────────────────────────────────────────────────────────
export async function handleGetWeather(args: unknown) {
    const parsed = WeatherInputSchema.safeParse(args);
    if (!parsed.success) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid input: ${parsed.error.message}`
        );
    }

    const { city, unit } = parsed.data;
    const key = city.toLowerCase();

    // Simulate async API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const data = MOCK_WEATHER[key] ?? {
        tempC: Math.round(15 + Math.random() * 15),
        humidity: Math.round(40 + Math.random() * 40),
        condition: ["Sunny", "Cloudy", "Rainy", "Windy"][
            Math.floor(Math.random() * 4)
        ],
    };

    const temp =
        unit === "fahrenheit"
            ? Math.round(data.tempC * 1.8 + 32)
            : data.tempC;
    const unitSymbol = unit === "fahrenheit" ? "°F" : "°C";

    const weatherReport = {
        city: city.charAt(0).toUpperCase() + city.slice(1),
        temperature: `${temp}${unitSymbol}`,
        humidity: `${data.humidity}%`,
        condition: data.condition,
        timestamp: new Date().toISOString(),
    };

    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(weatherReport, null, 2),
            },
        ],
    };
}
