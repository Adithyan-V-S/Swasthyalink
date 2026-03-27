import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Image from "../components/common/Image";
import { EXTERNAL_IMAGES } from "../constants/images";

const features = [
  {
    title: "Secure & Private",
    description: "Enterprise-grade security with end-to-end encryption ensures your health data remains private and secure.",
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 3.657 10.857 8.87 12.574a.75.75 0 00.76 0c5.213-1.717 8.87-6.632 8.87-12.574 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.515 11.209 11.209 0 01-7.877-3.08zM8.25 9.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0z" clipRule="evenodd" />
      </svg>
    ),
    color: "bg-indigo-600",
    hoverBg: "group-hover:bg-indigo-500"
  },
  {
    title: "Family Access",
    description: "Control who can access your health records with granular permissions for family members and emergency contacts.",
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" clipRule="evenodd" />
      </svg>
    ),
    color: "bg-green-600",
    hoverBg: "group-hover:bg-green-500"
  },
  {
    title: "Quick Access",
    description: "QR code-based instant access to your medical records for healthcare providers and emergency situations.",
    icon: (
      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18A3 3 0 018.25 21H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
      </svg>
    ),
    color: "bg-purple-600",
    hoverBg: "group-hover:bg-purple-500"
  }
];

const Home = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-[80vh] bg-slate-50 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-10 -left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-20 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-20 left-40 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4 py-16">
        <div className="text-center max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-700 mb-8 animate-fade-in tracking-tight">
            Welcome to Swasthyalink
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
            Your trusted partner in digital healthcare. Manage health records, appointments, and family access with enterprise-grade security.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Link
              to="/register"
              className="relative group inline-block px-10 py-4 bg-indigo-600 text-white rounded-full text-lg font-bold shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
            >
              <span className="relative z-10">Get Started Free</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link
              to="/about"
              className="inline-block px-10 py-4 glass-effect text-indigo-700 rounded-full text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 border border-indigo-200 hover:bg-white"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
          <Image
            src={EXTERNAL_IMAGES.HERO_HEALTHCARE}
            alt="Healthcare professionals"
            className="relative z-10 w-72 h-72 md:w-96 md:h-96 rounded-2xl shadow-2xl hover:scale-[1.02] transition-transform duration-500 object-cover border-4 border-white"
            fallbackSrc={EXTERNAL_IMAGES.HERO_HEALTHCARE}
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-24 px-4 bg-white/30 backdrop-blur-sm border-t border-white" ref={sectionRef}>
        <div className="max-w-6xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
              Why Choose Swasthyalink?
            </h2>
            <div className="h-1.5 w-24 bg-gradient-to-r from-indigo-600 to-blue-500 mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`group relative p-8 rounded-3xl bg-white/40 backdrop-blur-md border border-white/50 shadow-xl transition-all duration-700 ease-out transform
                  ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}
                  hover:scale-[1.05] hover:-translate-y-2 hover:bg-white/80 hover:shadow-2xl hover:shadow-indigo-500/10
                `}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                {/* Gradient Glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className={`w-16 h-16 ${feature.color} ${feature.hoverBg} rounded-2xl flex items-center justify-center mb-8 transform transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-lg shadow-indigo-200`}>
                  {feature.icon}
                </div>
                
                <h3 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight group-hover:text-indigo-700 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                  {feature.description}
                </p>
                
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                  <Link to="/about" className="text-indigo-600 font-bold inline-flex items-center group/link">
                    Learn More 
                    <svg className="w-5 h-5 ml-2 transform group-hover/link:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className={`text-center mt-20 transition-all duration-1000 delay-700 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Link 
              to="/register" 
              className="inline-flex items-center px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all duration-300 shadow-xl hover:shadow-indigo-500/40 transform hover:-translate-y-1"
            >
              Explore Features
              <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
