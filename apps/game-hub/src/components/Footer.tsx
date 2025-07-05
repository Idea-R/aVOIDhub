import { Heart, Mail, Bug, Twitter } from 'lucide-react'

const Footer = () => {
  return (
    <footer className="bg-black/50 border-t border-white/10 mt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-8">
          
          {/* Brand Section */}
          <div>
            <h4 className="text-white font-bold mb-3">aVOIDgame.io</h4>
            <p className="text-gray-400 text-sm mb-3">A gaming platform by MadXent</p>
            <p className="text-gray-400 text-xs">
              Love our games? Want more cursor-based challenges? Support the creator and help us build more amazing aVOID games.
            </p>
          </div>
          
          {/* Support Section */}
          <div>
            <h4 className="text-white font-semibold mb-3">Support</h4>
            <div className="space-y-2">
              <button className="flex items-center space-x-2 text-pink-400 hover:text-pink-300 transition-colors text-sm">
                <Heart className="w-4 h-4" />
                <span>Support the Dev</span>
              </button>
              <a 
                href="mailto:support@madxent.com" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                <span>Contact</span>
              </a>
              <a 
                href="mailto:business@madxent.com" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                <span>Business Inquiries</span>
              </a>
            </div>
          </div>
          
          {/* Help Section */}
          <div>
            <h4 className="text-white font-semibold mb-3">Help</h4>
            <div className="space-y-2">
              <a 
                href="mailto:bugs@madxent.com" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Bug className="w-4 h-4" />
                <span>Report Bugs</span>
              </a>
              <a 
                href="mailto:support@madxent.com" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                <span>Get Help</span>
              </a>
              <a 
                href="/games" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <span>Game Library</span>
              </a>
            </div>
          </div>
          
          {/* Follow Us Section */}
          <div>
            <h4 className="text-white font-semibold mb-3">Follow Us</h4>
            <div className="space-y-2">
              <a 
                href="https://x.com/Xentrilo" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                <Twitter className="w-4 h-4" />
                <span>Twitter/X</span>
              </a>
              <a 
                href="https://github.com/MadXent" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <span>GitHub</span>
              </a>
              <a 
                href="https://discord.gg/madxent" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors text-sm"
              >
                <span>Discord</span>
              </a>
            </div>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 MadXent. All rights reserved. | 
            <span className="text-purple-400 ml-1">More aVOID games coming soon!</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer 