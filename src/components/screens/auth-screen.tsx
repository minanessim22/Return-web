"use client";

import React, { useState } from 'react';
import './auth-screen.css';
import { Logo } from '@/components/Logo';

type AuthMode = 'login' | 'signup';

interface AuthScreenProps {
  mode?: AuthMode;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ mode = 'login' }) => {
  const [authMode, setAuthMode] = useState<AuthMode>(mode);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="auth-screen-wrapper">
      {/* Left Side - Tech Illustration */}
      <div className="auth-left-side">
        <img src="/photos/12.png" alt="Return Tech Illustration" className="tech-illustration" />
      </div>

      {/* Right Side - Gradient Background with Card */}
      <div className="auth-right-side">
        {/* Auth Card */}
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo-top">
            <Logo />
          </div>

          {authMode === 'login' ? (
            // LOGIN FORM
            <>
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">Login to your account</p>

              <form className="auth-form-main">
                {/* Username */}
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    className="form-control"
                  />
                </div>

                {/* Password */}
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="form-control"
                  />
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="form-options">
                  <label className="remember-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  
                </div>

                {/* Login Button */}
                <button type="submit" className="btn-primary btn-gradient-blue-green">
                  Login
                </button>

                {/* Bottom Link */}
                <p className="auth-footer-link">
                  Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); }}>Sign up</a>
                </p>
              </form>
            </>
          ) : (
            // SIGN UP FORM
            <>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">Sign up to get started</p>

              <form className="auth-form-main">
                {/* Email Address */}
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="form-control"
                  />
                </div>

                {/* Full Name */}
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className="form-control"
                  />
                </div>

                {/* Phone Number */}
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    className="form-control"
                  />
                </div>

                {/* Date of Birth */}
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    placeholder="mm/dd/yyyy"
                    className="form-control"
                  />
                </div>

                {/* Password */}
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    placeholder="Create a password"
                    className="form-control"
                  />
                </div>

                {/* Confirm Password */}
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    className="form-control"
                  />
                </div>

                {/* Sign Up Button */}
                <button type="submit" className="btn-primary btn-gradient-blue-green">
                  Sign Up
                </button>

                {/* Bottom Link */}
                <p className="auth-footer-link">
                  Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); }}>Login</a>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
