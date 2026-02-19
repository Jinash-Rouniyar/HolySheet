import React, { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import celinainterface from '../assets/celinainterface.png';

const Hero = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/app');
  };

  const heroRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      
      const { clientX, clientY } = e;
      const { left, top, width, height } = heroRef.current.getBoundingClientRect();
      
      const x = (clientX - left) / width;
      const y = (clientY - top) / height;
      
      heroRef.current.style.setProperty('--mouse-x', `${x}`);
      heroRef.current.style.setProperty('--mouse-y', `${y}`);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section 
      ref={heroRef}
      className="relative min-h-screen pt-20 pb-16 flex flex-col items-center justify-center overflow-hidden grid-spreadsheet"
      style={{ 
        '--mouse-x': '0.5', 
        '--mouse-y': '0.5' 
      } as React.CSSProperties}
    >
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-green-50 to-white -z-10"
        style={{
          backgroundImage: `radial-gradient(
            circle at calc(var(--mouse-x) * 100%) calc(var(--mouse-y) * 100%),
            rgba(40, 167, 69, 0.2),
            rgba(255, 255, 255, 0) 50%
          )`
        }}
      />
      
      {/* Floating Spreadsheet Cells */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/5 w-32 h-32 cell rounded-lg mix-blend-multiply filter blur-sm opacity-60 animate-float" />
        <div className="absolute top-1/3 right-1/4 w-40 h-20 cell rounded-lg mix-blend-multiply filter blur-sm opacity-60 animate-float animation-delay-2000" />
        <div className="absolute bottom-1/4 right-1/3 w-24 h-24 cell rounded-lg mix-blend-multiply filter blur-sm opacity-60 animate-float animation-delay-4000" />
        <div className="absolute bottom-1/3 left-1/3 w-48 h-16 cell rounded-lg mix-blend-multiply filter blur-sm opacity-60 animate-float animation-delay-3000" />
      </div>
      
      <div className="container px-4 mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Headline */}
          <h1 className="animate-reveal stagger-1 text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight tracking-tight max-w-5xl">
            The AI Spreadsheet Assistant
            <span className="relative inline-block px-2">
              <span className="relative z-10 text-gradient">Celina</span>
              <svg className="absolute -bottom-2 left-0 w-full z-0 text-green-100" viewBox="0 0 418 13" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M2.17913 12.25C38.6789 5.91667 145.68 -3.81666 195.18 3.75001C244.68 11.3167 370.68 6.31666 416.18 2.75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          
          {/* Subheadline */}
          <p className="animate-reveal stagger-2 text-lg md:text-xl text-gray-600 max-w-3xl font-light mb-4">
            Built to make your spreadsheet use more productive. Celina is the best way to use spreadsheet with AI.
          </p>
          
          {/* CTA Button */}
          <div className="animate-reveal stagger-3 mt-6">
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="rounded-full px-10 py-7 font-medium text-base shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
            >
              Try It Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Product Screenshot */}
        <div className="animate-reveal stagger-5 relative mt-20 max-w-5xl mx-auto">
          <div className="cell rounded-2xl overflow-hidden shadow-2xl p-2">
            <img 
              src={celinainterface} 
              alt="Celina AI Interface" 
              className="w-full h-auto object-cover rounded-xl"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero; 