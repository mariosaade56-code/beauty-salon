import Link from "next/link";
import { Sparkles, Star, Clock, Phone, MapPin, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";

const services = [
  { icon: "💅", name: "Manicure", desc: "Classic & gel nail treatments" },
  { icon: "🦶", name: "Pedicure", desc: "Relaxing foot care & polish" },
  { icon: "✨", name: "Facial", desc: "Deep cleanse & glow treatments" },
  { icon: "🌿", name: "Slimming", desc: "Body contouring sessions" },
  { icon: "⚡", name: "Laser", desc: "Hair removal & skin treatments" },
];

async function getSettings() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Beauty Salon</span>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <a href="#services" className="hidden md:block text-sm text-gray-600 hover:text-pink-600 transition-colors">Services</a>
            <a href="#contact" className="hidden md:block text-sm text-gray-600 hover:text-pink-600 transition-colors">Contact</a>
            <Link href="/book" className="bg-pink-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors">
              Book Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-pink-100 text-pink-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" /> Premium Beauty Services
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Your Beauty,<br />
            <span className="text-pink-600">Our Passion</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Experience luxury beauty treatments. Book your appointment online in seconds, or reach us on WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/book" className="bg-pink-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-pink-700 transition-colors text-lg inline-flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Book Appointment
            </Link>
            <a href="https://wa.me/your-number" className="bg-green-500 text-white font-semibold px-8 py-4 rounded-xl hover:bg-green-600 transition-colors text-lg inline-flex items-center gap-2">
              💬 WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Our Services</h2>
            <p className="text-gray-500 mt-3">Everything you need to look and feel your best</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {services.map((s) => (
              <Link key={s.name} href={`/book?service=${s.name.toLowerCase()}`}
                className="group bg-white border border-gray-200 rounded-2xl p-6 text-center hover:border-pink-300 hover:shadow-md transition-all">
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">{s.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Hours */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center">
                <Clock className="w-7 h-7 text-pink-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Opening Hours</h3>
              <p className="text-gray-500 text-sm">Monday – Saturday<br />9:00 AM – 6:00 PM</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Phone className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">WhatsApp Booking</h3>
              <p className="text-gray-500 text-sm">Message us anytime<br />We reply quickly!</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                <MapPin className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Walk-ins Welcome</h3>
              <p className="text-gray-500 text-sm">Subject to availability<br />Book ahead to secure your slot</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-pink-600 to-purple-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to glow?</h2>
          <p className="text-pink-100 mb-8">Book your appointment now — it only takes 2 minutes.</p>
          <Link href="/book" className="bg-white text-pink-600 font-semibold px-8 py-4 rounded-xl hover:bg-pink-50 transition-colors inline-flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Book Now — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-12 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-7 h-7 bg-pink-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-semibold">{settings.salon_name || "Beauty Salon"}</span>
          </div>
          <p>Mon–Sat · 9am–6pm · Walk-ins welcome</p>
          {/* Social links */}
          {(settings.instagram_url || settings.tiktok_url || settings.google_reviews_url) && (
            <div className="flex items-center justify-center gap-5 mt-5">
              {settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  Instagram
                </a>
              )}
              {settings.tiktok_url && (
                <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.16 8.16 0 004.77 1.52V6.77a4.85 4.85 0 01-1-.08z"/></svg>
                  TikTok
                </a>
              )}
              {settings.google_reviews_url && (
                <a href={settings.google_reviews_url} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
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
