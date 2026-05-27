'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CalendarDays, ChevronDown, ImageIcon, Loader2, MapPin, Navigation, Search, Sparkles, UserCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CaseAiAnalysis, CaseItem } from '@/lib/shared-types';
import { extractVisualFeaturesFromDataUrl } from '@/lib/visual-ai';

const DynamicMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center text-[#014CB3] font-bold">Loading Map...</div>
});

const ITEM_TYPES = [
  'Child',
  'Elderly Person',
  'Adult Male',
  'Adult Female',
  'Car',
  'Motorcycle',
  'Bicycle',
  'Pet - Dog',
  'Pet - Cat',
  'Other Animal',
  'Mobile Phone',
  'Jewelry',
  'Documents',
  'Other'
];

type PreviewMatch = {
  score: number;
  reason: string;
  imageScore?: number;
  similarity?: number;
  confidence?: number;
  aiPriorityApplied?: boolean;
  usedAiPhotoPriority?: boolean;
  usedOnlineAi?: boolean;
  decision?: 'Accepted Match' | 'Manual Review' | 'No Match';
  manualReview?: boolean;
  scoreBreakdown?: Record<string, number | undefined>;
  otherCase: CaseItem;
};

type LocationSuggestion = {
  lat: number;
  lng: number;
  address: string;
};

type FormState = {
  type: string;
  name: string;
  age: string;
  photo: string;
  photoFile: File | null;
  aiAnalysis: CaseAiAnalysis | null;
  location: string;
  latitude: number | undefined;
  longitude: number | undefined;
  dateTime: string;
  gender: string;
  description: string;
  clothesColor: string;
  conditionNotes: string;
};

async function lookupLocations(options: { query?: string; latitude?: number; longitude?: number }) {
  const params = new URLSearchParams();
  if (options.query?.trim()) {
    params.set('q', options.query.trim());
    params.set('countryCode', 'eg');
  } else if (options.latitude !== undefined && options.longitude !== undefined) {
    params.set('lat', String(options.latitude));
    params.set('lng', String(options.longitude));
  } else {
    return [] as LocationSuggestion[];
  }

  const response = await fetch(`/api/location/search?${params.toString()}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to search this address right now.');
  }
  if (Array.isArray(payload.items)) {
    return payload.items as LocationSuggestion[];
  }
  if (payload.item) {
    return [payload.item as LocationSuggestion];
  }
  return [] as LocationSuggestion[];
}

function createInitialFormState(): FormState {
  return {
    type: 'Child',
    name: '',
    age: '',
    photo: '',
    photoFile: null,
    aiAnalysis: null,
    location: '',
    latitude: undefined,
    longitude: undefined,
    dateTime: '',
    gender: 'Male',
    description: '',
    clothesColor: '',
    conditionNotes: ''
  };
}

function validateRequiredReportFields(data: FormState) {
  if (!data.age.trim()) return 'Age is required for every report.';
  if (!data.location.trim()) return 'Address / location is required for every report.';
  if (!data.dateTime.trim()) return 'Date / time is required for every report.';
  if (!data.description.trim()) return 'Description is required for every report.';
  if (!data.clothesColor.trim()) return 'Clothes / visual notes are required for every report.';
  return null;
}

function ReportMissingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const mode = searchParams.get('mode') === 'found' ? 'found' : 'missing';
  const isFoundMode = mode === 'found';

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false);
  const [aiPreviewMatches, setAiPreviewMatches] = useState<PreviewMatch[]>([]);

  const [formData, setFormData] = useState<FormState>(createInitialFormState());
  const formDataRef = useRef<FormState>(createInitialFormState());

  const title = useMemo(() => (isFoundMode ? 'Report Found Item / Person' : 'Report Missing'), [isFoundMode]);
  const topPreviewMatch = aiPreviewMatches[0];

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const requestAiPreview = async (nextData: FormState) => {
    if (!user || !nextData.photo || !nextData.aiAnalysis) {
      setAiPreviewMatches([]);
      return;
    }

    setAiPreviewLoading(true);
    try {
      const response = await api.previewAiMatch({
        caseType: isFoundMode ? 'FOUND' : 'MISSING',
        type: nextData.type,
        name: nextData.name,
        age: nextData.age ? Number(nextData.age) : undefined,
        photo: nextData.photo || undefined,
        location: nextData.location,
        latitude: nextData.latitude,
        longitude: nextData.longitude,
        dateTime: nextData.dateTime,
        gender: nextData.gender,
        description: nextData.description,
        clothesColor: nextData.clothesColor,
        conditionNotes: nextData.conditionNotes,
        aiAnalysis: nextData.aiAnalysis || undefined
      });
      setAiPreviewMatches(response.matches || []);
    } catch {
      setAiPreviewMatches([]);
    } finally {
      setAiPreviewLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setError('Unable to read the selected photo.');
        return;
      }

      setPhotoPreview(result);
      setAiPreviewMatches([]);
      setAiAnalyzing(true);
      setError('');

      try {
        const aiAnalysis = await extractVisualFeaturesFromDataUrl(result);
        const nextData: FormState = {
          ...formDataRef.current,
          photo: result,
          photoFile: file,
          aiAnalysis
        };
        setFormData(nextData);
        formDataRef.current = nextData;
        await requestAiPreview(nextData);
      } catch (analysisError) {
        setFormData((prev) => {
          const nextData = {
            ...prev,
            photo: result,
            photoFile: file,
            aiAnalysis: null
          };
          formDataRef.current = nextData;
          return nextData;
        });
        setError(analysisError instanceof Error ? analysisError.message : 'Unable to analyze this photo with AI right now.');
      } finally {
        setAiAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyLocationSelection = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setLocationSuggestions([]);
    setSearchLocation(location.address);
    setFormData((prev) => ({
      ...prev,
      location: location.address,
      latitude: location.lat,
      longitude: location.lng
    }));
  };

  const handleLocationSearch = async (query: string) => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      setLocationSuggestions([]);
      setError('Please type at least 3 characters to search for an address.');
      return;
    }

    setLocationSearching(true);
    setError('');
    try {
      const results = await lookupLocations({ query: normalizedQuery });
      setLocationSuggestions(results);
      if (results.length === 1) {
        applyLocationSelection(results[0]);
        setMessage('Address found and linked to the report map.');
        return;
      }
      if (results.length === 0) {
        setMessage('');
        setError('No matching address was found. You can still type the address manually or use your current location.');
        return;
      }
      setMessage('Choose the closest address from the suggestions list.');
    } catch (locationError) {
      setMessage('');
      setError(locationError instanceof Error ? locationError.message : 'Unable to search this address right now.');
    } finally {
      setLocationSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }

    setLocating(true);
    setError('');
    setMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        try {
          const matches = await lookupLocations({ latitude, longitude });
          const chosen = matches[0] || {
            lat: latitude,
            lng: longitude,
            address: `Lat ${latitude}, Lng ${longitude}`
          };
          applyLocationSelection(chosen);
          setMessage('Current location captured successfully.');
        } catch (locationError) {
          setSelectedLocation({ lat: latitude, lng: longitude, address: `Lat ${latitude}, Lng ${longitude}` });
          setFormData((prev) => ({
            ...prev,
            location: prev.location || `Lat ${latitude}, Lng ${longitude}`,
            latitude,
            longitude
          }));
          setMessage('Current coordinates were captured, but the address could not be resolved right now.');
          if (locationError instanceof Error) {
            console.warn(locationError.message);
          }
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        setLocating(false);
        setError(geoError.message || 'Unable to capture the current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resolveLocationForSubmit = async (data: FormState) => {
    const locationText = data.location.trim();
    if (!locationText || (data.latitude !== undefined && data.longitude !== undefined)) {
      return data;
    }

    try {
      const matches = await lookupLocations({ query: locationText });
      if (matches[0]) {
        applyLocationSelection(matches[0]);
        return {
          ...data,
          location: matches[0].address,
          latitude: matches[0].lat,
          longitude: matches[0].lng
        };
      }
    } catch (locationError) {
      console.warn('Location lookup failed during report submit.', locationError);
    }

    return {
      ...data,
      latitude: undefined,
      longitude: undefined
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (loading) return;
    if (!user) {
      setError('Please sign in first to submit a report.');
      router.push('/login');
      return;
    }

    const validationError = validateRequiredReportFields(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const resolvedFormData = await resolveLocationForSubmit(formData);
      setFormData(resolvedFormData);

      const payload = {
        type: resolvedFormData.type,
        name: resolvedFormData.name,
        age: resolvedFormData.age ? Number(resolvedFormData.age) : undefined,
        photo: resolvedFormData.photo || undefined,
        location: resolvedFormData.location,
        latitude: resolvedFormData.latitude,
        longitude: resolvedFormData.longitude,
        dateTime: resolvedFormData.dateTime,
        gender: resolvedFormData.gender,
        description: resolvedFormData.description,
        clothesColor: resolvedFormData.clothesColor,
        conditionNotes: resolvedFormData.conditionNotes,
        aiAnalysis: resolvedFormData.aiAnalysis || undefined
      };

      const response = isFoundMode ? await api.createFound(payload) : await api.createMissing(payload);
      const item = response.item;
      const compatibility = {
        id: item.id,
        caseId: item.id,
        referenceCode: item.referenceCode,
        status: item.status,
        date: item.createdAt,
        type: item.category || resolvedFormData.type,
        name: item.displayName,
        photo: item.primaryImage || resolvedFormData.photo || null,
        location: item.locationText || resolvedFormData.location,
        latitude: item.latitude,
        longitude: item.longitude,
        dateTime: item.eventTime || item.createdAt,
        description: item.description || resolvedFormData.description,
        age: item.age,
        gender: item.gender,
        clothesColor: item.clothesColor,
        aiAnalysis: item.aiAnalysis || resolvedFormData.aiAnalysis || undefined
      };

      localStorage.setItem('currentReport', JSON.stringify(compatibility));
      localStorage.setItem('lastReportData', JSON.stringify(compatibility));
      localStorage.setItem('lastCreatedCaseId', item.id);
      setMessage(`${isFoundMode ? 'Found report' : 'Missing report'} saved successfully.`);
      router.push(`/case-details?caseId=${encodeURIComponent(item.id)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit report right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      <nav className="h-16 bg-white flex items-center justify-between px-6 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <Image src="/photos/8.png" alt="RETURN" width={110} height={36} priority />
        </div>

        <div className="hidden md:flex items-center gap-8">
          {[
            { name: 'Home', tab: 'overview' },
            { name: 'Missing', tab: 'missing' },
            { name: 'Found', tab: 'found' },
            { name: 'Devices', tab: 'devicesHeader' },
            { name: 'Profile', tab: 'profile' }
          ].map((item, i) => (
            <button
              key={item.name}
              type="button"
              onClick={() => router.push(`/lost-dashboard?tab=${item.tab}`)}
              className={`text-sm font-semibold transition-all pb-1 cursor-pointer ${
                i === 0 ? 'text-[#60C10F] border-b-2 border-[#60C10F]' : 'text-gray-500 hover:text-[#60C10F]'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <UserCircle className="w-10 h-10 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-extrabold text-gray-800 tracking-wide whitespace-nowrap">
            {user?.name || 'Guest'}
          </span>
        </div>
      </nav>

      <main className="flex-1 bg-gradient-to-br from-[#014CB3] to-[#60C10F] p-8 md:p-12">
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-8 items-start">
          <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-gray-300 flex items-center justify-center">
                <UserCircle className="w-full h-full text-gray-500 bg-white" />
              </div>
              <div>
                <h1 className="font-black text-white text-3xl tracking-tight">{title}</h1>
                <p className="text-sm text-white/80 mt-1">Use a photo whenever possible so the AI can add an image similarity helper after the core report data.</p>
              </div>
            </div>

            {message ? <div className="mb-4 rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">{message}</div> : null}
            {error ? <div className="mb-4 rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Type</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className="w-full bg-white text-gray-800 rounded-lg h-10 px-4 text-sm outline-none cursor-pointer flex items-center justify-between"
                  >
                    <span>{formData.type}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showTypeDropdown ? (
                    <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {ITEM_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, type }));
                            setShowTypeDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-[#60C10F]/20 text-gray-800 text-sm"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Name / Model</label>
                <input
                  type="text"
                  placeholder="Type Here"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg h-10 px-4 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-white text-xs md:text-sm ml-1 font-medium">Age *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Age"
                    value={formData.age}
                    onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                    className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg h-10 px-4 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white text-xs md:text-sm ml-1 font-medium">Gender</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowGenderDropdown(!showGenderDropdown)}
                      className="w-full bg-white text-gray-800 rounded-lg h-10 px-4 text-sm outline-none cursor-pointer flex items-center justify-between"
                    >
                      <span>{formData.gender}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showGenderDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showGenderDropdown ? (
                      <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        {['Male', 'Female'].map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, gender }));
                              setShowGenderDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#60C10F]/20 text-gray-800 text-sm"
                          >
                            {gender}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Photo Upload</label>
                <div className="relative">
                  <input type="file" ref={fileInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg h-10 px-4 text-sm outline-none cursor-pointer pr-10 flex items-center justify-between"
                  >
                    <span>{photoPreview ? 'Photo uploaded ✓' : 'Upload photo'}</span>
                    <ImageIcon className="text-gray-600 w-4 h-4" />
                  </button>
                  {photoPreview ? (
                    <div className="mt-2 bg-white rounded-lg p-2 shadow-inner border border-gray-200">
                      <div className="w-24 h-24 overflow-hidden rounded-lg">
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-white text-xs md:text-sm ml-1 font-medium">Last known location (address) *</label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Use current location
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search location"
                      value={searchLocation}
                      onChange={(e) => {
                        setSearchLocation(e.target.value);
                        if (!e.target.value.trim()) {
                          setLocationSuggestions([]);
                        }
                      }}
                      className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg h-10 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLocationSearch(searchLocation || formData.location)}
                    disabled={locationSearching}
                    className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#014CB3] disabled:opacity-60"
                  >
                    {locationSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {locationSearching ? 'Searching' : 'Search'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Selected address"
                    value={formData.location}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedLocation(null);
                      setLocationSuggestions([]);
                      setFormData((prev) => ({
                        ...prev,
                        location: value,
                        latitude: undefined,
                        longitude: undefined
                      }));
                    }}
                    className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg h-10 pl-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                    required
                  />
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                </div>
                {locationSuggestions.length ? (
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-2">
                    <div className="space-y-2">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.address}-${index}`}
                          type="button"
                          onClick={() => {
                            applyLocationSelection(suggestion);
                            setMessage('Address linked to the report successfully.');
                          }}
                          className="w-full rounded-xl bg-white/90 px-3 py-3 text-left text-sm font-semibold text-gray-800 transition hover:bg-white"
                        >
                          {suggestion.address}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {formData.latitude !== undefined && formData.longitude !== undefined ? (
                  <p className="text-xs text-white/75">Linked map point: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</p>
                ) : (
                  <p className="text-xs text-white/75">You can type an address, search for it, or use your current location. The report saves both the written address and coordinates whenever they are available.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Date / Time *</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateTime: e.target.value }))}
                    className="w-full bg-white text-gray-800 rounded-lg h-10 pl-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                    required
                  />
                  <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Clothes / Visual Notes *</label>
                <input
                  type="text"
                  placeholder="Blue jacket, black shoes..."
                  value={formData.clothesColor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clothesColor: e.target.value }))}
                  className="w-full bg-white text-gray-800 rounded-lg h-10 px-4 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                  required
                />
              </div>

              {isFoundMode ? (
                <div className="space-y-1">
                  <label className="text-white text-xs md:text-sm ml-1 font-medium">Condition Notes</label>
                  <input
                    type="text"
                    placeholder="Safe and responsive"
                    value={formData.conditionNotes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, conditionNotes: e.target.value }))}
                    className="w-full bg-white text-gray-800 rounded-lg h-10 px-4 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="text-white text-xs md:text-sm ml-1 font-medium">Description *</label>
                <textarea
                  rows={4}
                  placeholder="Describe the person or item in detail"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#60C10F]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-white text-[#014CB3] font-black tracking-wide shadow-lg hover:scale-[1.01] transition disabled:opacity-70"
              >
                {submitting ? 'Saving...' : isFoundMode ? 'Submit Found Report' : 'Submit Missing Report'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl text-white backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-2xl bg-white/15 p-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">AI-assisted image similarity</h2>
                  <p className="text-sm text-white/75">Report data stays primary. The photo adds a helper similarity score when both reports have analyzable images.</p>
                </div>
              </div>

              {aiAnalyzing ? (
                <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-5">
                  <p className="text-sm font-bold text-white">Analyzing photo with AI...</p>
                  <p className="text-xs text-white/70 mt-2">We are extracting the visual fingerprint so the image helper score is ready for this report.</p>
                </div>
              ) : formData.aiAnalysis ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-[#c9f0a2] bg-[#60C10F]/15 px-5 py-5">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/70 mb-2">AI visual match ready</p>
                    <p className="text-lg font-black text-white">{formData.aiAnalysis.summary}</p>
                    <p className="text-sm text-white/80 mt-2">AI visual profile ready — the photo can now support the report data with a helper similarity score.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Center structure</p>
                      <p className="mt-2 text-2xl font-black text-white">{Math.round((formData.aiAnalysis.features.centerEdgeDensity ?? formData.aiAnalysis.features.edgeDensity) * 100)}%</p>
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Structural detail</p>
                      <p className="mt-2 text-2xl font-black text-white">{Math.round(formData.aiAnalysis.features.edgeDensity * 100)}%</p>
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Aspect ratio</p>
                      <p className="mt-2 text-2xl font-black text-white">{formData.aiAnalysis.features.aspectRatio.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 bg-white/10 px-5 py-6 text-sm text-white/80">
                  Upload a clear photo and the app will generate an AI helper similarity profile before saving the report.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl text-white backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-black">AI preview</h2>
                  <p className="text-sm text-white/75">Preview likely matches before you submit the report.</p>
                </div>
                {aiPreviewLoading ? <span className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Scanning…</span> : null}
              </div>

              {topPreviewMatch ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="rounded-full border border-[#c9f0a2] bg-[#60C10F]/20 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white">
                        {Math.round(topPreviewMatch.score * 100)}% preview match
                      </span>
                      {topPreviewMatch.decision ? (
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white ${topPreviewMatch.manualReview ? 'border-[#fde68a]/70 bg-[#f59e0b]/20' : 'border-[#c9f0a2] bg-[#60C10F]/20'}`}>
                          {topPreviewMatch.decision}
                        </span>
                      ) : null}
                      {topPreviewMatch.usedOnlineAi ? (
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white">
                          Local face AI
                        </span>
                      ) : null}
                      {topPreviewMatch.usedAiPhotoPriority ? (
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white">
                          AI image assist
                        </span>
                      ) : null}
                      {topPreviewMatch.scoreBreakdown?.metadata !== undefined ? (
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white">
                          Data {Math.round(topPreviewMatch.scoreBreakdown.metadata * 100)}%
                        </span>
                      ) : null}
                      {topPreviewMatch.imageScore !== undefined ? (
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] uppercase text-white">
                          Image {Math.round(topPreviewMatch.imageScore * 100)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xl font-black text-white">{topPreviewMatch.otherCase.displayName}</p>
                    <p className="text-sm text-white/70 mt-1">{topPreviewMatch.otherCase.referenceCode} • {topPreviewMatch.otherCase.type}</p>
                    <p className="text-sm text-white/90 mt-3 leading-relaxed">{topPreviewMatch.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(topPreviewMatch.scoreBreakdown || {}) as Array<[string, number | undefined]>).map(([key, value]) => (
                      value !== undefined ? (
                        <div key={key} className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{key}</p>
                          <p className="mt-2 text-2xl font-black text-white">{Math.round(value * 100)}%</p>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/20 bg-white/10 px-5 py-6 text-sm text-white/80">
                  Upload a photo to run a live AI preview against saved reports.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl text-white backdrop-blur-xl">
              <h2 className="text-2xl font-black mb-4">Location preview</h2>
              <div className="h-72 rounded-3xl overflow-hidden bg-white/60">
                <DynamicMap
                  center={[selectedLocation?.lat ?? formData.latitude ?? 30.0444, selectedLocation?.lng ?? formData.longitude ?? 31.2357]}
                  marker={[selectedLocation?.lat ?? formData.latitude ?? 30.0444, selectedLocation?.lng ?? formData.longitude ?? 31.2357]}
                />
              </div>
              <p className="text-sm text-white/80 mt-4">{formData.location || selectedLocation?.address || 'Search or type an address to improve location-aware matching.'}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReportMissingPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[#014CB3] text-white flex items-center justify-center font-bold text-lg">
          Loading report form...
        </div>
      )}
    >
      <ReportMissingContent />
    </Suspense>
  );
}
