'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, User, Phone, Calendar, Check, ImagePlus, X, KeyRound, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';

type AuthMode = 'login' | 'signin';
type SignUpStep = 'form' | 'verify';
type ForgotStep = 'idle' | 'request' | 'verify';

interface UnifiedAuthScreenProps {
  mode?: AuthMode;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export const UnifiedAuthScreen: React.FC<UnifiedAuthScreenProps> = ({ mode = 'login' }) => {
  const router = useRouter();
  const { setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthMode>(mode);
  const [currentLanguage, setCurrentLanguage] = useState<'EN' | 'AR'>('EN');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('form');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('idle');
  const [registerCode, setRegisterCode] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    dateOfBirth: '',
    avatarUrl: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('preferred-language');
      if (savedLanguage === 'EN' || savedLanguage === 'AR') {
        setCurrentLanguage(savedLanguage);
      }
    }
  }, []);

  const translations = useMemo(
    () => ({
      EN: {
        login: 'Login',
        signIn: 'Sign up',
        username: 'Username / Email',
        enterUsername: 'Enter your username or email',
        password: 'Password',
        enterPassword: 'Enter your password',
        confirmPassword: 'Confirm password',
        confirmYourPassword: 'Confirm your password',
        rememberMe: 'Remember me',
        emailAddress: 'Email Address',
        enterEmail: 'Enter your email address',
        fullName: 'Full Name',
        enterFullName: 'Enter your full name',
        phoneNumber: 'Phone Number',
        enterPhone: 'Enter your phone number',
        dateOfBirth: 'Date of Birth',
        createPassword: 'Create password',
        creating: 'Creating account...',
        loggingIn: 'Logging in...',
        accountCreated: 'Account created successfully.',
        profilePhoto: 'Optional profile photo',
        uploadPhoto: 'Upload photo',
        removePhoto: 'Remove photo',
        forgotPassword: 'Forgot password?',
        backToLogin: 'Back to login',
        sendCode: 'Send code',
        sendingCode: 'Sending code...',
        verificationCode: 'Verification code',
        enterCode: 'Enter the 6-digit code',
        verifyAndCreate: 'Verify & create account',
        verifying: 'Verifying...',
        requestResetCode: 'Request reset code',
        resetPassword: 'Reset password',
        newPassword: 'New password',
        emailCodeSent: 'A code was sent to your email.',
        verifyEmailFirst: 'Verify your email to finish creating the account.'
      },
      AR: {
        login: 'تسجيل الدخول',
        signIn: 'إنشاء حساب',
        username: 'اسم المستخدم / البريد',
        enterUsername: 'أدخل اسم المستخدم أو البريد الإلكتروني',
        password: 'كلمة المرور',
        enterPassword: 'أدخل كلمة المرور',
        confirmPassword: 'تأكيد كلمة المرور',
        confirmYourPassword: 'أكد كلمة المرور',
        rememberMe: 'تذكرني',
        emailAddress: 'البريد الإلكتروني',
        enterEmail: 'أدخل بريدك الإلكتروني',
        fullName: 'الاسم الكامل',
        enterFullName: 'أدخل اسمك الكامل',
        phoneNumber: 'رقم الهاتف',
        enterPhone: 'أدخل رقم الهاتف',
        dateOfBirth: 'تاريخ الميلاد',
        createPassword: 'إنشاء كلمة مرور',
        creating: 'جارٍ إنشاء الحساب...',
        loggingIn: 'جارٍ تسجيل الدخول...',
        accountCreated: 'تم إنشاء الحساب بنجاح.',
        profilePhoto: 'صورة شخصية اختيارية',
        uploadPhoto: 'رفع صورة',
        removePhoto: 'إزالة الصورة',
        forgotPassword: 'هل نسيت كلمة المرور؟',
        backToLogin: 'العودة لتسجيل الدخول',
        sendCode: 'إرسال الكود',
        sendingCode: 'جارٍ إرسال الكود...',
        verificationCode: 'كود التحقق',
        enterCode: 'أدخل الكود المكون من 6 أرقام',
        verifyAndCreate: 'تحقق وأنشئ الحساب',
        verifying: 'جارٍ التحقق...',
        requestResetCode: 'إرسال كود الاستعادة',
        resetPassword: 'إعادة تعيين كلمة المرور',
        newPassword: 'كلمة المرور الجديدة',
        emailCodeSent: 'تم إرسال كود إلى بريدك الإلكتروني.',
        verifyEmailFirst: 'تحقق من البريد أولًا لإكمال إنشاء الحساب.'
      }
    }),
    []
  );

  const t = translations[currentLanguage];
  const isRTL = currentLanguage === 'AR';

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const resetForgotFlow = () => {
    setForgotStep('idle');
    setForgotCode('');
    setForgotPassword('');
    setForgotConfirmPassword('');
    setForgotEmail('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
  };

  const handleLogin = async () => {
    const identifier = formData.username.trim() || formData.email.trim();
    if (!identifier || !formData.password) {
      setError('Please enter your email/username and password.');
      return;
    }

    setIsSubmitting(true);
    resetMessages();
    try {
      const response = await api.login({
        emailOrUsername: identifier,
        password: formData.password,
        rememberMe
      });
      setUser(response.user);
      router.push('/selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    try {
      const avatarUrl = await fileToDataUrl(file);
      handleInputChange('avatarUrl', avatarUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the selected image.');
    }
  };

  const handleRegisterRequestCode = async () => {
    if (!formData.fullName.trim()) return setError('Please enter your full name.');
    if (!formData.email.trim()) return setError('Please enter your email address.');
    if (!formData.password) return setError('Please create a password.');
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');

    setIsSubmitting(true);
    resetMessages();
    try {
      const response = await api.requestRegisterCode({
        name: formData.fullName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        avatarUrl: formData.avatarUrl || undefined,
        password: formData.password,
        rememberMe
      });
      setSignUpStep('verify');
      setSuccess(response.message || t.emailCodeSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegister = async () => {
    if (!formData.email.trim() || !registerCode.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    resetMessages();
    try {
      const response = await api.verifyRegisterCode({
        email: formData.email,
        code: registerCode,
        rememberMe
      });
      setSuccess(t.accountCreated);
      setUser(response.user);
      router.push('/selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify your email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotRequestCode = async () => {
    if (!forgotEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setIsSubmitting(true);
    resetMessages();
    try {
      const response = await api.requestPasswordResetCode({ email: forgotEmail });
      setForgotStep('verify');
      setSuccess(response.message || t.emailCodeSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotResetPassword = async () => {
    if (!forgotEmail.trim() || !forgotCode.trim() || !forgotPassword) {
      setError('Please complete all password reset fields.');
      return;
    }
    if (forgotPassword !== forgotConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    resetMessages();
    try {
      const response = await api.resetPassword({
        email: forgotEmail,
        code: forgotCode,
        password: forgotPassword
      });
      setSuccess(response.message);
      resetForgotFlow();
      setForgotOpen(false);
      setFormData((prev) => ({ ...prev, username: forgotEmail, password: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'login') {
      if (forgotOpen) {
        if (forgotStep === 'verify') {
          await handleForgotResetPassword();
        } else {
          await handleForgotRequestCode();
        }
        return;
      }
      await handleLogin();
      return;
    }

    if (signUpStep === 'verify') {
      await handleVerifyRegister();
      return;
    }
    await handleRegisterRequestCode();
  };

  const toggleAuthTab = (tab: AuthMode) => {
    setActiveTab(tab);
    resetMessages();
    setSignUpStep('form');
    setRegisterCode('');
    setForgotOpen(false);
    resetForgotFlow();
  };

  return (
    <div className="w-full min-h-screen overflow-hidden bg-gray-50 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex min-h-screen">
        <div className="hidden flex-1 items-center justify-center p-12 lg:flex">
          <div className="w-full max-w-xl">
            <Image src="/photos/12.png" alt="AI Tech Illustration" width={600} height={700} className="h-auto w-full object-contain" priority />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-12">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-sky-50 to-emerald-50 p-5 shadow-2xl sm:p-8 lg:p-10">
            <div className="absolute end-4 top-4 sm:end-6 sm:top-6">
              <Logo width={100} height={33} />
            </div>

            <div className="mb-6 mt-10 flex justify-center sm:mb-8 sm:mt-12">
              <div className="relative flex rounded-full bg-green-500 p-1">
                <button
                  onClick={() => toggleAuthTab('login')}
                  className={`rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-300 sm:px-6 sm:py-3 sm:text-sm ${activeTab === 'login' ? 'bg-blue-500 text-white shadow-lg' : 'text-white hover:text-gray-100'}`}
                >
                  {t.login}
                </button>
                <button
                  onClick={() => toggleAuthTab('signin')}
                  className={`rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-300 sm:px-6 sm:py-3 sm:text-sm ${activeTab === 'signin' ? 'bg-blue-500 text-white shadow-lg' : 'text-white hover:text-gray-100'}`}
                >
                  {t.signIn}
                </button>
              </div>
            </div>

            {success ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
            {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {activeTab === 'login' ? (
                forgotOpen ? (
                  <>
                    <div className="rounded-3xl border border-blue-100 bg-white/80 p-4 text-sm text-gray-600">
                      <div className="mb-1 flex items-center gap-2 font-semibold text-gray-800"><ShieldCheck className="h-4 w-4 text-blue-600" /> {forgotStep === 'verify' ? t.resetPassword : t.forgotPassword}</div>
                      <p>{forgotStep === 'verify' ? 'Enter the code sent to your email, then choose a new password.' : 'Enter your email address to receive a real password reset code.'}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">{t.emailAddress}</label>
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 flex-shrink-0 text-gray-400" />
                        <input type="email" placeholder={t.enterEmail} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                      </div>
                    </div>

                    {forgotStep === 'verify' ? (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">{t.verificationCode}</label>
                          <div className="flex items-center gap-3">
                            <KeyRound className="h-5 w-5 flex-shrink-0 text-gray-400" />
                            <input type="text" inputMode="numeric" maxLength={6} placeholder={t.enterCode} value={forgotCode} onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm tracking-[0.35em] transition-colors focus:border-blue-500 focus:outline-none" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">{t.newPassword}</label>
                          <div className="flex items-center gap-3">
                            <Lock className="h-5 w-5 flex-shrink-0 text-gray-400" />
                            <div className="relative flex-1">
                              <input type={showResetPassword ? 'text' : 'password'} placeholder={t.enterPassword} value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)} className="w-full rounded-full border-2 border-gray-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                              <button type="button" onClick={() => setShowResetPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showResetPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">{t.confirmPassword}</label>
                          <div className="flex items-center gap-3">
                            <Lock className="h-5 w-5 flex-shrink-0 text-gray-400" />
                            <div className="relative flex-1">
                              <input type={showResetConfirmPassword ? 'text' : 'password'} placeholder={t.confirmYourPassword} value={forgotConfirmPassword} onChange={(e) => setForgotConfirmPassword(e.target.value)} className="w-full rounded-full border-2 border-gray-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                              <button type="button" onClick={() => setShowResetConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showResetConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}

                    <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#60C10F] py-3.5 font-bold text-white shadow-lg disabled:opacity-60 hover:bg-[#52a80d]">
                      {isSubmitting ? (forgotStep === 'verify' ? t.verifying : t.sendingCode) : (forgotStep === 'verify' ? t.resetPassword : t.requestResetCode)}
                    </button>

                    <button type="button" onClick={() => { setForgotOpen(false); resetForgotFlow(); resetMessages(); }} className="w-full rounded-full border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      {t.backToLogin}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">{t.username}</label>
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 flex-shrink-0 text-gray-400" />
                        <input type="text" placeholder={t.enterUsername} value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">{t.password}</label>
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 flex-shrink-0 text-gray-400" />
                        <div className="relative flex-1">
                          <input type={showPassword ? 'text' : 'password'} placeholder={t.enterPassword} value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} className="w-full rounded-full border-2 border-gray-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex cursor-pointer items-center">
                        <div className="relative">
                          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
                          <div className={`h-5 w-5 rounded border-2 transition-all duration-200 ${rememberMe ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                            {rememberMe && <Check className="absolute left-0.5 top-0.5 h-3 w-3 text-white" />}
                          </div>
                        </div>
                        <span className="ms-2 text-sm text-gray-600">{t.rememberMe}</span>
                      </label>
                      <button type="button" onClick={() => { setForgotOpen(true); setForgotStep('request'); setForgotEmail(formData.username || formData.email); resetMessages(); }} className="text-start text-sm font-semibold text-blue-600 hover:text-blue-700 sm:text-end">
                        {t.forgotPassword}
                      </button>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#60C10F] py-3.5 font-bold text-white shadow-lg disabled:opacity-60 hover:bg-[#52a80d]">
                      {isSubmitting ? t.loggingIn : t.login}
                    </button>
                  </>
                )
              ) : signUpStep === 'verify' ? (
                <>
                  <div className="rounded-3xl border border-blue-100 bg-white/80 p-4 text-sm text-gray-600">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-gray-800"><ShieldCheck className="h-4 w-4 text-blue-600" /> {t.verifyEmailFirst}</div>
                    <p>{formData.email}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.verificationCode}</label>
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="text" inputMode="numeric" maxLength={6} placeholder={t.enterCode} value={registerCode} onChange={(e) => setRegisterCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm tracking-[0.35em] transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#60C10F] py-3.5 font-bold text-white shadow-lg disabled:opacity-60 hover:bg-[#52a80d]">
                    {isSubmitting ? t.verifying : t.verifyAndCreate}
                  </button>
                  <button type="button" onClick={() => setSignUpStep('form')} className="w-full rounded-full border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Edit details
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.fullName}</label>
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="text" placeholder={t.enterFullName} value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.username}</label>
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="text" placeholder={t.enterUsername} value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.emailAddress}</label>
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="email" placeholder={t.enterEmail} value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.phoneNumber}</label>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="text" placeholder={t.enterPhone} value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.dateOfBirth}</label>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} className="flex-1 rounded-full border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.profilePhoto}</label>
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white/80 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                          {formData.avatarUrl ? <img src={formData.avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-gray-400" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
                            <ImagePlus className="h-4 w-4" /> {t.uploadPhoto}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarUpload(e.target.files?.[0])} />
                          </label>
                          {formData.avatarUrl ? (
                            <button type="button" onClick={() => handleInputChange('avatarUrl', '')} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
                              <X className="h-4 w-4" /> {t.removePhoto}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.createPassword}</label>
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <div className="relative flex-1">
                        <input type={showPassword ? 'text' : 'password'} placeholder={t.enterPassword} value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} className="w-full rounded-full border-2 border-gray-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">{t.confirmPassword}</label>
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <div className="relative flex-1">
                        <input type={showConfirmPassword ? 'text' : 'password'} placeholder={t.confirmYourPassword} value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)} className="w-full rounded-full border-2 border-gray-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-blue-500 focus:outline-none" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#60C10F] py-3.5 font-bold text-white shadow-lg disabled:opacity-60 hover:bg-[#52a80d]">
                    {isSubmitting ? t.sendingCode : t.sendCode}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
