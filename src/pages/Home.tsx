import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, Star, Users, MapPin, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1544126592-807ade215a0b?auto=format&fit=crop&q=80&w=2070" 
            alt="Nanny with child" 
            className="w-full h-full object-cover opacity-30"
            referrerpolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-900 via-stone-900/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-200 text-xs font-medium mb-5 border border-emerald-500/20 opacity-80">
              <MapPin className="h-3.5 w-3.5" />
              <span>Exclusive to New York City</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-white">
              Place better nannies faster.
            </h1>
            <p className="text-lg md:text-xl text-stone-300 mb-10 max-w-lg leading-relaxed">
              Shift Me Up helps NYC agencies manage talent, track availability, and place candidates faster - all in one platform.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-stretch">
              <Link 
                to="/join?role=agency" 
                className="inline-flex justify-center items-center px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-900/30 transition-all"
              >
                Set up your agency
              </Link>
              <Link 
                to="/join?role=nanny" 
                className="inline-flex justify-center items-center px-6 py-3.5 rounded-xl border border-white/70 bg-white/5 text-white font-semibold hover:bg-white hover:text-stone-900 hover:scale-[1.02] hover:shadow-xl transition-all"
              >
                Join as nanny
              </Link>
              <Link 
                to="/agencies" 
                className="inline-flex justify-center items-center px-1 py-3.5 text-stone-200 font-semibold hover:text-white transition-colors"
              >
                Find agencies
              </Link>
            </div>
            <p className="mt-3 text-sm text-stone-300/90">Takes less than 2 minutes</p>
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <motion.section
        className="py-24 bg-white"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-4">Built for how childcare actually works.</h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">Agencies, nannies, and families operate in one connected system - with real data, verified profiles, and faster decision-making.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              className="flex flex-col items-center text-center rounded-2xl border border-stone-200 bg-white p-8 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:bg-emerald-50/30 transition-all"
              whileHover={{ y: -4 }}
            >
              <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6 text-emerald-600">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Nannies</h3>
              <p className="text-stone-600 mb-6 max-w-xs">Build your professional profile, track your reputation, and get discovered by top NYC agencies.</p>
              <Link to="/for-nannies" className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1 mt-auto">
                Create profile <span aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>

            <motion.div
              className="flex flex-col items-center text-center rounded-2xl border border-stone-200 bg-white p-8 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:bg-blue-50/30 transition-all"
              whileHover={{ y: -4 }}
            >
              <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 text-blue-600">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Agencies</h3>
              <p className="text-stone-600 mb-6 max-w-xs">Manage your nannies, track availability, and place candidates faster with real-time data.</p>
              <Link to="/for-agencies" className="text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 mt-auto">
                Set up agency <span aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>

            <motion.div
              className="flex flex-col items-center text-center rounded-2xl border border-stone-200 bg-white p-8 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:bg-indigo-50/30 transition-all"
              whileHover={{ y: -4 }}
            >
              <div className="h-14 w-14 rounded-2xl bg-purple-100 flex items-center justify-center mb-6 text-purple-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Families</h3>
              <p className="text-stone-600 mb-6 max-w-xs">Connect with trusted NYC agencies and find the right nanny faster.</p>
              <Link to="/agencies" className="text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1 mt-auto">
                Find an agency <span aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Social Proof / Stats */}
      <motion.section
        className="py-24 bg-stone-50 border-y border-stone-200"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-base md:text-lg font-semibold text-stone-900 mb-2">NYC-based network</div>
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wider">Local focus</div>
            </div>
            <div>
              <div className="text-base md:text-lg font-semibold text-stone-900 mb-2">Verified agency partners</div>
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wider">Trusted matching</div>
            </div>
            <div>
              <div className="text-base md:text-lg font-semibold text-stone-900 mb-2">Real-time availability tracking</div>
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wider">Operational clarity</div>
            </div>
            <div>
              <div className="text-base md:text-lg font-semibold text-stone-900 mb-2">Faster placements</div>
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wider">Shorter time to close</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="py-28 bg-emerald-900 text-white text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Start placing faster today.</h2>
          <p className="text-lg text-emerald-100 mb-10 max-w-2xl mx-auto">Join NYC agencies already using Shift Me Up to manage talent and close placements faster.</p>
          <Link 
            to="/join?role=agency" 
            className="inline-flex justify-center items-center px-8 py-4 rounded-xl bg-white text-emerald-900 font-bold text-lg hover:bg-stone-100 hover:scale-[1.02] hover:shadow-xl transition-all shadow-xl"
          >
            Set up your agency
          </Link>
          <div className="mt-4">
            <Link to="/join?role=nanny" className="text-emerald-100 hover:text-white font-medium underline underline-offset-4 transition-colors">
              Or join as a nanny
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
