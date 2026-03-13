import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Star, Calendar, ArrowRight, CheckCircle2, DollarSign } from 'lucide-react';

export default function ForNannies() {
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
              Your Career, <br/>
              <span className="text-emerald-600">Elevated.</span>
            </h1>
            <p className="text-lg text-stone-600 mb-8 leading-relaxed max-w-lg">
              Join NYC's premier network of verified childcare professionals. Connect with top agencies, manage your schedule, and access exclusive high-paying opportunities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/join?role=nanny" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                Apply to Join
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/agencies" className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 px-8 py-4 rounded-xl text-lg font-bold shadow-sm transition-colors flex items-center justify-center">
                Browse Agencies
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
              src="https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?auto=format&fit=crop&q=80&w=800&h=600" 
              alt="Nanny playing with child" 
              className="rounded-3xl shadow-2xl object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-stone-100">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <Star className="h-6 w-6 fill-current" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900">ShiftScore™</p>
                  <p className="text-xs text-stone-500">Stand out to top agencies</p>
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
            <h2 className="text-3xl font-bold text-stone-900 mb-4">Why Join Shift Me Up?</h2>
            <p className="text-stone-600 text-lg">We provide the tools you need to build a sustainable, high-earning career in childcare.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Verified Agencies Only</h3>
              <p className="text-stone-600 leading-relaxed">
                Every agency on our platform is strictly vetted. Say goodbye to scams and unreliable employers. Work only with the best in NYC.
              </p>
            </div>
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Control Your Schedule</h3>
              <p className="text-stone-600 leading-relaxed">
                Set your availability and let jobs come to you. Whether you want full-time, part-time, or occasional date nights, you're in charge.
              </p>
            </div>
            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100">
              <div className="h-14 w-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <DollarSign className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-3">Higher Earnings</h3>
              <p className="text-stone-600 leading-relaxed">
                Build your ShiftScore™ through great reviews and verified certifications to command higher rates and access exclusive VIP placements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-8">How It Works</h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold shrink-0">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Create Your Profile</h3>
                    <p className="text-stone-400">Upload your resume, certifications, and references. Our team verifies your credentials to build your initial ShiftScore™.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold shrink-0">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Browse & Apply</h3>
                    <p className="text-stone-400">View jobs from top NYC agencies. Apply with one click using your universal profile.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold shrink-0">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Get Hired</h3>
                    <p className="text-stone-400">Interview with agencies and families. Accept offers directly through the platform.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700">
              <h3 className="text-xl font-bold mb-6">Requirements to Join</h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-stone-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Minimum 2 years of professional childcare experience
                </li>
                <li className="flex items-center gap-3 text-stone-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Valid CPR and First Aid certification
                </li>
                <li className="flex items-center gap-3 text-stone-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  At least 3 verifiable professional references
                </li>
                <li className="flex items-center gap-3 text-stone-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Clean background check (completed upon hire)
                </li>
                <li className="flex items-center gap-3 text-stone-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Legal right to work in the US
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center px-4">
        <h2 className="text-3xl font-bold text-stone-900 mb-6">Ready to elevate your career?</h2>
        <p className="text-lg text-stone-600 mb-8 max-w-2xl mx-auto">
          Join hundreds of top-tier nannies who are finding better jobs, earning more, and taking control of their schedules.
        </p>
        <Link to="/join?role=nanny" className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-sm transition-colors">
          Apply Now
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>
    </div>
  );
}
