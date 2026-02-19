import React from 'react';
import { ArrowRight, Github, Linkedin, Mail, ExternalLink } from 'lucide-react';

const projects = [
  {
    title: 'Celina AI Spreadsheet',
    description:
      'An AI-powered spreadsheet assistant that lets you query, visualize, and manipulate data using natural language.',
    href: '/spreadsheet',
    tags: ['React', 'Express', 'OpenAI', 'Syncfusion'],
  },
];

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white">
      <header className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Hi, I'm <span className="text-indigo-400">Your Name</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Developer &amp; builder. Here are some of the things I've made.
        </p>

        <div className="flex justify-center gap-5 mt-8">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <Github size={22} />
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <Linkedin size={22} />
          </a>
          <a href="mailto:you@example.com" className="text-gray-400 hover:text-white transition-colors">
            <Mail size={22} />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-6">
          Projects
        </h2>

        <div className="grid gap-6">
          {projects.map((project) => (
            <a
              key={project.title}
              href={project.href}
              className="group block rounded-2xl border border-gray-800 bg-gray-900/60 p-6 hover:border-indigo-500/50 hover:bg-gray-900 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                    {project.title}
                    <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-gray-400 mt-2 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight
                  size={20}
                  className="mt-1 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0"
                />
              </div>
            </a>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Your Name. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
