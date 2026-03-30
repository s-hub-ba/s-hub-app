import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Users, Search, ShieldCheck, ArrowRight, CheckCircle2, Building2 } from 'lucide-react';

export default function ForAgencies() {
  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 leading-tight tracking-tight mb-6">
              The Modern Way to <br/>
              <span className="text-blue-600">Source Talent.</span>
            </h1>
            <p className="text-lg text-stone-600 mb-8 leading-relaxed max-w-lg">
              Access NYC's largest pool of verified, high-quality childcare professionals. Streamline your hiring process, manage your roster, and grow your agency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/join?role=agency" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                Create Agency Account
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <img 
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800&h=600" 
              alt="Agency team working" 
              className="rounded-3xl shadow-2xl object-cover"
              referrerpolicy="no-referrer"
            />
            <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl border border-stone-100">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">1,200+ Nannies</p>
                  <p className="text-xs text-stone-500">Active in NYC area</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">Built for Top-Tier Agencies</h2>
            <p className="text-stone-600 text-lg">Everything you need to find, vet, and manage the best nannies in New York City.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Global Talent Search</h3>
              <p className="text-stone-600 leading-relaxed">
                Search our entire database of verified nannies. Filter by experience, certifications, location, and availability to find the perfect match for your clients.
              </p>
            </div>
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">ShiftScore™ Verification</h3>
              <p className="text-stone-600 leading-relaxed">
                Save time on vetting. Our proprietary ShiftScore™ algorithm evaluates nannies based on experience, verified certifications, and reviews from other agencies.
              </p>
            </div>
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <Building2 className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Private Talent Pool</h3>
              <p className="text-stone-600 leading-relaxed">
                Manage your own roster. Save candidates, add private notes, track interview statuses, and invite your existing nannies to join your digital pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-stone-400 text-lg">Choose the plan that fits your agency's hiring volume.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700 flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-stone-400 text-sm mb-6">For agencies testing demand</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-stone-400">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Public agency profile
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Family request inbox access
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Up to 10 private nanny profiles
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Upgrade when ready to post jobs
                </li>
              </ul>
              <Link to="/join?role=agency" className="w-full py-3 px-4 bg-stone-700 hover:bg-stone-600 text-white font-bold rounded-xl transition-colors text-center">
                Start Free
              </Link>
            </div>

            {/* Starter */}
            <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700 flex flex-col">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-stone-400 text-sm mb-6">For boutique agencies</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-stone-400">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  1 Recruiter Seat
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  5 Active Job Postings
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Family Request Inbox
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Private Talent Pool (Up to 50)
                </li>
              </ul>
              <Link to="/join?role=agency" className="w-full py-3 px-4 bg-stone-700 hover:bg-stone-600 text-white font-bold rounded-xl transition-colors text-center">
                Choose Starter
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-blue-600 p-8 rounded-3xl border border-blue-500 flex flex-col relative transform md:-translate-y-4 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-900 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-blue-200 text-sm mb-6">For growing agencies</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$59</span>
                <span className="text-blue-200">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                  3 Recruiter Seats
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                  Unlimited Job Postings
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                  Advanced Search & Filters
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                  Unlimited Talent Pool
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                  Direct Messaging
                </li>
              </ul>
              <Link to="/join?role=agency" className="w-full py-3 px-4 bg-white text-blue-900 hover:bg-stone-50 font-bold rounded-xl transition-colors text-center">
                Choose Pro
              </Link>
            </div>

            {/* Team */}
            <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700 flex flex-col">
              <h3 className="text-xl font-bold mb-2">Team</h3>
              <p className="text-stone-400 text-sm mb-6">For multi-recruiter operations</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$149</span>
                <span className="text-stone-400">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Unlimited Seats
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Everything in Pro
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  API Access
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  Dedicated Account Manager
                </li>
              </ul>
              <Link to="/join?role=agency" className="w-full py-3 px-4 bg-stone-700 hover:bg-stone-600 text-white font-bold rounded-xl transition-colors text-center">
                Choose Team
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
