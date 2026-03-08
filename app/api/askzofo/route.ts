import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export async function POST(req: Request) {
    try {
        const { message, model } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        if (model === "gemini") {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const result = await geminiModel.generateContent(message);
            const response = await result.response;
            const text = response.text();

            return NextResponse.json({ reply: text });
        }

        else if (model === "openai") {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
            }

            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: message }],
                model: "gpt-3.5-turbo",
            });

            return NextResponse.json({ reply: completion.choices[0]?.message?.content || "No response generated." });
        }

        else {
            return NextResponse.json({ error: "Invalid model specified. Choose 'openai' or 'gemini'." }, { status: 400 });
        }

    } catch (error: any) {
        console.error("AI Route Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process AI request" }, { status: 500 });
    }
}
