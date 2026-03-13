import { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Users, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export default function Billing() {
  const [isManaging, setIsManaging] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Billing & Subscription</h1>
          <p className="text-stone-500 mt-1">Manage your agency's plan and recruiter seats.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Plan Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-stone-900">Starter Plan</h2>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Active
                  </span>
                </div>
                <p className="text-stone-500">Billed monthly via PayPal</p>
              </div>
              <div className="text-left md:text-right">
                <div className="text-3xl font-bold text-stone-900">$29<span className="text-lg text-stone-500 font-medium">/mo</span></div>
                <p className="text-sm text-stone-500 mt-1">Next billing date: Apr 15, 2026</p>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-stone-50/50">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Plan Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">Recruiter Seats</h4>
                    <p className="text-sm text-stone-600 mt-1">1 included seat</p>
                    <p className="text-xs text-stone-400 mt-0.5">+$5/mo per additional seat</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">Flex Months</h4>
                    <p className="text-sm text-stone-600 mt-1">2 remaining this year</p>
                    <p className="text-xs text-stone-400 mt-0.5">Pause billing without losing data</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-stone-100 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setIsManaging(!isManaging)}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Manage Subscription
              </button>
              <button className="flex-1 bg-white border border-stone-200 text-stone-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-stone-50 transition-colors">
                View Invoices
              </button>
            </div>
          </div>

          {isManaging && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 md:p-8"
            >
              <h3 className="text-lg font-bold text-stone-900 mb-6">Manage Seats</h3>
              
              <div className="flex items-center justify-between p-4 border border-stone-200 rounded-2xl mb-6">
                <div>
                  <h4 className="font-bold text-stone-900">Additional Recruiter Seats</h4>
                  <p className="text-sm text-stone-500 mt-1">$5.00 / month per seat</p>
                </div>
                <div className="flex items-center gap-4">
                  <button className="h-8 w-8 rounded-full border border-stone-300 flex items-center justify-center text-stone-600 hover:bg-stone-100">-</button>
                  <span className="font-bold text-lg w-4 text-center">0</span>
                  <button className="h-8 w-8 rounded-full border border-stone-300 flex items-center justify-center text-stone-600 hover:bg-stone-100">+</button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsManaging(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">
                  Update Plan
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-orange-600 shrink-0" />
              <div>
                <h3 className="font-bold text-orange-900">Important Note</h3>
                <p className="text-sm text-orange-800 mt-1 leading-relaxed">
                  An active subscription is required to post jobs and contact nannies in the global search pool.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <h3 className="font-bold text-stone-900 mb-4">Payment Method</h3>
            <div className="flex items-center gap-3 p-3 border border-stone-200 rounded-xl bg-stone-50 mb-4">
              <div className="h-8 w-12 bg-white border border-stone-200 rounded flex items-center justify-center">
                <span className="text-xs font-bold text-blue-800 italic">PayPal</span>
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">PayPal Account</p>
                <p className="text-xs text-stone-500">agency@example.com</p>
              </div>
            </div>
            <button className="w-full py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
              Update Payment Method
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
