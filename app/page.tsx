import Link from "next/link";
import { Star, Clock, Phone, MapPin, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import Butterfly from "@/components/butterfly";

const services = [
  { icon: "💅", name: "Manicure", desc: "Classic & gel nail treatments" },
  { icon: "🦶", name: "Pedicure", desc: "Relaxing foot care & polish" },
  { icon: "✨", name: "Facial", desc: "Deep cleanse & glow treatments" },
  { icon: "🌿", name: "Slimming", desc: "Body contouring sessions" },
  { icon: "⚡", name: "Laser", desc: "Hair removal & skin treatments" },
];

// Re-render at most once a minute so admin edits go live quickly
export const revalidate = 60;

async function getSettings() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export default async function HomePage() {
  const settings = await getSettings();
  const waLink = settings.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, "")}`
    : "https://wa.me/your-number";
  return (
    <div className="min-h-screen bg-cream text-charcoal">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-cream/85 backdrop-blur-md border-b border-sand z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1">
            <Butterfly className="w-9 h-9 -mt-1" />
            <span className="font-brand text-3xl leading-none">Divine Skin</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-8">
            <a href="#services" className="hidden md:block text-sm tracking-wide text-charcoal/70 hover:text-charcoal transition-colors">Services</a>
            <a href="#contact" className="hidden md:block text-sm tracking-wide text-charcoal/70 hover:text-charcoal transition-colors">Contact</a>
            <Link href="/book" className="bg-charcoal text-cream text-sm tracking-wide px-5 py-2.5 rounded-full hover:bg-black transition-colors">
              Book Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-taupe/40 text-taupe px-5 py-1.5 rounded-full text-xs tracking-[0.2em] uppercase mb-8">
            <Star className="w-3.5 h-3.5" /> Premium Beauty Care
          </div>
          <h1 className="font-heading text-5xl md:text-7xl font-medium leading-tight mb-4">
            {settings.hero_title || "Your skin deserves"}
          </h1>
          <p className="font-brand text-5xl md:text-7xl text-taupe mb-8">{settings.hero_script || "something divine"}</p>
          <p className="text-lg md:text-xl text-charcoal/60 max-w-2xl mx-auto mb-12 font-light">
            {settings.hero_subtitle || "Experience luxury beauty treatments in a calm, welcoming space. Book your appointment online in seconds, or reach us on WhatsApp."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/book" className="bg-charcoal text-cream tracking-wide px-10 py-4 rounded-full hover:bg-black transition-colors text-base inline-flex items-center justify-center gap-2">
              <Calendar className="w-5 h-5" /> Book Appointment
            </Link>
            <a href={waLink} className="border border-charcoal/25 text-charcoal tracking-wide px-10 py-4 rounded-full hover:border-charcoal hover:bg-cream-soft transition-colors text-base inline-flex items-center justify-center gap-2">
              💬 WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 bg-cream-soft border-y border-sand">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="font-brand text-4xl text-taupe mb-2">{settings.services_script || "our services"}</p>
            <h2 className="font-heading text-3xl md:text-4xl font-medium">{settings.services_title || "Everything you need to glow"}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {services.map((s) => (
              <Link key={s.name} href={`/book?service=${s.name.toLowerCase()}`}
                className="group bg-cream border border-sand rounded-2xl p-6 text-center hover:border-taupe hover:shadow-[0_8px_30px_rgba(160,141,117,0.15)] transition-all">
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="font-heading text-xl font-medium group-hover:text-taupe transition-colors">{s.name}</h3>
                <p className="text-sm text-charcoal/50 mt-1.5 font-light">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Hours */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border border-taupe/40 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-taupe" />
              </div>
              <h3 className="font-heading text-xl font-medium">Opening Hours</h3>
              <p className="text-charcoal/55 text-sm font-light leading-relaxed">Monday – Saturday<br />9:00 AM – 6:00 PM</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border border-taupe/40 rounded-full flex items-center justify-center">
                <Phone className="w-6 h-6 text-taupe" />
              </div>
              <h3 className="font-heading text-xl font-medium">WhatsApp Booking</h3>
              <p className="text-charcoal/55 text-sm font-light leading-relaxed">Message us anytime<br />We reply quickly!</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border border-taupe/40 rounded-full flex items-center justify-center">
                <MapPin className="w-6 h-6 text-taupe" />
              </div>
              <h3 className="font-heading text-xl font-medium">Walk-ins Welcome</h3>
              <p className="text-charcoal/55 text-sm font-light leading-relaxed">Subject to availability<br />Book ahead to secure your slot</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-charcoal text-cream">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Butterfly className="w-12 h-12 mx-auto mb-6 text-cream/80" />
          <p className="font-brand text-5xl mb-3">{settings.cta_script || "ready to glow?"}</p>
          <p className="text-cream/60 mb-10 font-light">{settings.cta_subtitle || "Book your appointment now — it only takes 2 minutes."}</p>
          <Link href="/book" className="bg-cream text-charcoal tracking-wide px-10 py-4 rounded-full hover:bg-white transition-colors inline-flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Book Now — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-14 bg-charcoal text-cream/50 text-sm border-t border-cream/10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-5 text-cream">
            <Butterfly className="w-8 h-8 -mt-1" />
            <span className="font-brand text-3xl">{settings.salon_name || "Divine Skin"}</span>
          </div>
          <p className="font-light">{settings.footer_tagline || "Mon–Sat · 9am–6pm · Walk-ins welcome"}</p>
          {/* Social links */}
          {(settings.instagram_url || settings.tiktok_url || settings.google_reviews_url) && (
            <div className="flex items-center justify-center gap-6 mt-6">
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-cream transition-colors flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  Instagram
                </a>
              )}
              {settings.tiktok_url && (
                <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:text-cream transition-colors flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.16 8.16 0 004.77 1.52V6.77a4.85 4.85 0 01-1-.08z"/></svg>
                  TikTok
                </a>
              )}
              {settings.google_reviews_url && (
                <a href={settings.google_reviews_url} target="_blank" rel="noopener noreferrer" className="hover:text-cream transition-colors flex items-center gap-1.5">
                  <Star className="w-5 h-5" />
                  Google Reviews
                </a>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
