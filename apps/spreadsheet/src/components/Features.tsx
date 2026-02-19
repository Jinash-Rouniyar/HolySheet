import React from 'react';
import { 
  MessageSquare, 
  BarChart, 
  Lightbulb,
  Globe
} from 'lucide-react';

const features = [
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Natural Language Commands",
    description: "Ask questions about your data in plain English and get instant answers. No more complex formulas."
  },
  {
    icon: <Lightbulb className="h-6 w-6" />,
    title: "Formula Assistant",
    description: "Let AI generate complex formulas for you based on your requirements and data structure."
  },
  {
    icon: <BarChart className="h-6 w-6" />,
    title: "Visualizations",
    description: "Transform your data into beautiful, insightful charts with a single command."
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: "Fetch Data",
    description: "Enable Deep Search and ask to fetch data from the web and populate it into the spreadsheet."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-green-50/50 relative grid-spreadsheet">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-gradient">
            Features for Spreadsheet 
          </h2>
          <p className="text-lg text-gray-600">
            Celina combines the power of AI with your spreadsheets to help you work smarter, not harder.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="cell rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="p-3 mb-4 rounded-lg bg-primary/10 w-fit text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features; 