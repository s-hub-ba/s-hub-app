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
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-900 via-stone-900/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium mb-6 border border-emerald-500/30">
              <MapPin className="h-4 w-4" />
              <span>Exclusive to New York City</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              The premier network for NYC childcare professionals.
            </h1>
            <p className="text-lg md:text-xl text-stone-300 mb-10 max-w-xl leading-relaxed">
              Shift Me Up connects elite nannies with verified agencies, and helps parents discover the best childcare services in the city.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/join?role=nanny" 
                className="inline-flex justify-center items-center px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
              >
                Join as Nanny
              </Link>
              <Link 
                to="/join?role=agency" 
                className="inline-flex justify-center items-center px-6 py-3.5 rounded-xl bg-white text-stone-900 font-medium hover:bg-stone-100 transition-colors"
              >
                Join as Agency
              </Link>
              <Link 
                to="/agencies" 
                className="inline-flex justify-center items-center px-6 py-3.5 rounded-xl bg-stone-800 text-white font-medium hover:bg-stone-700 transition-colors border border-stone-700"
              >
                Find Agencies
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-4">A trusted ecosystem for childcare</h2>
            <p className="text-lg text-stone-600">We built Shift Me Up to elevate the childcare industry in New York, providing tools and connections that prioritize safety, professionalism, and quality.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6 text-emerald-600">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Nannies</h3>
              <p className="text-stone-600 mb-6">Build your professional profile, track your ShiftScore, and discover premium jobs from verified NYC agencies.</p>
              <Link to="/for-nannies" className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1 mt-auto">
                Learn more <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 text-blue-600">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Agencies</h3>
              <p className="text-stone-600 mb-6">Manage your talent pool, post jobs, track interview notes, and discover new nannies in our global NYC database.</p>
              <Link to="/for-agencies" className="text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 mt-auto">
                Learn more <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-6 text-purple-600">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 mb-3">For Parents</h3>
              <p className="text-stone-600 mb-6">Browse our directory of verified NYC nanny agencies. Send inquiries directly to find the perfect fit for your family.</p>
              <Link to="/agencies" className="text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1 mt-auto">
                Find an agency <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-20 bg-stone-50 border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-stone-900 mb-2">5</div>
              <div className="text-sm font-medium text-stone-500 uppercase tracking-wider">Boroughs</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-stone-900 mb-2">100%</div>
              <div className="text-sm font-medium text-stone-500 uppercase tracking-wider">Verified Agencies</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-stone-900 mb-2">24/7</div>
              <div className="text-sm font-medium text-stone-500 uppercase tracking-wider">Support</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-stone-900 mb-2">Top</div>
              <div className="text-sm font-medium text-stone-500 uppercase tracking-wider">Tier Talent</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-emerald-900 text-white text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Ready to elevate your childcare career?</h2>
          <p className="text-lg text-emerald-100 mb-10">Join the most exclusive network of childcare professionals and agencies in New York City.</p>
          <Link 
            to="/join" 
            className="inline-flex justify-center items-center px-8 py-4 rounded-xl bg-white text-emerald-900 font-bold text-lg hover:bg-stone-100 transition-colors shadow-xl"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
}
