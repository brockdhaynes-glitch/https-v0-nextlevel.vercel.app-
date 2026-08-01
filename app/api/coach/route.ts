import { generateText } from "ai"

export const maxDuration = 30

type ChatMessage = { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  try {
    const { system, messages } = (await req.json()) as {
      system?: string
      messages?: ChatMessage[]
    }

    if (!messages || messages.length === 0) {
      return Response.json({ error: "No messages provided" }, { status: 400 })
    }

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4.6",
      system: system || "You are a supportive youth baseball coach.",
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    })

    return Response.json({ text })
  } catch (err) {
    console.error("[v0] coach route error:", err)
    return Response.json(
      { error: "The coach is having trouble connecting right now." },
      { status: 500 },
    )
  }
}
