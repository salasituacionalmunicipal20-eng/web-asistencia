import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

// Componente decorativo para los destellos de luz de fondo
const GlowEffect = ({ className }) => (
  <div className={`absolute rounded-full pointer-events-none blur-[100px] md:blur-[150px] opacity-20 ${className}`}></div>
);

// Componente decorativo para los bordes brillantes
const ShineBorder = () => (
  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-amber/50 to-transparent"></div>
);

function App() {
  const [user, setUser] = useState(null);
  const [modalContent, setModalContent] = useState(null); 
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert("Error al iniciar sesión: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- LÓGICA DE PAGO SUMUP (CONECTADA) ---
  const handlePayment = async (planType) => {
    if (!user) {
      alert("Por favor, inicia sesión con Google primero para asociar tu membresía.");
      handleGoogleLogin();
      return;
    }

    setIsLoadingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('crear-pago-sumup', {
        body: { planType, userEmail: user.email }
      });

      if (error) throw error;
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert("Error al generar el enlace de pago.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con SumUp. Intenta de nuevo.");
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const legalDocs = {
    terminos: { title: "Términos Legales", text: "Aquí van los términos y condiciones del servicio AeroSocio..." },
    privacidad: { title: "Política de Privacidad", text: "Tus datos están encriptados y protegidos según la RGPD europea..." },
    cookies: { title: "Política de Cookies", text: "Usamos cookies estrictamente necesarias para la plataforma..." }
  };

  return (
    <div className="min-h-screen bg-[#08101a] text-white font-sans selection:bg-brand-amber selection:text-brand-navy relative overflow-hidden w-full block">
      
      {/* Luces de fondo dramáticas */}
      <GlowEffect className="w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-brand-amber -top-20 -left-20 md:-top-48 md:-left-48" />
      <GlowEffect className="w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-blue-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <GlowEffect className="hidden md:block w-[600px] h-[600px] bg-emerald-500 bottom-0 -right-48" />

      {/* Navbar con efecto Glassmorphism Super-Thin */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-brand-navy/80 border-b border-white/5">
        <div className="flex justify-between items-center p-4 md:px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <svg className="w-7 h-7 md:w-9 md:h-9 text-brand-amber drop-shadow-[0_0_8px_rgba(243,156,18,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h1 className="text-xl md:text-3xl font-extrabold tracking-tighter">Aero<span className="text-brand-amber">Socio</span></h1>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-full text-sm text-slate-300">
            <button onClick={() => scrollToSection('como-funciona')} className="px-5 py-2 rounded-full hover:bg-white/5 transition-colors">¿Cómo Funciona?</button>
            <button onClick={() => scrollToSection('membresia')} className="px-5 py-2 rounded-full hover:bg-white/5 transition-colors">Membresía VIP</button>
            <button onClick={() => scrollToSection('servicios')} className="px-5 py-2 rounded-full hover:bg-white/5 transition-colors">Servicios</button>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden md:block text-sm text-slate-300">Hola, {user.user_metadata?.full_name?.split(' ')[0] || 'Socio'}</span>
              <button onClick={handleLogout} className="bg-white/10 border border-white/20 text-white font-semibold py-2 px-4 md:px-6 rounded-full text-sm hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all">
                Salir
              </button>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} className="bg-transparent border border-brand-amber text-brand-amber md:border-white/10 md:text-white font-semibold py-2 px-4 md:px-8 rounded-full text-sm md:text-base hover:border-brand-amber hover:text-brand-amber flex items-center gap-2 transition-all duration-300">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Acceso Socios
            </button>
          )}
        </div>
      </nav>

      <main id="como-funciona" className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24 grid lg:grid-cols-[1.2fr,1fr] gap-10 md:gap-16 items-center">
        <div className="absolute inset-0 z-0 flex rounded-[40px] overflow-hidden border border-white/5">
          <div className="w-[60%] h-full bg-cover bg-left opacity-30" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1544016768-6820f8987107?q=80&w=2000)'}}></div>
          <div className="w-[40%] h-full bg-cover bg-right opacity-30" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1511191060931-df10b808f921?q=80&w=2000)'}}></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#08101a] via-[#08101a]/95 to-[#08101a]"></div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 md:gap-3 bg-brand-amber/10 border border-brand-amber/20 text-brand-amber font-bold px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm">
            <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-amber opacity-75"></span>
              <span className="relative inline-flex rounded-full h-full w-full bg-brand-amber"></span>
            </span>
            ÚLTIMAS 1.000 BALIZAS DGT DISPONIBLES
          </div>

          <h2 className="text-5xl sm:text-6xl md:text-7xl font-extrabold mb-4 leading-[1.1] tracking-tighter">
            El club <span className="text-transparent bg-clip-text bg-gradient-to-b from-brand-amber to-yellow-200">exclusivo</span> de Movilidad VIP.
          </h2>

          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mb-8">
            Gestionamos tu tranquilidad. Evita multas y organiza documentos en la nube. Únete hoy y llévate de regalo la nueva Baliza V16 conectada enviada a tu domicilio.
          </p>

          <div id="membresia" className="flex flex-col sm:flex-row gap-4 max-w-2xl mt-8">
            <div className="flex-1 p-5 md:p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-between">
              <div className="mb-6">
                <span className="text-xs font-bold tracking-widest text-slate-400">PLAN MENSUAL</span>
                <p className="text-4xl font-extrabold tracking-tight mt-1 text-white">€5 <span className="text-base font-normal text-slate-500">/mes</span></p>
                <p className="text-sm text-slate-400 mt-2">Acceso total a la plataforma y alertas.</p>
              </div>
              <button onClick={() => handlePayment('monthly')} disabled={isLoadingPayment} className="w-full bg-transparent text-white font-bold py-3 md:py-4 rounded-full hover:bg-white/10 transition-all border border-white/20 text-sm">
                {isLoadingPayment ? 'Cargando...' : 'Elegir Mensual'}
              </button>
            </div>
            
            <div className="flex-[1.3] relative group p-5 md:p-6 rounded-3xl bg-white/5 border border-brand-amber/50 backdrop-blur-md flex flex-col justify-between overflow-hidden shadow-[0_0_30px_rgba(243,156,18,0.1)]">
              <ShineBorder />
              <div className="absolute top-0 right-0 bg-brand-amber text-brand-navy text-[10px] md:text-xs font-bold px-4 py-1.5 rounded-bl-xl z-20">MÁS POPULAR</div>
              <div className="mb-6 relative z-10">
                <span className="text-xs font-bold tracking-widest text-brand-amber">PLAN ANUAL + REGALO</span>
                <p className="text-4xl md:text-5xl font-extrabold tracking-tight mt-1 text-white">€49 <span className="text-base font-normal text-slate-400">/año</span></p>
                <p className="text-sm text-green-400 mt-2 flex items-center gap-1 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> 
                  Ahorras 11€ + Baliza V16 Gratis
                </p>
              </div>
              <button onClick={() => handlePayment('annual')} disabled={isLoadingPayment} className="w-full relative z-10 bg-gradient-to-r from-brand-amber to-yellow-500 text-brand-navy font-extrabold py-3 md:py-4 rounded-full transition-transform transform hover:scale-[1.03] shadow-[0_5px_15px_rgba(243,156,18,0.4)] text-sm md:text-base">
                {isLoadingPayment ? 'Redirigiendo...' : 'Unirse y Pedir Baliza'}
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 group bg-cover bg-center h-[350px] md:h-[500px] rounded-3xl md:rounded-4xl border border-white/5 flex items-end p-6 md:p-10 overflow-hidden" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1596738140801-b7559ca5ca76?q=80&w=1000)'}}>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/70 to-transparent"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 bg-brand-amber/30 blur-3xl rounded-full"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="p-3 md:p-4 bg-brand-amber rounded-2xl shadow-xl shadow-brand-amber/20">
              <span className="text-3xl md:text-5xl">🚨</span>
            </div>
            <div>
              <div className="text-[10px] md:text-xs font-bold text-brand-amber bg-brand-amber/10 border border-brand-amber/20 inline-block px-3 py-1 rounded-full mb-2">INCLUIDA EN PLAN ANUAL</div>
              <h4 className="text-xl md:text-3xl font-extrabold tracking-tight">Baliza V16 DGT</h4>
              <p className="text-sm md:text-base text-slate-300 mt-1">Dispositivo homologado obligatorio (Valor €20).</p>
            </div>
          </div>
        </div>
      </main>

      <section id="servicios" className="bg-white/[0.02] backdrop-blur-xl py-20 md:py-32 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-20 max-w-3xl mx-auto space-y-2">
            <h3 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-4">Todo lo que incluye tu membresía</h3>
            <p className="text-slate-400 text-base md:text-xl leading-relaxed">Diseñado para que disfrutes del camino, nosotros nos ocupamos de los detalles.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {icon: '💻', title: 'Alertas Inteligentes', desc: 'Monitoreamos tu vehículo y te avisamos por WhatsApp antes de que caduque tu seguro o ITV para evitar multas de €200.', color: 'brand-amber', status: 'AHORRA EN MULTAS'},
              {icon: '✈️', title: 'Reclamación de Vuelos', desc: '¿Vuelo retrasado o cancelado? Nuestro equipo legal gestiona tu indemnización sin comisiones abusivas.', color: 'blue-500', status: 'SIN COMISIONES'},
              {icon: '📄', title: 'Gestión Documental', desc: 'Todos tus documentos del coche y conductor seguros y organizados encriptadamente en nuestra nube VIP.', color: 'emerald-500', status: 'SEGURIDAD TOTAL'}
            ].map((item, index) => (
              <div key={index} className="relative group p-6 md:p-10 rounded-3xl bg-brand-navy/60 border border-white/5 md:hover:border-brand-amber transition-all duration-300 md:hover:-translate-y-2 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-amber/10 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity blur-2xl"></div>
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-6 md:mb-8 border border-${item.color}/20 bg-${item.color}/10 text-2xl md:text-4xl`}>{item.icon}</div>
                <h4 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white tracking-tight">{item.title}</h4>
                <p className="text-sm md:text-base text-slate-400 leading-relaxed mb-6">{item.desc}</p>
                <div className={`text-[10px] md:text-xs font-bold text-${item.color} bg-${item.color}/10 border border-${item.color}/20 inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full`}>{item.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#04080e] py-10 md:py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-xs md:text-sm text-slate-500">
          <div className="flex items-center gap-2 md:gap-3 opacity-60">
            <span className="text-xl md:text-2xl">✈️</span>
            <span className="font-bold tracking-tight text-lg md:text-xl text-white">AeroSocio</span>
          </div>
          <p className="text-center">© 2026 AeroSocio ESPAÑA. Todos los derechos reservados.</p>
          <div className="flex gap-4 md:gap-6 justify-center md:justify-end">
            <button onClick={() => setModalContent(legalDocs.terminos)} className="hover:text-brand-amber transition-colors">Términos Legales</button>
            <button onClick={() => setModalContent(legalDocs.privacidad)} className="hover:text-brand-amber transition-colors">Privacidad</button>
            <button onClick={() => setModalContent(legalDocs.cookies)} className="hover:text-brand-amber transition-colors">Cookies</button>
          </div>
        </div>
      </footer>

      {modalContent && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-navy border border-white/10 rounded-3xl p-8 max-w-2xl w-full relative">
            <button onClick={() => setModalContent(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-3xl font-bold mb-6">{modalContent.title}</h3>
            <div className="text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              <p>{modalContent.text}</p>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setModalContent(null)} className="bg-brand-amber text-brand-navy font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-colors">Aceptar y Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;