
import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    content: "SheetSage has revolutionized how I work with data. I've cut my analysis time in half, and I can now focus on insights rather than struggling with formulas.",
    author: "Sarah Johnson",
    role: "Data Analyst, Acme Inc.",
    avatar: "https://randomuser.me/api/portraits/women/32.jpg"
  },
  {
    content: "The natural language interface is a game-changer. I can ask complex questions about my data and get instant answers, even though I'm not a spreadsheet expert.",
    author: "Michael Chen",
    role: "Marketing Director, TechStart",
    avatar: "https://randomuser.me/api/portraits/men/46.jpg"
  },
  {
    content: "We've implemented SheetSage across our finance team, and the ROI has been incredible. Tasks that took days now take minutes, and the insights are far more valuable.",
    author: "Jessica Williams",
    role: "CFO, Global Solutions",
    avatar: "https://randomuser.me/api/portraits/women/65.jpg"
  },
  {
    content: "I was skeptical about AI tools, but SheetSage changed my mind. It's like having a data scientist and Excel expert right at my fingertips, 24/7.",
    author: "David Rodriguez",
    role: "Business Analyst, Retail Plus",
    avatar: "https://randomuser.me/api/portraits/men/29.jpg"
  },
  {
    content: "The formula assistant alone is worth the price. It's saved me countless hours of searching online for the right formula combinations.",
    author: "Emma Thompson",
    role: "Project Manager, Creative Studios",
    avatar: "https://randomuser.me/api/portraits/women/22.jpg"
  },
  {
    content: "As a teacher, I use spreadsheets to track student progress. SheetSage has made this so much easier, giving me more time to focus on what matters - the students.",
    author: "Robert Kim",
    role: "High School Teacher",
    avatar: "https://randomuser.me/api/portraits/men/42.jpg"
  }
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-24 relative">
      {/* Background Elements */}
      <div className="absolute left-0 right-0 top-0 h-40 bg-gradient-to-b from-gray-50 to-transparent -z-10"></div>
      
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="flex justify-center mb-4">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Loved by Data Professionals
          </h2>
          <p className="text-lg text-gray-600">
            Join thousands of satisfied users who've transformed their spreadsheet workflow.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              
              <p className="text-gray-700 mb-6">"{testimonial.content}"</p>
              
              <div className="flex items-center gap-3">
                <img 
                  src={testimonial.avatar} 
                  alt={testimonial.author} 
                  className="w-12 h-12 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <h4 className="font-semibold">{testimonial.author}</h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
