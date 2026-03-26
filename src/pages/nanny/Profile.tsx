import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, MapPin, Briefcase, GraduationCap, Camera, Save, Star, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  createNannyDocument,
  getNannyById,
  getNannyDocuments,
  getNannyReferenceShareTargets,
  getNannyReviewSummary,
  getNannyReviews,
  updateNannyProfile,
  updateNannyReferenceSharing,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../lib/firebase';

export default function NannyProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [documents, setDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState<'cv' | 'certification' | 'id' | 'reference' | 'other'>('cv');
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUrl, setDocUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewSummary, setReviewSummary] = useState<any>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [shareTargets, setShareTargets] = useState<any[]>([]);
  const [isSavingShareByDocId, setIsSavingShareByDocId] = useState<Record<string, boolean>>({});

  const nannyId = user?.uid || '';

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (!nannyId) {
        setError('Please sign in to view your profile.');
        setIsLoading(false);
        return;
      }

      try {
        const [data, docs, summary, reviews, targets] = await Promise.all([
          getNannyById(nannyId),
          getNannyDocuments(nannyId),
          getNannyReviewSummary(nannyId),
          getNannyReviews(nannyId),
          getNannyReferenceShareTargets(nannyId),
        ]);
        if (data) {
          setProfile(data);
          setFormData(data);
          setDocuments(docs || []);
          setReviewSummary(summary);
          setRecentReviews((reviews || []).slice(0, 4));
          setShareTargets(targets || []);
        } else {
          setError('Profile not found. Please complete your onboarding.');
        }
      } catch (err: any) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [nannyId]);

  const handleSave = async () => {
    if (!nannyId) {
      return;
    }

    try {
      const updated = await updateNannyProfile(nannyId, formData);
      if (updated) {
        setProfile(updated);
        setIsEditing(false);
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile: ' + err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const refreshDocuments = async () => {
    if (!nannyId) return;
    const docs = await getNannyDocuments(nannyId);
    setDocuments(docs || []);
  };

  const handleReferenceShareToggle = async (document: any, agencyId: string, checked: boolean) => {
    if (!document?.id || !agencyId || document.type !== 'reference' || document.status !== 'approved') return;

    const existingIds = Array.isArray(document.shared_with_agency_ids) ? document.shared_with_agency_ids : [];
    const nextIds = checked
      ? Array.from(new Set([...existingIds, agencyId]))
      : existingIds.filter((id: string) => id !== agencyId);

    setIsSavingShareByDocId((prev) => ({ ...prev, [document.id]: true }));
    try {
      const updated = await updateNannyReferenceSharing({
        documentId: document.id,
        sharedAgencyIds: nextIds,
      });
      if (!updated?.id) return;

      setDocuments((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
    } catch (shareError) {
      console.error('Failed to update reference sharing:', shareError);
    } finally {
      setIsSavingShareByDocId((prev) => ({ ...prev, [document.id]: false }));
    }
  };

  const handleUploadDocument = async () => {
    if (!nannyId || !user?.uid || !docName.trim() || (!docFile && !docUrl.trim()) || isUploadingDoc) return;
    setIsUploadingDoc(true);
    setUploadError(null);
    try {
      let fileUrl = docUrl.trim();
      if (docFile) {
        const storagePath = `nanny-documents/${nannyId}/${Date.now()}-${docFile.name}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, docFile);
        fileUrl = await getDownloadURL(fileRef);
      }

      const created = await createNannyDocument({
        nanny_id: nannyId,
        uploader_user_id: user.uid,
        type: docType,
        file_name: docName.trim(),
        file_url: fileUrl
      });

      if (created?.id) {
        setDocName('');
        setDocFile(null);
        setDocUrl('');
        setDocType('cv');
        await refreshDocuments();
      } else {
        setUploadError('Upload succeeded but metadata save failed. Please try again.');
      }
    } catch (uploadErr) {
      console.error('Document upload failed:', uploadErr);
      setUploadError('Unable to upload file right now. Please try again.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    if (status === 'under_review') return 'bg-blue-100 text-blue-700';
    return 'bg-stone-100 text-stone-700';
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-stone-200 text-center">
      <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <User className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-stone-900 mb-2">Profile Issue</h2>
      <p className="text-stone-600 mb-6">{error}</p>
      <Link to="/nanny/onboarding" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
        Complete Onboarding
      </Link>
    </div>
  );

  if (!profile) return null;

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
            {profile?.photo_url ? (
              <img 
                src={profile.photo_url}
                alt="Profile" 
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-stone-100 flex items-center justify-center text-4xl font-bold text-stone-600">
                {(profile?.first_name?.charAt(0) || 'N').toUpperCase()}
              </div>
            )}
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
                <span className="text-sm">{user?.email || 'No email available'}</span>
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

      {/* Reviews Section */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden p-6 md:p-8">
        <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Verification Documents
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="cv">CV / Resume</option>
              <option value="certification">Certification</option>
              <option value="id">ID</option>
              <option value="reference">Reference Letter</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Document Name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. CPR Certificate"
              className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">File Upload</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-stone-500 mt-1">Accepted: PDF, Word, PNG, JPG.</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Or Document URL</label>
          <input
            type="url"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-stone-500">Upload CV and certifications to increase your verified profile strength and ShiftScore.</p>
          <button
            type="button"
            onClick={handleUploadDocument}
            disabled={!docName.trim() || (!docFile && !docUrl.trim()) || isUploadingDoc}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
          >
            {isUploadingDoc ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>

        {uploadError && <p className="text-sm text-red-600 mb-4">{uploadError}</p>}

        <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100">
          <div className="px-4 py-3 text-sm font-semibold text-stone-700">Uploaded Documents</div>
          {documents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-500">No documents uploaded yet.</div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="px-4 py-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-stone-900">{doc.file_name}</div>
                  <div className="text-xs text-stone-500 mt-1">Type: {doc.type}</div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block">Open document</a>
                  {doc.status === 'rejected' && doc.rejection_reason && (
                    <div className="text-xs text-red-600 mt-1">Reason: {doc.rejection_reason}</div>
                  )}

                  {doc.type === 'reference' && (
                    <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">Agency Sharing Approval</p>
                      {doc.status !== 'approved' ? (
                        <p className="text-xs text-stone-500 mt-1">Reference sharing becomes available after admin approval.</p>
                      ) : shareTargets.length === 0 ? (
                        <p className="text-xs text-stone-500 mt-1">No agency relationships found yet. Once an agency engages with your profile, you can approve sharing here.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {shareTargets.map((target) => {
                            const checked = Array.isArray(doc.shared_with_agency_ids)
                              ? doc.shared_with_agency_ids.includes(target.agency_id)
                              : false;
                            return (
                              <label key={`${doc.id}-${target.agency_id}`} className="flex items-center justify-between gap-3 text-xs text-stone-700">
                                <span>{target.agency_name}</span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!!isSavingShareByDocId[doc.id]}
                                  onChange={(e) => handleReferenceShareToggle(doc, target.agency_id, e.target.checked)}
                                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${statusBadge(doc.status)}`}>
                  {doc.status === 'under_review' ? 'Under review' : (doc.status || 'uploaded')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden p-6 md:p-8">
        <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          Verified Reviews
        </h3>

        {reviewSummary?.reviewCount ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ReviewMetric label="Reliability" value={`${reviewSummary.averageReliability.toFixed(1)}/5`} />
              <ReviewMetric label="Communication" value={`${reviewSummary.averageCommunication.toFixed(1)}/5`} />
              <ReviewMetric label="Punctuality" value={`${Math.round(reviewSummary.punctualityRate * 100)}%`} />
              <ReviewMetric label="Would Rehire" value={`${Math.round(reviewSummary.rehireRate * 100)}%`} />
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 text-sm text-stone-600">
              {reviewSummary.highlightText}
            </div>
            <div className="space-y-4">
              {recentReviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-stone-500 mb-2">
                    <span className="font-semibold uppercase text-stone-700">{review.reviewer_type}</span>
                    <span>{review.relationship_context?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                    <ReviewMetric label="Reliability" value={`${review.reliability_rating}/5`} compact />
                    <ReviewMetric label="Communication" value={`${review.communication_rating}/5`} compact />
                    <ReviewMetric label="Punctual" value={review.punctuality ? 'Yes' : 'No'} compact />
                    <ReviewMetric label="Rehire" value={review.rehire ? 'Yes' : 'No'} compact />
                  </div>
                  {review.strengths && <p className="text-sm text-stone-800"><span className="font-semibold">Strengths:</span> {review.strengths}</p>}
                  {review.notes && <p className="text-sm text-stone-600 mt-2"><span className="font-semibold">Notes:</span> {review.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-stone-500">
            No verified reviews available yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-stone-200 ${compact ? 'bg-white px-3 py-2' : 'bg-stone-50/60 p-4'}`}>
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className={`${compact ? 'text-sm' : 'text-2xl'} font-bold text-stone-900 mt-1`}>{value}</div>
    </div>
  );
}
