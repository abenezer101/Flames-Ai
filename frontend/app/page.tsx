import { AppGeneratorSection } from '@/app/components/app-generator-section';
import { WebGLShader } from '@/app/components/webgl-shader';
import { Header } from '@/app/components/header';

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 text-white">
      {/* Header */}
      <Header />
      
      {/* WebGL Shader Background */}
      <WebGLShader />
      
      {/* Glassmorphism Overlay */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_45%),_radial-gradient(circle_at_bottom,_rgba(236,72,153,0.1),_transparent_40%)] backdrop-blur-[80px]" />
      
      {/* Content */}
      <div className="relative z-10 pt-16">
        <AppGeneratorSection />
      </div>
    </div>
  );
}
