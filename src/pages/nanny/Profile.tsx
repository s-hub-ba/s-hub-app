import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, Briefcase, GraduationCap, Camera, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { getNannyById, updateNannyProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function NannyProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const nannyId = user?.id || 'f0e9d8c7-b6a5-4321-0987-654321fedcba';

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getNannyById(nannyId);
        if (data) {
          setProfile(data);
          setFormData(data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      const updated = await updateNannyProfile(nannyId, formData);
      if (updated) {
        setProfile(updated);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">My Profile</h1>
          <p className="text-stone-500 mt-1">Manage your professional information and preferences.</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          {isEditing ? <><Save className="h-4 w-4" /> Save Changes</> : 'Edit Profile'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Header/Photo Section */}
        <div className="p-6 md:p-8 border-b border-stone-100 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative group">
            <img 
              src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150" 
              alt="Profile" 
              className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
              referrerPolicy="no-referrer"
            />
            {isEditing && (
              <button className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6" />
              </button>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left space-y-4 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">First Name</label>
                {isEditing ? (
                  <input type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                ) : (
                  <div className="text-lg font-bold text-stone-900">{profile.first_name}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Last Name</label>
                {isEditing ? (
                  <input type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                ) : (
                  <div className="text-lg font-bold text-stone-900">{profile.last_name}</div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 text-stone-600">
                <Mail className="h-4 w-4 text-stone-400" />
                <span className="text-sm">sarah@example.com</span>
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <MapPin className="h-4 w-4 text-stone-400" />
                {isEditing ? (
                  <select name="location_borough" value={formData.location_borough || ''} onChange={handleChange} className="text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none">
                    <option value="Brooklyn">Brooklyn</option>
                    <option value="Manhattan">Manhattan</option>
                    <option value="Queens">Queens</option>
                    <option value="Bronx">Bronx</option>
                    <option value="Staten Island">Staten Island</option>
                  </select>
                ) : (
                  <span className="text-sm">{profile.location_borough}, NY</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="p-6 md:p-8 space-y-8">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Professional Bio
            </h3>
            {isEditing ? (
              <textarea 
                name="bio"
                rows={4} 
                value={formData.bio || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
            ) : (
              <p className="text-stone-600 leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-600" />
                Experience & Pay
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Years of Experience</label>
                  {isEditing ? (
                    <input type="number" name="years_experience" value={formData.years_experience || ''} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  ) : (
                    <div className="text-stone-900 font-medium">{profile.years_experience} Years</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Expected Pay Range ($/hr)</label>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input type="number" name="expected_pay_min" value={formData.expected_pay_min || ''} onChange={handleChange} className="w-24 px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                      <span className="text-stone-400">-</span>
                      <input type="number" name="expected_pay_max" value={formData.expected_pay_max || ''} onChange={handleChange} className="w-24 px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  ) : (
                    <div className="text-stone-900 font-medium">${profile.expected_pay_min} - ${profile.expected_pay_max} / hr</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                Certifications
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.certifications?.map((cert: string) => (
                  <span key={cert} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-700 border border-stone-200">
                    {cert}
                    {isEditing && <button className="ml-2 text-stone-400 hover:text-red-500">&times;</button>}
                  </span>
                ))}
                {isEditing && (
                  <button className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-emerald-600 border border-emerald-200 border-dashed hover:bg-emerald-50">
                    + Add Cert
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
