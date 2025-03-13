import React from 'react';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CTA = () => {
  const navigate = useNavigate();
  
  const handleRedirect = () => {
    navigate('/app');
  };
  
  return (
    <section className="py-20 relative overflow-hidden grid-spreadsheet">
      <div className="container mx-auto px-4 max-w-5xl relative">
        <div className="cell rounded-3xl p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 max-w-2xl mx-auto text-gradient">
            Ready to Transform Your Spreadsheet Experience?
          </h2>
          
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Start saving time and gaining deeper insights with Celina AI. No credit card required.
          </p>
          
          <div className="flex justify-center">
            <Button 
            size="lg" 
            onClick={handleRedirect}
            className="rounded-full px-8 py-6 font-medium shadow-lg shadow-primary/20">
              Try Celina Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA; 