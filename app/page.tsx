import Link from "next/link";
import { Sparkles, Star, Clock, Phone, MapPin, Calendar } from "lucide-react";

const services = [
  { icon: "💅", name: "Manicure", desc: "Classic & gel nail treatments" },
  { icon: "🦶", name: "Pedicure", desc: "Relaxing foot care & polish" },
  { icon: "✨", name: "Facial", desc: "Deep cleanse & glow treatments" },
  { icon: "🌿", name: "Slimming", desc: "Body contouring sessions" },
  { icon: "⚡", name: "Laser", desc: "Hair removal & skin treatments" },
];

export default function HomePage() {
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
            <span className="text-white font-semibold">Beauty Salon</span>
          </div>
          <p>Mon–Sat · 9am–6pm · Walk-ins welcome</p>
        </div>
      </footer>
    </div>
  );
}
