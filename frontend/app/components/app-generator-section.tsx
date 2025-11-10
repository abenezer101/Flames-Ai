"use client";

import {
	ChatInput,
	ChatInputSubmit,
	ChatInputTextArea,
} from "@/components/ui/chat-input";
import { useAnimatedPlaceholder } from "@/hooks/use-animated-placeholder";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ProjectsGrid } from "@/components/ui/projects-grid";

function AppGeneratorSection() {
	const [value, setValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const animatedPlaceholder = useAnimatedPlaceholder();
	const router = useRouter();

	const handleSubmit = async () => {
		if (!value.trim()) {
			return;
		}
		setIsLoading(true);
		
		try {
            const response = await fetch('/api/v1/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: value,
                    // Use the Next.js blog template - you can make this dynamic later
                    template: 'gcp-nextjs-blog',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to start generation.' }));
                toast.error(`Error: ${errorData.message}`);
                setIsLoading(false);
                return;
            }

            const { jobId } = await response.json();
            // Redirect to the builder page
            router.push(`/builder?jobId=${jobId}`);

        } catch (error) {
            console.error('Failed to connect to the backend:', error);
            toast.error('Failed to connect to the backend. Is the server running?');
            setIsLoading(false);
        }
	};

	return (
		<div className="flex w-full flex-col items-center gap-16">
			{/* Main Input Section */}
			<div className="flex w-full max-w-3xl flex-col items-center gap-8 px-4 text-center">
				<div className="space-y-3">
					<h1 className="text-3xl font-semibold text-zinc-100 md:text-4xl">
						Describe what you want to build
					</h1>
					<p className="text-base text-zinc-400 md:text-lg">
						Sketch your product vision, and we&apos;ll turn it into a working stack in minutes.
					</p>
				</div>
				<ChatInput
					rows={6}
					variant="default"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onSubmit={handleSubmit}
					loading={isLoading}
					onStop={() => setIsLoading(false)}
				>
					<ChatInputTextArea placeholder={animatedPlaceholder || "Tell us about your app..."} />
					<ChatInputSubmit aria-label="Generate" />
				</ChatInput>
			</div>

			{/* Projects Grid Section */}
			<div className="w-full">
				<ProjectsGrid />
			</div>
		</div>
	);
}

export { AppGeneratorSection }
