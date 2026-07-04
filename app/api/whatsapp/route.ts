import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppAI } from "@/lib/ai-agent";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { prisma } from "@/lib/db";

// Verify webhook
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Handle incoming messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (!message) return NextResponse.json({ ok: true });

  const from = message.from; // phone number
  const msgType = message.type;

  // Check if AI agent is enabled
  const aiSetting = await prisma.setting.findUnique({ where: { key: "whatsapp_ai_enabled" } });
  const aiEnabled = aiSetting?.value !== "false";

  if (!aiEnabled) {
    // Just acknowledge — human receptionist handles it
    return NextResponse.json({ ok: true });
  }

  let userText = "";
  if (msgType === "text") {
    userText = message.text?.body || "";
  } else if (msgType === "audio") {
    // For voice notes — acknowledge and ask for text
    await sendWhatsAppMessage(
      from,
      "Hi! I received your voice note. For now, please send your message as text and I'll help you book an appointment! 😊"
    );
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ ok: true });
  }

  if (!userText) return NextResponse.json({ ok: true });

  const reply = await handleWhatsAppAI(from, userText);
  await sendWhatsAppMessage(from, reply);

  return NextResponse.json({ ok: true });
}
