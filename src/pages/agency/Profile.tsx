import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Image, Globe, Calendar, MapPin, FileText, Newspaper, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAgencyById,
  updateAgencyProfile,
  getAgencyPosts,
  addAgencyPost,
  deleteAgencyPost,
  AgencyPost,
  resolveAgencyIdForUser,
} from '../../lib/api';

const PREDEFINED_SERVICES = [
  'Full-Time Nanny Placement',
  'Part-Time Nanny Placement',
  'Newborn Care Specialist',
  'Night Nurse / Overnight Care',
  'Live-In Nanny',
  'After-School Care',
  'Temporary / Backup Care',
  'Household Manager',
  'Nanny-Housekeeper',
  'Special Needs Care',
  'Infant Care',
  'Toddler Care',
  'Multilingual Caregivers',
  'Pet-Friendly Nannies',
  'Summer Placement',
];

const NYC_BOROUGHS = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'The Bronx',
  'Staten Island',
  'Westchester',
  'Long Island',
  'New Jersey',
];

type Tab = 'profile' | 'posts';

export default function AgencyProfilePage() {
  const { user, role } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [resolvingAgency, setResolvingAgency] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Profile fields
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [established, setEstablished] = useState('');
  const [logo, setLogo] = useState('');
  const [cover, setCover] = useState('');
  const [boroughs, setBoroughs] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [customService, setCustomService] = useState('');

  // Posts
  const [posts, setPosts] = useState<AgencyPost[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  useEffect(() => {
    const resolveAgencyId = async () => {
      if (!user?.uid) {
        setAgencyId('');
        setResolvingAgency(false);
        return;
      }

      try {
        const resolved = await resolveAgencyIdForUser(user.uid);
        setAgencyId(resolved || '');
      } catch (error) {
        console.error('Error resolving agency profile id:', error);
        setAgencyId('');
      } finally {
        setResolvingAgency(false);
      }
    };

    resolveAgencyId();
  }, [user, role]);

  useEffect(() => {
    if (!agencyId) return;
    const load = async () => {
      const [agency, agencyPosts] = await Promise.all([
        getAgencyById(agencyId),
        getAgencyPosts(agencyId),
      ]);
      if (agency) {
        setCompanyName(agency.company_name || '');
        setBio(agency.bio || '');
        setWebsite(agency.website || '');
        setEstablished(agency.established || '');
        setLogo(agency.logo || '');
        setCover(agency.cover || '');
        setBoroughs(agency.boroughs || []);
        setSpecialties(agency.specialties || []);
      }
      setPosts(agencyPosts || []);
    };
    load();
  }, [agencyId]);

  if (resolvingAgency) {
    return <div className="p-8 text-center text-stone-500">Loading agency profile...</div>;
  }

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to manage your agency profile.</div>;
  }

  // --- Profile handlers ---
  const toggleBorough = (b: string) => {
    setBoroughs(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  const toggleService = (s: string) => {
    setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addCustomService = () => {
    const trimmed = customService.trim();
    if (!trimmed || specialties.includes(trimmed)) return;
    setSpecialties(prev => [...prev, trimmed]);
    setCustomService('');
  };

  const removeService = (s: string) => {
    setSpecialties(prev => prev.filter(x => x !== s));
  };

  const handleSaveProfile = async () => {
    setSubmitError('');
    setSaving(true);
    try {
      await updateAgencyProfile(agencyId, {
        company_name: companyName,
        bio,
        website,
        established,
        logo,
        cover,
        boroughs,
        specialties,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSubmitError('Unable to save profile right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- Post handlers ---
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;
    setSubmitError('');
    setSubmittingPost(true);
    try {
      const result = await addAgencyPost(agencyId, postTitle.trim(), postContent.trim());
      if (result?.id) {
        const newPost: AgencyPost = {
          id: result.id,
          agency_id: agencyId,
          title: postTitle.trim(),
          content: postContent.trim(),
          created_at: new Date(),
        };
        setPosts(prev => [newPost, ...prev]);
        setPostTitle('');
        setPostContent('');
      } else {
        setSubmitError('Unable to publish post. Your account may not have permission for this agency.');
      }
    } catch (err) {
      console.error('Failed to add post:', err);
      setSubmitError('Unable to publish post. Check your account permissions and try again.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      await deleteAgencyPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    } finally {
      setDeletingPostId(null);
    }
  };

  const formatPostDate = (value: any) => {
    if (!value) return '';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Agency Profile</h1>
          <p className="text-stone-500 mt-1">Manage your public profile, services, and agency news.</p>
        </div>
        {activeTab === 'profile' && (
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl w-fit">
        {(['profile', 'posts'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab === 'profile' ? (
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> Profile</span>
            ) : (
              <span className="flex items-center gap-1.5"><Newspaper className="h-4 w-4" /> Posts</span>
            )}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-stone-900">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Agency Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.currentTarget.value)}
                  placeholder="Your agency name"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">About Your Agency</label>
                <textarea
                  rows={5}
                  value={bio}
                  onChange={e => setBio(e.currentTarget.value)}
                  placeholder="Describe your agency, philosophy, and what makes you unique..."
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    <Globe className="inline h-4 w-4 mr-1 text-stone-400" />Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.currentTarget.value)}
                    placeholder="https://youragency.com"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    <Calendar className="inline h-4 w-4 mr-1 text-stone-400" />Year Established
                  </label>
                  <input
                    type="text"
                    value={established}
                    onChange={e => setEstablished(e.currentTarget.value)}
                    placeholder="e.g. 2010"
                    maxLength={4}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Profile Images */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Image className="h-5 w-5 text-stone-400" /> Photos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Logo URL</label>
                  <input
                    type="url"
                    value={logo}
                    onChange={e => setLogo(e.currentTarget.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  {logo && (
                    <img src={logo} alt="Logo preview" className="mt-3 h-16 w-16 rounded-xl object-cover border border-stone-200" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Cover Image URL</label>
                  <input
                    type="url"
                    value={cover}
                    onChange={e => setCover(e.currentTarget.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  {cover && (
                    <img src={cover} alt="Cover preview" className="mt-3 h-16 w-full rounded-xl object-cover border border-stone-200" />
                  )}
                </div>
              </div>
            </div>

            {/* Services / Specialties */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-5">
              <h2 className="text-lg font-bold text-stone-900">Services Provided</h2>
              <p className="text-sm text-stone-500 -mt-2">Select all that apply or add your own.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PREDEFINED_SERVICES.map(service => {
                  const checked = specialties.includes(service);
                  return (
                    <label
                      key={service}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(service)}
                        className="accent-emerald-600 h-4 w-4 shrink-0"
                      />
                      <span className="text-sm font-medium">{service}</span>
                    </label>
                  );
                })}
              </div>

              {/* Custom service chips */}
              {specialties.filter(s => !PREDEFINED_SERVICES.includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {specialties
                    .filter(s => !PREDEFINED_SERVICES.includes(s))
                    .map(s => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {s}
                        <button onClick={() => removeService(s)} className="hover:text-blue-900 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                </div>
              )}

              {/* Add custom */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customService}
                  onChange={e => setCustomService(e.currentTarget.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomService(); } }}
                  placeholder="Add a custom service..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <button
                  type="button"
                  onClick={addCustomService}
                  disabled={!customService.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Right: Boroughs */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4 sticky top-24">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-stone-400" /> Boroughs Covered
              </h2>
              <p className="text-sm text-stone-500 -mt-1">Where do you place nannies?</p>
              <div className="space-y-2">
                {NYC_BOROUGHS.map(b => {
                  const checked = boroughs.includes(b);
                  return (
                    <label
                      key={b}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBorough(b)}
                        className="accent-emerald-600 h-4 w-4 shrink-0"
                      />
                      <span className="text-sm font-medium">{b}</span>
                    </label>
                  );
                })}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors mt-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saveSuccess ? 'Saved!' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="max-w-2xl space-y-6">
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          {/* Compose */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">New Post</h2>
            <form onSubmit={handleSubmitPost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={e => setPostTitle(e.currentTarget.value)}
                  placeholder="e.g. We're hiring summer nannies!"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Content</label>
                <textarea
                  rows={4}
                  value={postContent}
                  onChange={e => setPostContent(e.currentTarget.value)}
                  placeholder="Share news, updates, or announcements with families who follow your agency..."
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  maxLength={1200}
                />
                <p className="text-xs text-stone-400 mt-1 text-right">{postContent.length}/1200</p>
              </div>
              <button
                type="submit"
                disabled={submittingPost || !postTitle.trim() || !postContent.trim()}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                {submittingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                Publish Post
              </button>
            </form>
          </div>

          {/* Posts list */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-stone-900">Published Posts</h2>
            {posts.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm text-center text-stone-500">
                No posts yet. Share your first update above!
              </div>
            ) : (
              <AnimatePresence>
                {posts.map(post => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-stone-900 text-base mb-1">{post.title}</h3>
                        <p className="text-xs text-stone-400 mb-3">{formatPostDate(post.created_at)}</p>
                        <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      </div>
                      <button
                        onClick={() => post.id && handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        className="shrink-0 p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
                        title="Delete post"
                      >
                        {deletingPostId === post.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
