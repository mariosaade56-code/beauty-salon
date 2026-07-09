"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Defaults mirror what the homepage shows when a setting is empty
const FIELDS = {
  hero_title: "Your skin deserves",
  hero_script: "something divine",
  hero_subtitle:
    "Experience luxury beauty treatments in a calm, welcoming space. Book your appointment online in seconds, or reach us on WhatsApp.",
  services_script: "our services",
  services_title: "Everything you need to glow",
  cta_script: "ready to glow?",
  cta_subtitle: "Book your appointment now — it only takes 2 minutes.",
  footer_tagline: "Mon–Sat · 9am–6pm · Walk-ins welcome",
  whatsapp_number: "",
};

type Content = Record<keyof typeof FIELDS, string>;

export default function WebsitePage() {
  const [content, setContent] = useState<Content>({ ...FIELDS, whatsapp_number: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setContent((c) => {
        const next = { ...c };
        (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).forEach((k) => {
          if (s[k]) next[k] = s[k];
        });
        return next;
      });
    });
  }, []);

  async function save() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(key: keyof typeof FIELDS, value: string) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Website</h1>
          <p className="text-sm text-gray-500 mt-1">Edit the texts shown on the public website. Changes go live within a minute.</p>
        </div>
        <Button onClick={save}>{saved ? "✓ Saved!" : "Save Changes"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Hero (top of homepage)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main heading</label>
            <Input value={content.hero_title} onChange={(e) => set("hero_title", e.target.value)} placeholder={FIELDS.hero_title} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Script line (handwritten style)</label>
            <Input value={content.hero_script} onChange={(e) => set("hero_script", e.target.value)} placeholder={FIELDS.hero_script} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle paragraph</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              value={content.hero_subtitle}
              onChange={(e) => set("hero_subtitle", e.target.value)}
              placeholder={FIELDS.hero_subtitle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Services section</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Script line</label>
            <Input value={content.services_script} onChange={(e) => set("services_script", e.target.value)} placeholder={FIELDS.services_script} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heading</label>
            <Input value={content.services_title} onChange={(e) => set("services_title", e.target.value)} placeholder={FIELDS.services_title} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bottom call-to-action</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Script line</label>
            <Input value={content.cta_script} onChange={(e) => set("cta_script", e.target.value)} placeholder={FIELDS.cta_script} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <Input value={content.cta_subtitle} onChange={(e) => set("cta_subtitle", e.target.value)} placeholder={FIELDS.cta_subtitle} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact & footer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number (for the &quot;WhatsApp Us&quot; button)</label>
            <Input value={content.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="e.g. 96170123456 (country code, no + or spaces)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer tagline</label>
            <Input value={content.footer_tagline} onChange={(e) => set("footer_tagline", e.target.value)} placeholder={FIELDS.footer_tagline} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
