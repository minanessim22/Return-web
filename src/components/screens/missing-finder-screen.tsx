'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Logo } from '@/components/Logo';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ImageIcon, UserCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';

const DynamicMap = dynamic(() => import('@/components/Map'), { ssr: false });

export function MissingFinderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name: '', age: '', location: '', dateTime: '', clothesColor: '', description: '', photo: null as string | null });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Please enter a name or a clear identifier for the case.');
      return;
    }
    if (!formData.age.trim()) {
      setError('Age is required for every report.');
      return;
    }
    if (!formData.location.trim()) {
      setError('Address / location is required for every report.');
      return;
    }
    if (!formData.dateTime.trim()) {
      setError('Date / time is required for every report.');
      return;
    }
    if (!formData.clothesColor.trim()) {
      setError('Clothes / visual notes are required for every report.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required for every report.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await api.createMissing({
        fullName: formData.name,
        estimatedName: formData.name,
        age: Number(formData.age),
        locationText: formData.location,
        dateTime: formData.dateTime,
        clothesColor: formData.clothesColor,
        description: formData.description,
        images: formData.photo ? [formData.photo] : [],
        contactPhone: user?.phone || undefined,
        category: 'child'
      });

      const compatibility = {
        id: response.item.id,
        name: response.item.displayName,
        description: response.item.description || formData.description,
        location: response.item.locationText || formData.location,
        photo: response.item.primaryImage || formData.photo,
        dateTime: response.item.createdAt,
        status: response.item.status,
        referenceCode: response.item.referenceCode
      };

      localStorage.setItem('currentReport', JSON.stringify(compatibility));
      localStorage.setItem('lastReportData', JSON.stringify(compatibility));
      router.push(`/case-details?caseId=${response.item.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the report right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white overflow-x-hidden">
      <nav className="h-16 bg-white flex items-center justify-between px-6 shadow-sm z-50">
        <Logo width={110} height={36} />
        <div className="hidden md:flex gap-8 text-xs font-black uppercase text-gray-400">
          <Link href="/lost-dashboard">Home</Link>
          <Link href="/missing-finder" className="text-[#60C10F] border-b-2 border-[#60C10F]">Missing</Link>
          <Link href="/profile">Profile</Link>
        </div>
        <div className="flex items-center gap-2"><UserCircle className="w-8 h-8 text-gray-300" /><span className="text-xs font-black">{user?.name || 'RETURN USER'}</span></div>
      </nav>

      <main className="flex-1 bg-gradient-to-br from-[#014CB3] to-[#60C10F] p-8 flex items-center justify-center">
        <div className="max-w-6xl w-full flex flex-col md:flex-row gap-12 items-center">
          <div className="w-full max-w-md space-y-4 text-white">
            <h1 className="text-2xl font-black uppercase italic">Report Missing Case</h1>
            <div className="space-y-3">
              {error ? <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}
              <input onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Name/Model" className="w-full h-10 px-4 rounded-lg text-gray-800 outline-none" />
              <input type="number" min={0} onChange={(e) => setFormData({ ...formData, age: e.target.value })} placeholder="Age *" className="w-full h-10 px-4 rounded-lg text-gray-800 outline-none" />
              <input type="datetime-local" onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })} className="w-full h-10 px-4 rounded-lg text-gray-800 outline-none" />
              <input onChange={(e) => setFormData({ ...formData, clothesColor: e.target.value })} placeholder="Clothes / Visual Notes *" className="w-full h-10 px-4 rounded-lg text-gray-800 outline-none" />
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-10 px-4 bg-white rounded-lg flex items-center justify-between cursor-pointer text-gray-400">
                <span className={formData.photo ? 'text-green-600 font-bold' : ''}>{formData.photo ? 'Photo Attached ✅' : 'Upload photo'}</span>
                <ImageIcon className="w-4 h-4" /><input type="file" hidden ref={fileInputRef} onChange={handleImage} accept="image/*" />
              </div>
              <input onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Location" className="w-full h-10 px-4 rounded-lg text-gray-800 outline-none" />
              <textarea onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" className="w-full min-h-28 px-4 py-3 rounded-lg text-gray-800 outline-none" />
              <button type="button" disabled={submitting} onClick={handleSubmit} className="w-full py-4 bg-[#60C10F] text-white font-black rounded-xl shadow-lg mt-4 active:scale-95 transition-all uppercase disabled:opacity-60">{submitting ? 'Submitting...' : 'Submit Report'}</button>
            </div>
          </div>
          <div className="w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full border-8 border-[#014CB3]/30 overflow-hidden shadow-2xl relative"><DynamicMap /></div>
        </div>
      </main>
    </div>
  );
}
