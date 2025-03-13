import React from 'react';
import { ArrowRight } from 'lucide-react';
import workOne from '../assets/workOne.jpg';
import workTwo from '../assets/workTwo.jpg';
import chart from '../assets/chart.jpg';

const steps = [
  {
    number: "01",
    title: "Import your spreadsheet",
    description: "Import your .xlsx or .xls file or copy paste the data directly into the spreadsheet.",
    image: workOne
  },
  {
    number: "02",
    title: "Ask Questions in Plain English",
    description: "Simply type your question or computation you want it to do. 'Show me sales trends for last quarter' or 'Calculate the average of the High and Low'.",
    image: workTwo
  },
  {
    number: "03",
    title: "Get Instant Insights & Visualizations",
    description: "Celina analyzes your data and provides answers, charts, and recommendations instantly based on your queries.",
    image: chart
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background Elements - Spreadsheet Grid */}
      <div className="absolute inset-0 -z-10 grid-spreadsheet"></div>
      
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-gradient">
            How Celina Works
          </h2>
          <p className="text-lg text-gray-600">
            Get started in minutes and transform your spreadsheet workflow.
          </p>
        </div>
        
        <div className="space-y-24 md:space-y-32">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-12`}
            >
              {/* Content */}
              <div className="w-full md:w-1/2 space-y-4 cell p-8 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-display font-bold text-primary opacity-70">{step.number}</span>
                  <div className="w-20 h-[1.5px] bg-primary opacity-25"></div>
                </div>
                <h3 className="text-2xl lg:text-3xl font-display font-semibold">{step.title}</h3>
                <p className="text-gray-600 text-lg">{step.description}</p>
              </div>
              
              {/* Image */}
              <div className="w-full md:w-1/2">
                <div className="relative rounded-2xl overflow-hidden shadow-xl cell p-2 group">
                  <img 
                    src={step.image} 
                    alt={step.title} 
                    className="w-full h-auto object-cover rounded-xl group-hover:scale-105 transition-transform duration-700 ease-in-out"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-transparent opacity-40 mix-blend-overlay rounded-xl"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks; 