import React, { useState } from 'react';

const OPENCLAW_COMMAND = 'openclaw plugins install openclaw-contextualai';
const AGENT_COMPOSER_COMMAND =
  'brew install jinashrouniyar-268/agent-composer/agent';

function App() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = async (command: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="min-h-screen max-w-3xl mx-auto p-8 bg-[#FDFCFC] text-slate-900">
      <h1 className="text-2xl font-semibold tracking-tight mb-2 text-slate-900">Jinash Rouniyar</h1>
      <p className="mb-6 text-slate-600">
        Atlanta, GA |{' '}
        <a href="mailto:rouniyarjinash123@gmail.com" className="text-slate-900 underline hover:text-slate-700">rouniyarjinash123@gmail.com</a>
        {' | '}
        <a href="https://www.linkedin.com/in/jinash-rouniyar/" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">LinkedIn</a>
        {' | '}
        <a href="https://github.com/Jinash-Rouniyar" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">GitHub</a>
      </p>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Education</h2>
      <div className="mb-4 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div className="font-semibold text-slate-900">Georgia State University</div>
        <div className="text-xs tracking-wide text-slate-500 uppercase">
          Aug. 2023 – Apr. 2027
        </div>
      </div>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Experience</h2>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">Developer Relations Intern</span>
          <span className="mx-1">·</span>
          <span>Contextual AI</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          Aug. 2025 – May 2026
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4">
        <li className="text-slate-600">
          Developed and published official n8n community nodes for Contextual AI<br />
          npm: <a href="https://www.npmjs.com/package/n8n-nodes-contextualai" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">https://www.npmjs.com/package/n8n-nodes-contextualai</a><br />
          Sample workflows: <a href="https://n8n.io/creators/jinash/" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">https://n8n.io/creators/jinash/</a>
        </li>
        <li className="text-slate-600">Created Contextual AI website agent(coming soon) and documentation agent (<a href="https://docs.contextual.ai/" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">Try it out</a>)</li>
        <li className="text-slate-600">Built Contextual AI OpenClaw Integration. Install the plugin:
          <div className="relative mt-1">
            <pre className="bg-white border border-slate-200 p-2 pr-20 rounded font-mono text-sm overflow-x-auto text-slate-900"><code>{OPENCLAW_COMMAND}</code></pre>
            <button
              type="button"
              onClick={() => handleCopy(OPENCLAW_COMMAND)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium rounded bg-slate-900 hover:bg-black text-white shadow-sm transition-colors"
            >
              {copiedCommand === OPENCLAW_COMMAND ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </li>
        <li className="text-slate-600">Built Agent Composer CLI in Go. Install it with:
          <div className="relative mt-1">
            <pre className="bg-white border border-slate-200 p-2 pr-20 rounded font-mono text-sm overflow-x-auto text-slate-900"><code>{AGENT_COMPOSER_COMMAND}</code></pre>
            <button
              type="button"
              onClick={() => handleCopy(AGENT_COMPOSER_COMMAND)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium rounded bg-slate-900 hover:bg-black text-white shadow-sm transition-colors"
            >
              {copiedCommand === AGENT_COMPOSER_COMMAND ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </li>
        <li className="text-slate-600">Integrated Contextual AI RAG tools with open-source platforms like <a href="https://docs.contextual.ai/integration/tooling#crewai" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">Crew AI</a>, <a href="https://docs.contextual.ai/integration/databases#weaviate" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">Weaviate</a>, and <a href="https://docs.contextual.ai/integration/databases#chroma" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline hover:text-slate-700">ChromaDB</a></li>
      </ul>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">Software Engineer Intern</span>
          <span className="mx-1">·</span>
          <span>AI2 Research Lab</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          Aug. 2023 – Aug. 2025
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4 text-slate-600">
        <li>Led the development of Django based LMS application leveraging open-source SOTA models through LangChain and ChromaDB to track and analyze learning behaviors of 300+ students across 10 different courses</li>
        <li>Implemented RESTful API leveraging Ollama to fetch and manipulate data from Llama-3.3 model, optimizing inference by 40% for server-side data processing and integration</li>
        <li>Built a pipeline to integrate student records from PostgreSql database with CoreNLP, Gemma 3, and Pyvis to analyze student performance, automate feedback generation, leading to a 15% improvement in scores</li>
      </ul>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">Android App Developer</span>
          <span className="mx-1">·</span>
          <span>Ganance</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          Jan. 2025 – Mar. 2025
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4 text-slate-600">
        <li>Utilized Kotlin and Android Jetpack Compose to develop the official smart watch companion app for Atlanta based startup</li>
        <li>Implemented Bluetooth Low Energy (BLE) to establish persistent background connection with the hardware device</li>
        <li>Established connection with Google Health and Samsung Health to sync health data across the app and store the persistent information in Firestore</li>
      </ul>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">FrontEnd Developer Intern</span>
          <span className="mx-1">·</span>
          <span>National STEM Honor Society</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          Jul. 2021 – Apr. 2022
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4 text-slate-600">
        <li>Developed dynamic SPAs using React and Next.js to enable smooth user interaction with 25+ teaching resources</li>
        <li>Utilized Object-Oriented Programming principles to streamline client-side UI component management and implemented Search Engine Optimization, reducing load times by 30% and improving client search visibility</li>
      </ul>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Skills</h2>
      <p className="mb-4 text-slate-600">
        <strong className="text-slate-900">Languages:</strong> Python, Java, JavaScript, TypeScript, Go<br />
        <strong className="text-slate-900">Frameworks & Libraries:</strong> Node.js, React, NextJS, Angular, Spring Boot, Django, Express, Tailwind<br />
        <strong className="text-slate-900">Databases:</strong> Redis, MongoDB, PostgreSQL, ChromaDB, Neo4j<br />
        <strong className="text-slate-900">DevOps and Cloud Platforms/Tools:</strong> Docker, Kubernetes, Git, BitBucket, CI/CD, AWS<br />
      </p>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Projects</h2>

      <p className="mb-2 text-slate-600">
        <a
          href="https://devpost.com/software/title-for-now"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          Livia
        </a>{' '}
        – Inspired by Black Mirror, we built a virtual city where AI avatars live, interact, and form relationships on behalf of real people. Uses agentic search to book real-world first dates when a strong match is found.
      </p>

      <p className="mb-2 text-slate-600">
        <a
          href="https://www.jinash.com/spreadsheet"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          Celina
        </a>{' '}
        – AI spreadsheet that lets users fetch, populate, and visualize data using natural language.
      </p>

      <p className="mb-2 text-slate-600">
        <a
          href="https://devpost.com/software/eva-jmb5et"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          E.V.A
        </a>{' '}
        – Language companion that provides real-time grammar and pronunciation feedback through immersive conversations.
      </p>

      <p className="mb-2 text-slate-600">
        <a
          href="https://devpost.com/software/lucy-x0wd86"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          L.U.C.Y
        </a>{' '}
        – Robotics RAG system using Boston Dynamics Spot to detect and surface potential threats from the environment.
      </p>

      <p className="mb-2 text-slate-600">
        <a
          href="https://devfolio.co/projects/alex-augmented-linguistic-emulation-xpert-e72f"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          A.L.E.X
        </a>{' '}
        – Voice-first experience to talk to historical figures that mimic their voice, accent, and speaking style.
      </p>
      <p className="mb-6 text-slate-600">
        <a
          href="https://devpost.com/software/m-e-r-a-meta-emulated-reality-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-900 underline hover:text-slate-700"
        >
          M.E.R.A
        </a>{' '}
        – Immersive conversational experience with 3D models that replicate the speaking style and mannerisms of historical figures.
      </p>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Achievements</h2>

      <ul className="list-disc pl-6 mb-4 text-slate-600 text-sm">
        <li>3rd Runner Up, Context Engineering Hackathon by Theory Ventures</li>
        <li>1st Prize, Generative AI, Hacklytics 2024; featured on Microsoft’s official LinkedIn and Microsoft ATL pages.</li>
        <li>1st Prize, AI Funhouse, HackGT 2024</li>
        <li>Recieved invitation to showcase my project at Asia's Largest Tech Festival, Techfest at IIT Bombay</li>
        <li>1st Prize, Hack with Chroma, CalHacks 11.0</li>
        <li>Top 75 Product of the Week on Product Hunt</li>
      </ul>

      <h2 className="text-lg font-semibold tracking-tight mb-2 text-slate-900">Activities</h2>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">Georgia Tech CreateX Startup Launch Program</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          May. 2024 – Aug. 2024
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4 text-slate-600">
        <li>Led the development of conversational AI tutors to facilitate active learning in high school students</li>
        <li>Presented the prototype of the application at the Mississippi Foreign Language Association (MFLA) Fall conference</li>
      </ul>

      <div className="mb-2 flex items-baseline justify-between gap-6 text-sm text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">Undergraduate Research Assistant</span>
          <span className="mx-1">·</span>
          <span>Department of Criminal Justice</span>
        </div>
        <div className="text-xs tracking-wide text-slate-500 uppercase text-right">
          Aug. 2023 – Jul. 2025
        </div>
      </div>
      <ul className="list-disc pl-6 mb-4 text-slate-600">
        <li>Coded targeted behavior and maintained inter-rater reliability for behavior coding to improve the recidivism for parolees</li>
        <li>Managed citations using EndNote, R for data analytics, Qualtrics to prepare and submit behavior coding sheets</li>
      </ul>
    </div>
  );
}

export default App;
