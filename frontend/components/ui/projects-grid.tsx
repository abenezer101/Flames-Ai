"use client";

import { useState, useEffect } from "react";
import { Store, Globe, User, MessageCircle, BarChart3, Shield, Code, Plus } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  createdAt: string;
  type: string;
  template: string;
}

const getTemplateIcon = (template: string) => {
  const icons = {
    'simple-dashboard': <BarChart3 className="h-4 w-4" />,
    'landing-page': <Globe className="h-4 w-4" />,
    'blog': <Code className="h-4 w-4" />,
    'ecommerce': <Store className="h-4 w-4" />,
    'portfolio': <User className="h-4 w-4" />,
    'social-feed': <MessageCircle className="h-4 w-4" />,
    'auth-app': <Shield className="h-4 w-4" />,
    'api-dashboard': <Code className="h-4 w-4" />,
  };
  return icons[template as keyof typeof icons] || <Code className="h-4 w-4" />;
};

const getTemplateTitle = (template: string, prompt: string) => {
  // Try to extract a meaningful title from the prompt, or use template name
  const templateNames = {
    'simple-dashboard': 'Dashboard',
    'landing-page': 'Landing Page', 
    'blog': 'Blog',
    'ecommerce': 'E-commerce Store',
    'portfolio': 'Portfolio',
    'social-feed': 'Social Feed',
    'auth-app': 'Auth App',
    'api-dashboard': 'API Documentation',
  };
  
  // Use first few words of prompt as title if available
  if (prompt && prompt.length > 0) {
    const words = prompt.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }
  
  return templateNames[template as keyof typeof templateNames] || 'Project';
};

export function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      console.log('🔄 Fetching projects from /api/v1/projects');
      const response = await fetch('/api/v1/projects');
      
      if (response.ok) {
        const data = await response.json();
        
        const formattedProjects = data.projects?.map((project: any) => ({
          id: project.id,
          title: getTemplateTitle(project.template, project.prompt),
          description: project.prompt || 'AI generated application',
          icon: getTemplateIcon(project.template),
          createdAt: formatDate(project.createdAt),
          type: project.template,
          template: project.template
        })) || [];
        
        setProjects(formattedProjects);
      } else {
        const errorText = await response.text();
        console.error('❌ Projects API error:', response.status, errorText);
        setProjects([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      const weeks = Math.floor(diffInHours / 168);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
  };

  // Don't render anything if no projects and not loading
  if (!isLoading && projects.length === 0) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Your Projects</h2>
          <p className="text-zinc-400">Loading your AI-generated applications...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[14rem] rounded-[1.25rem] border-[0.75px] border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Your Projects</h2>
      </div>
      
      {projects.length <= 3 ? (
        // Simple grid for 1-3 projects
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <GridItem
              key={project.id}
              area=""
              icon={project.icon}
              title={project.title}
              description={project.description}
              createdAt={project.createdAt}
              projectId={project.id}
            />
          ))}
        </div>
      ) : (
        // Complex grid for 4+ projects
        <ul className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:max-h-[34rem] xl:grid-rows-2">
          <GridItem
            area="md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]"
            icon={projects[0]?.icon}
            title={projects[0]?.title}
            description={projects[0]?.description}
            createdAt={projects[0]?.createdAt}
            projectId={projects[0]?.id}
          />
          
          <GridItem
            area="md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]"
            icon={projects[1]?.icon}
            title={projects[1]?.title}
            description={projects[1]?.description}
            createdAt={projects[1]?.createdAt}
            projectId={projects[1]?.id}
          />
          
          <GridItem
            area="md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]"
            icon={projects[2]?.icon}
            title={projects[2]?.title}
            description={projects[2]?.description}
            createdAt={projects[2]?.createdAt}
            projectId={projects[2]?.id}
          />
          
          <GridItem
            area="md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]"
            icon={projects[3]?.icon}
            title={projects[3]?.title}
            description={projects[3]?.description}
            createdAt={projects[3]?.createdAt}
            projectId={projects[3]?.id}
          />
          
          {projects[4] && (
            <GridItem
              area="md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]"
              icon={projects[4]?.icon}
              title={projects[4]?.title}
              description={projects[4]?.description}
              createdAt={projects[4]?.createdAt}
              projectId={projects[4]?.id}
            />
          )}
        </ul>
      )}
    </div>
  );
}

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  createdAt?: string;
  projectId?: string;
}

const GridItem = ({ area, icon, title, description, createdAt, projectId }: GridItemProps) => {
  const handleClick = () => {
    if (projectId) {
      // Navigate to the project builder page
      window.location.href = `/builder?jobId=${projectId}`;
    }
  };
  return (
    <li className={cn("min-h-[14rem] list-none", area)}>
      <div 
        onClick={handleClick}
        className="relative h-full rounded-[1.25rem] border-[0.75px] border-white/10 p-2 md:rounded-[1.5rem] md:p-3 cursor-pointer group hover:border-white/20 transition-all duration-200"
      >
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={3}
        />
        
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-[0.75px] bg-zinc-900/80 backdrop-blur-sm p-6 shadow-sm group-hover:bg-zinc-800/80 transition-all duration-200">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="flex items-start justify-between">
              <div className="w-fit rounded-lg border-[0.75px] border-white/20 bg-zinc-800/60 p-2">
                {icon}
              </div>
              {createdAt && (
                <span className="text-xs text-zinc-500">{createdAt}</span>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="pt-0.5 text-xl leading-[1.375rem] font-semibold font-sans tracking-[-0.04em] md:text-2xl md:leading-[1.875rem] text-balance text-zinc-100">
                {title}
              </h3>
              <p className="font-sans text-sm leading-[1.125rem] md:text-base md:leading-[1.375rem] text-zinc-400">
                {description}
              </p>
            </div>
          </div>
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-700/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl" />
        </div>
      </div>
    </li>
  );
};
