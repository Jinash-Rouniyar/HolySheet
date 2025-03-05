
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    period: "Free forever",
    description: "Perfect for individuals just getting started with AI spreadsheet tools.",
    features: [
      "Natural language queries",
      "Basic data analysis",
      "Up to 5 spreadsheets",
      "Standard visualizations",
      "Community support"
    ],
    highlighted: false,
    buttonText: "Start for Free"
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For professionals who need more power and advanced features.",
    features: [
      "Everything in Starter",
      "Advanced formula generation",
      "Unlimited spreadsheets",
      "Custom visualizations",
      "Data cleaning automation",
      "Priority support",
      "Team collaboration"
    ],
    highlighted: true,
    buttonText: "Get Pro"
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "tailored solution",
    description: "For organizations that need custom solutions and premium support.",
    features: [
      "Everything in Pro",
      "Custom AI training",
      "Dedicated account manager",
      "SSO & advanced security",
      "API access",
      "On-premises option",
      "24/7 premium support"
    ],
    highlighted: false,
    buttonText: "Contact Sales"
  }
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600">
            Choose the plan that fits your needs. No hidden fees or commitments.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <div 
              key={index}
              className={`rounded-2xl p-8 border transition-all ${
                plan.highlighted 
                  ? 'border-primary/50 shadow-xl relative bg-white' 
                  : 'border-gray-200 shadow-sm bg-white/80 hover:shadow-md'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white text-sm font-medium py-1 px-3 rounded-full">
                  Most Popular
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-display font-bold">{plan.price}</span>
                  <span className="text-gray-500 mb-1">{plan.period}</span>
                </div>
                <p className="text-gray-600">{plan.description}</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className={`h-5 w-5 mt-0.5 ${plan.highlighted ? 'text-primary' : 'text-gray-500'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className={`w-full rounded-lg py-6 ${
                  plan.highlighted 
                    ? 'bg-primary hover:bg-primary/90' 
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-500">
            Need a custom solution? <a href="#" className="text-primary hover:underline">Contact our sales team</a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
