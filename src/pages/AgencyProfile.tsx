import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, MapPin, Globe, Mail, Phone, Calendar, CheckCircle2, Star } from 'lucide-react';

// Mock Data
const AGENCY = {
  id: '1',
  name: 'Manhattan Elite Nannies',
  logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=200&h=200',
  cover: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=1200&h=400',
  boroughs: ['Manhattan', 'Brooklyn'],
  specialties: ['Newborn Care', 'Bilingual', 'High-Profile', 'Live-in', 'Travel Nannies'],
  description: 'Providing top-tier childcare professionals to discerning families across Manhattan and Brooklyn for over 10 years. We specialize in placing highly educated, experienced, and discreet nannies with high-profile families. Our rigorous vetting process ensures only the top 5% of applicants are accepted into our network.',
  isVerified: true,
  website: 'www.manhattanelitenannies.com',
  established: '2014',
  rating: 4.9,
  reviews: 124
};

export default function AgencyProfile() {
  const { id } = useParams();
  const [inquirySent, setInquirySent] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => {
      setInquirySent(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Cover Image */}
      <div className="h-64 md:h-80 w-full relative">
        <img 
          src={AGENCY.cover} 
          alt="Agency Cover" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <img 
                  src={AGENCY.logo} 
                  alt={`${AGENCY.name} logo`} 
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-md bg-white -mt-16 md:-mt-20"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{AGENCY.name}</h1>
                    {AGENCY.isVerified && (
                      <div className="flex items-center justify-center bg-emerald-100 text-emerald-600 p-1 rounded-full" title="Verified Agency">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-stone-600 mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-stone-400" />
                      {AGENCY.boroughs.join(', ')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-stone-400" />
                      {AGENCY.website}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-stone-400" />
                      Est. {AGENCY.established}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors">
                      Follow Agency
                    </button>
                    <button className="px-5 py-2.5 bg-stone-100 text-stone-900 text-sm font-medium rounded-xl hover:bg-stone-200 transition-colors border border-stone-200">
                      View Jobs
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <h2 className="text-xl font-bold text-stone-900 mb-4">About the Agency</h2>
              <p className="text-stone-600 leading-relaxed mb-8">
                {AGENCY.description}
              </p>

              <h3 className="text-lg font-semibold text-stone-900 mb-4">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {AGENCY.specialties.map(spec => (
                  <span key={spec} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            {/* Reviews Summary */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-stone-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-900">Parent Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400 fill-current" />
                  <span className="font-bold text-stone-900">{AGENCY.rating}</span>
                  <span className="text-stone-500 text-sm">({AGENCY.reviews} reviews)</span>
                </div>
              </div>
              <p className="text-stone-500 italic text-sm">Detailed reviews are available to registered users.</p>
            </div>
          </div>

          {/* Sidebar - Inquiry Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 sticky top-24">
              <h2 className="text-xl font-bold text-stone-900 mb-2">Contact Agency</h2>
              <p className="text-sm text-stone-500 mb-6">Send an inquiry directly to {AGENCY.name} to discuss your childcare needs.</p>

              {inquirySent ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center"
                >
                  <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-900 mb-2">Inquiry Sent!</h3>
                  <p className="text-emerald-700 text-sm">
                    The agency has received your request and will contact you shortly.
                  </p>
                  <button 
                    onClick={() => setInquirySent(false)}
                    className="mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Send another inquiry
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Your Name</label>
                    <input type="text" required className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                    <input type="email" required className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="jane@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Phone (Optional)</label>
                    <input type="tel" className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Borough</label>
                    <select required className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white">
                      <option value="">Select Borough</option>
                      <option value="Manhattan">Manhattan</option>
                      <option value="Brooklyn">Brooklyn</option>
                      <option value="Queens">Queens</option>
                      <option value="Bronx">Bronx</option>
                      <option value="Staten Island">Staten Island</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Childcare Needs</label>
                    <textarea required rows={4} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none" placeholder="Briefly describe what you're looking for (e.g., full-time nanny for a 6-month-old starting next month)..."></textarea>
                  </div>
                  <button type="submit" className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-sm">
                    Send Inquiry
                  </button>
                  <p className="text-xs text-stone-400 text-center mt-4">
                    By submitting this form, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
