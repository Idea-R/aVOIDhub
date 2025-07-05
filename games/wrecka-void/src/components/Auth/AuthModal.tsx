import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignup, setIsSignup] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            {isSignup ? 'Join the Battle' : 'Welcome Back'}
          </h2>
          <p className="text-gray-400">
            {isSignup 
              ? 'Create your account to start wreaking havoc'
              : 'Sign in to continue your destruction'
            }
          </p>
        </div>

        {isSignup ? (
          <SignupForm onToggleMode={() => setIsSignup(false)} />
        ) : (
          <LoginForm onToggleMode={() => setIsSignup(true)} />
        )}
      </div>
    </div>
  );
}