import React, { useState, useEffect, useRef } from "react";

const policies = [
  {
    title: "Ayushman Bharat Yojana",
    description:
      "A flagship scheme aimed at providing health coverage to over 50 crore Indians, offering free treatment up to ₹5 lakh per family per year for secondary and tertiary care hospitalization.",
    link: "https://pmjay.gov.in/",
  },
  {
    title: "National Health Mission (NHM)",
    description:
      "NHM focuses on strengthening health systems, improving maternal and child health, and controlling communicable and non-communicable diseases across India.",
    link: "https://nhm.gov.in/",
  },
  {
    title: "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
    description:
      "Aims to provide assured, comprehensive, and quality antenatal care, free of cost, universally to all pregnant women on the 9th of every month.",
    link: "https://pmsma.nhp.gov.in/",
  },
  {
    title: "Mission Indradhanush",
    description:
      "An immunization initiative to ensure full vaccination for all children under the age of two and pregnant women against seven vaccine-preventable diseases.",
    link: "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=824&lid=220",
  },
];

const About = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getDirectionClass = (index) => {
    if (!isVisible) {
      switch (index) {
        case 0: return "-translate-x-full opacity-0 scale-90"; // Left
        case 1: return "translate-x-full opacity-0 scale-90";  // Right
        case 2: return "translate-y-full opacity-0 scale-90";  // Bottom
        case 3: return "-translate-y-full opacity-0 scale-90"; // Top
        default: return "opacity-0";
      }
    }
    return "translate-x-0 translate-y-0 opacity-100 scale-100";
  };

  return (
    <main className="min-h-[90vh] bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 px-4 py-16 flex flex-col items-center overflow-x-hidden">
      <section className="max-w-4xl w-full text-center mb-16 space-y-6">
        <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-600 mb-4 animate-fade-in">
          About Swasthyalink
        </h2>
        <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Swasthyalink is dedicated to empowering individuals with accessible healthcare information and digital tools. We believe in supporting the vision of a healthy India by aligning with key government health initiatives.
        </p>
      </section>

      <section className="max-w-5xl w-full" ref={sectionRef}>
        <h3 className="text-2xl font-bold text-slate-800 mb-10 text-center tracking-tight">
          Key Indian Government Health Policies
        </h3>
        
        <div className="grid gap-8 md:grid-cols-2 relative">
          {policies.map((policy, index) => (
            <div 
              key={policy.title} 
              className={`group relative bg-white/70 backdrop-blur-md rounded-2xl p-8 border border-white/40 shadow-xl transition-all duration-700 ease-out transform cursor-default
                ${getDirectionClass(index)}
                hover:shadow-2xl hover:scale-[1.03] hover:bg-white/90 hover:border-indigo-200
              `}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="h-1 w-20 bg-gradient-to-r from-indigo-500 to-blue-500 mb-6 rounded-full group-hover:w-full transition-all duration-500" />
                <h4 className="text-2xl font-bold text-indigo-900 mb-4 group-hover:text-indigo-700 transition-colors">
                  {policy.title}
                </h4>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {policy.description}
                </p>
                <a
                  href={policy.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors group/link"
                >
                  Learn More
                  <svg className="w-5 h-5 ml-2 transform group-hover/link:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default About;
