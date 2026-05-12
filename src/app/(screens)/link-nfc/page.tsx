'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';

export default function LinkNFCPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    type: 'Child',
    name: '',
    photo: null as string | null,
    location: '',
    dateTime: '',
    emergencyContact: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    const currentReport = localStorage.getItem('currentReport');
    if (currentReport) {
      try {
        const parsed = JSON.parse(currentReport);
        setFormData(prev => ({
          ...prev,
          type: parsed.type || prev.type,
          name: parsed.name || prev.name,
          photo: parsed.photo || prev.photo,
          location: parsed.location || prev.location,
          dateTime: parsed.dateTime || prev.dateTime,
          emergencyContact: parsed.emergencyContact || prev.emergencyContact,
          description: parsed.description || prev.description,
          notes: parsed.notes || prev.notes
        }));
      } catch (err) {
        console.error('Invalid currentReport data:', err);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleLinkNFC = () => {
    // هنا بيتم ربط البيانات بشريحة الـ NFC
    localStorage.setItem('linkedNFCData', JSON.stringify(formData));
    console.log('NFC Data Linked:', formData);
    alert('NFC Tag Linked Successfully!');
  };

  return (
    // الخلفية: تدرج من الأخضر لليسار إلى الأزرق لليمين
    <div className="min-h-screen bg-gradient-to-r from-[#4CA50E] to-[#014CB3] flex items-center justify-center p-6 md:p-12 font-sans select-none">
      
      <div className="max-w-6xl w-full flex flex-col md:flex-row gap-12 md:gap-24 items-center">
        
        {/* ── الجانب الأيسر: الفورم (البيانات) ── */}
        <div className="w-full md:w-1/2 space-y-4">
          
          {/* Type */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Type</label>
            <div className="relative">
              <select name="type" value={formData.type} onChange={handleChange} className="w-full h-11 px-4 rounded-xl outline-none text-gray-700 text-sm bg-white appearance-none cursor-pointer">
                <option value="Child">Child</option>
                <option value="Elderly">Elderly</option>
                <option value="Pet">Pet</option>
                <option value="Item">Item</option>
              </select>
              <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Name/Model */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Name/Model</label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Type Here" className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white placeholder-gray-400" />
          </div>

          {/* Optional Photo */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Optional Photo</label>
            <div onClick={() => fileInputRef.current?.click()} className="w-full h-11 px-4 bg-white rounded-xl flex items-center justify-between cursor-pointer">
              <span className={`text-sm ${formData.photo ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                {formData.photo ? "Photo Attached ✅" : "Upload photo"}
              </span>
              <input type="file" hidden ref={fileInputRef} onChange={handleImage} accept="image/*" />
            </div>
          </div>

          {/* Last known location */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Last known location (address)</label>
            <input name="location" value={formData.location} onChange={handleChange} placeholder="Type Here" className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white placeholder-gray-400" />
          </div>

          {/* Date/Time */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Date/Time</label>
            <input name="dateTime" value={formData.dateTime} onChange={handleChange} className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white" />
          </div>

          {/* Emergency Contact */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Emergency Contact</label>
            <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="010xxxxxxxx" className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white placeholder-gray-400" />
          </div>

          {/* Description */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Description (age /model)</label>
            <input name="description" value={formData.description} onChange={handleChange} placeholder="Type Here" className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white placeholder-gray-400" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-gray-900 font-bold text-xs mb-1 block opacity-80">Notes(may be useful to the finder)</label>
            <input name="notes" value={formData.notes} onChange={handleChange} placeholder="Type Here" className="w-full h-11 px-4 rounded-xl outline-none text-gray-800 text-sm bg-white placeholder-gray-400" />
          </div>

        </div>

        {/* ── الجانب الأيمن: الرسمة وزر الـ NFC ── */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center gap-12">
          
          {/* Illustration Box */}
          {/* تأكد من إضافة صورة الـ NFC في مجلد public/photos باسم nfc-illustration.png */}
          <div className="relative w-80 h-64 md:w-96 md:h-72 flex items-center justify-center">
             {/* دي مجرد Placeholder لو الصورة مش موجودة عندك حالياً */}
             <img 
               src="/photos/15.png" 
               alt="NFC Phone Scan" 
               className="w-full h-full object-contain drop-shadow-2xl"
               onError={(e) => {
                 // Fallback in case image is missing
                 (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3600/3600027.png';
               }}
             />
          </div>

          {/* Link NFC Button */}
          <button 
            onClick={handleLinkNFC}
            className="bg-[#60C10F] text-[#014CB3] px-14 py-3 rounded-xl font-black text-xl flex items-center justify-center gap-2 transition-all shadow-[0_6px_0_#3d7a0a] active:shadow-none active:translate-y-1.5"
          >
            Link <span className="text-[#014CB3] font-black">NFC</span>
          </button>

        </div>

      </div>
    </div>
  );
}
