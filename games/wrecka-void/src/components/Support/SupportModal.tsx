import React from 'react';
import { X, Heart, Twitter, DollarSign } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-pink-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-pink-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Thanks for Playing!</h2>
          <p className="text-gray-300">I hope you liked it.</p>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-gray-300 text-center">
            If you really like this game, there's going to be many more aVOID games coming out in the coming days. 
            Stay tuned for a lot of fun, and if you feel so inclined, feel free to support us so we can keep working on these.
          </p>
        </div>

        <div className="space-y-4">
          {/* Social */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <Twitter className="w-5 h-5 mr-2 text-blue-400" />
              Follow for Updates
            </h3>
            <a
              href="https://x.com/Xentrilo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              <Twitter className="w-4 h-4" />
              <span>@Xentrilo</span>
            </a>
          </div>

          {/* Support Options */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-400" />
              Support Development
            </h3>
            <div className="space-y-2">
              <a
                href="https://paypal.me/xentrilo"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm text-center"
              >
                PayPal: paypal.me/xentrilo
              </a>
              <a
                href="https://venmo.com/Xentrilo"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm text-center"
              >
                Venmo: @Xentrilo
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}