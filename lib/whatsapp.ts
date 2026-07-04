const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppMessage(to: string, message: string) {
  const res = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { body: message },
    }),
  });

  if (!res.ok) {
    console.error("WhatsApp send failed:", await res.text());
  }
  return res.ok;
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components: object[]
) {
  const res = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components,
      },
    }),
  });
  return res.ok;
}
