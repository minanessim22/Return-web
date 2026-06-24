'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, Database, Loader2, Save, ShieldCheck, UserCircle, X } from 'lucide-react';
import { api, type MeResponse } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { DeleteAccountDialog } from '@/components/dashboard/DeleteAccountDialog';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function InputField({
  placeholder,
  value,
  onChange,
  type = 'text',
  readOnly = false
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      readOnly={readOnly}
      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all ${
        readOnly
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500 opacity-85'
          : 'border-[#c9d7ff] bg-white text-slate-700 placeholder:text-slate-400 focus:border-[#60C10F] focus:ring-2 focus:ring-[#60C10F]/15'
      }`}
    />
  );
}

type Translations = Record<string, string>;

export function ProfileSettingsPanel({ t }: { t: Translations }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDialogError, setDeleteDialogError] = useState('');
  const [stats, setStats] = useState<MeResponse['stats'] | null>(null);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    avatarUrl: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const tr = (key: string, fallback: string) => t[key] || fallback;

  const populate = async () => {
    setLoading(true);
    try {
      const response = await api.me();
      setStats(response.stats);
      setForm({
        name: response.user.name || '',
        username: response.user.username || '',
        email: response.user.email || '',
        phone: response.user.phone || '',
        dateOfBirth: response.user.dateOfBirth ? response.user.dateOfBirth.slice(0, 10) : '',
        avatarUrl: response.user.avatarUrl || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void populate();
  }, []);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    try {
      const avatarUrl = await fileToDataUrl(file);
      updateField('avatarUrl', avatarUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the selected image.');
    }
  };

  const handleSave = async () => {
    setMessage('');
    setError('');
    if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      await api.updateMe({
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
        avatarUrl: form.avatarUrl,
        currentPassword: form.newPassword ? form.currentPassword : undefined,
        newPassword: form.newPassword || undefined
      });
      await refreshUser();
      setIsEditing(false);
      setMessage('Profile updated successfully.');
      await populate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setMessage('');
    setError('');
    void populate();
  };

  const openDeleteDialog = () => {
    setDeletePassword('');
    setDeleteDialogError('');
    setMessage('');
    setError('');
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeleteDialogError('');
    setDeletePassword('');
  };

  const handleDeleteAccount = async () => {
    setError('');
    setMessage('');
    setDeleteDialogError('');
    if (!deletePassword) {
      setDeleteDialogError('Please enter your current password before deleting your account.');
      return;
    }

    setDeleting(true);
    try {
      await api.deleteMe({ currentPassword: deletePassword });
      setMessage('Account deleted successfully.');
      setDeleteDialogOpen(false);
      window.location.href = '/login';
    } catch (deleteError) {
      const messageText = deleteError instanceof Error ? deleteError.message : 'Unable to delete your account.';
      setDeleteDialogError(messageText);
      setError(messageText);
    } finally {
      setDeleting(false);
    }
  };

  const infoCards = useMemo(() => {
    return [
      { label: tr('nameLabel', 'Name:'), value: form.name || '—' },
      { label: tr('emailLabel', 'Email:'), value: form.email || '—' },
      { label: tr('telLabel', 'Tel:'), value: form.phone || '—' },
      { label: 'Username', value: form.username ? `@${form.username}` : '—' },
      { label: tr('dateBirth', 'Date of birth'), value: form.dateOfBirth || '—' },
      { label: 'Account ID', value: user?.id || '—' }
    ];
  }, [form.dateOfBirth, form.email, form.name, form.phone, form.username, tr, user?.id]);

  return (
    <div className="flex h-full flex-col gap-4 sm:gap-6 xl:flex-row">
      <aside className="flex w-full flex-col gap-4 xl:w-[300px]">
        <div className="rounded-[1.5rem] border border-white/10 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:rounded-[2rem] sm:p-6">
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-[#d8ecff] bg-slate-100 shadow-lg sm:h-32 sm:w-32">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={form.name || user?.name || 'Profile'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserCircle className="h-24 w-24 text-slate-400" />
              </div>
            )}
            <label className={`absolute bottom-1 right-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#014CB3] to-[#60C10F] text-white shadow-lg ${isEditing ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" disabled={!isEditing} onChange={(event) => void handleAvatarUpload(event.target.files?.[0])} />
            </label>
          </div>

          <div className="mt-4 text-center">
            <p className="text-lg font-black text-slate-800 sm:text-xl">{form.name || user?.name || 'RETURN user'}</p>
            <p className="mt-1 text-sm font-semibold text-[#60C10F]">@{form.username || user?.username || 'return-user'}</p>
            <p className="mt-2 break-all text-xs text-slate-500">{form.email || user?.email || '—'}</p>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-[#dbeafe] bg-gradient-to-br from-[#eff6ff] to-[#f0fdf4] p-4 text-sm text-slate-700">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Database sync</p>
            <div className="mt-3 space-y-2">
              <p><span className="font-black text-slate-800">Account ID:</span> {user?.id || '—'}</p>
              <p><span className="font-black text-slate-800">Status:</span> {user?.status || 'ACTIVE'}</p>
              <p><span className="font-black text-slate-800">Reports:</span> {stats?.reports ?? '—'}</p>
              <p><span className="font-black text-slate-800">Devices:</span> {stats?.devices ?? '—'}</p>
              <p><span className="font-black text-slate-800">Profiles:</span> {stats?.profiles ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-center gap-3 text-slate-700">
            <Database className="h-5 w-5 text-[#014CB3]" />
            <h3 className="text-lg font-black">{tr('information', 'Information')}</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {infoCards.map((card) => (
              <div key={card.label} className="rounded-[1.4rem] border border-[#dbeafe] bg-[#f8fbff] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-800">{card.value}</p>
              </div>
            ))}
          </div>

          <button onClick={openDeleteDialog} disabled={deleting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-600 disabled:opacity-60">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {deleting ? 'Deleting…' : tr('deleteAccount', 'Delete Account')}
          </button>
        </div>
      </aside>

      <section className="flex-1 rounded-[1.5rem] border border-white/10 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-800 sm:text-2xl">{tr('userSettings', 'User Settings')}</h2>
            <p className="mt-2 text-sm text-slate-500">Your personal information is editable here, including an optional profile photo that is saved to your account.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                disabled={loading}
                className="rounded-full bg-[#014CB3] px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-blue-800 disabled:opacity-60"
              >
                {tr('editProfile', 'Edit Profile')}
              </button>
            ) : (
              <>
                <button onClick={handleSave} className="inline-flex items-center gap-2 rounded-full bg-[#60C10F] px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-[#4da00b]">
                  <Save className="h-4 w-4" />
                  {tr('saveProfile', 'Save Profile')}
                </button>
                <button onClick={handleCancel} className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-300">
                  <X className="h-4 w-4" />
                  {tr('cancel', 'Cancel')}
                </button>
              </>
            )}
          </div>
        </div>

        {message ? <div className="mb-4 rounded-[1.5rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-[1.5rem] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {infoCards.map((card) => (
            <div key={`${card.label}-summary`} className="rounded-[1.5rem] border border-[#dbeafe] bg-gradient-to-br from-[#f8fbff] to-[#f0fdf4] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className="mt-3 break-all text-lg font-black text-slate-800">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[#014CB3]" />
            <h3 className="text-lg font-black text-slate-800">{tr('details', 'Details')}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">{tr('fullName', 'Full Name')}</label>
              <InputField placeholder="Full name" value={form.name} onChange={(value) => updateField('name', value)} readOnly={!isEditing} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Username</label>
              <InputField placeholder="username" value={form.username} onChange={(value) => updateField('username', value)} readOnly={!isEditing} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">{tr('email', 'Email')}</label>
              <InputField placeholder="email@example.com" value={form.email} onChange={(value) => updateField('email', value)} type="email" readOnly={!isEditing} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">{tr('telNumber', 'Phone number')}</label>
              <InputField placeholder="Phone number" value={form.phone} onChange={(value) => updateField('phone', value)} readOnly={!isEditing} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">{tr('dateBirth', 'Date of birth')}</label>
              <InputField placeholder="YYYY-MM-DD" value={form.dateOfBirth} onChange={(value) => updateField('dateOfBirth', value)} type="date" readOnly={!isEditing} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Optional avatar URL</label>
              <InputField placeholder="https://... or upload a photo" value={form.avatarUrl} onChange={(value) => updateField('avatarUrl', value)} readOnly={!isEditing} />
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[1.7rem] border border-[#dbeafe] bg-[#f8fbff] p-5">
          <div className="mb-3 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[#014CB3]" />
            <h3 className="text-lg font-black text-slate-800">{tr('password', 'Password')}</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500">{tr('changePassword', 'Change password')}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField placeholder={tr('putPassword', 'Put your password...')} value={form.currentPassword} onChange={(value) => updateField('currentPassword', value)} type="password" readOnly={!isEditing} />
            <InputField placeholder={tr('putNewPassword', 'Put your new password...')} value={form.newPassword} onChange={(value) => updateField('newPassword', value)} type="password" readOnly={!isEditing} />
            <div className="md:col-span-2">
              <InputField placeholder={tr('confirmNewPassword', 'Confirm new password...')} value={form.confirmNewPassword} onChange={(value) => updateField('confirmNewPassword', value)} type="password" readOnly={!isEditing} />
            </div>
          </div>
        </div>
      </section>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        password={deletePassword}
        deleting={deleting}
        error={deleteDialogError}
        title={tr('deleteAccount', 'Delete Account')}
        message="Enter your current password to delete the account immediately. Your reports will be closed and you will be signed out."
        passwordPlaceholder={tr('putPassword', 'Enter your password')}
        cancelLabel={tr('cancel', 'Cancel')}
        confirmLabel={tr('deleteAccount', 'Delete Account')}
        onPasswordChange={setDeletePassword}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
