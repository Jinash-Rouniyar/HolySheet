import React from 'react';
import { 
  Twitter, 
  Linkedin, 
  Github, 
  Mail 
} from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-50 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="flex items-center mb-4">
              <span className="text-xl font-bold text-primary">Celina</span>
              <span className="text-xl font-bold ml-1">AI</span>
            </div>
            <p className="text-gray-600 mb-4">
              Transforming spreadsheets with the power of artificial intelligence.
            </p>
            <div className="flex space-x-4">
              <button className="text-gray-400 hover:text-primary transition-colors">
                <Twitter size={20} />
              </button>
              <button className="text-gray-400 hover:text-primary transition-colors">
                <Linkedin size={20} />
              </button>
              <button className="text-gray-400 hover:text-primary transition-colors">
                <Github size={20} />
              </button>
              <button className="text-gray-400 hover:text-primary transition-colors">
                <Mail size={20} />
              </button>
            </div>
          </div>
          
          {/* Product */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-gray-600 hover:text-primary transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-gray-600 hover:text-primary transition-colors">How It Works</a></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Pricing</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Testimonials</button></li>
            </ul>
          </div>
          
          {/* Resources */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><button className="text-gray-600 hover:text-primary transition-colors">Documentation</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">API Reference</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Blog</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Community</button></li>
            </ul>
          </div>
          
          {/* Company */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Company</h3>
            <ul className="space-y-2">
              <li><button className="text-gray-600 hover:text-primary transition-colors">About Us</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Careers</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Contact</button></li>
              <li><button className="text-gray-600 hover:text-primary transition-colors">Press Kit</button></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              &copy; {currentYear} Celina AI. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <button className="text-gray-500 hover:text-primary text-sm transition-colors">Privacy Policy</button>
              <button className="text-gray-500 hover:text-primary text-sm transition-colors">Terms of Service</button>
              <button className="text-gray-500 hover:text-primary text-sm transition-colors">Cookie Policy</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 