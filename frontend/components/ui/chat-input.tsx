"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { ArrowRight } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import type React from "react";
import { createContext, useContext } from "react";

interface ChatInputContextValue {
	value?: string;
	onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
	onSubmit?: () => void;
	loading?: boolean;
	onStop?: () => void;
	variant?: "default" | "unstyled";
	rows?: number;
}

const ChatInputContext = createContext<ChatInputContextValue>({});

interface ChatInputProps extends Omit<ChatInputContextValue, "variant"> {
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "unstyled";
	rows?: number;
}

function ChatInput({
	children,
	className,
	variant = "default",
	value,
	onChange,
	onSubmit,
	loading,
	onStop,
	rows = 4,
}: ChatInputProps) {
	const contextValue: ChatInputContextValue = {
		value,
		onChange,
		onSubmit,
		loading,
		onStop,
		variant,
		rows,
	};

	const content = (
		<div className="flex w-full items-end gap-4">
			{children}
		</div>
	);

	return (
		<ChatInputContext.Provider value={contextValue}>
			{variant === "default" ? (
				<div className={cn("w-full", className)}>
					<div className="rainbow-border rounded-[28px] p-[2px]">
						<div className="chat-surface relative flex w-full flex-col gap-4 rounded-[24px] bg-zinc-950/70 px-6 py-6 shadow-[0_0_40px_rgba(59,130,246,0.18)] backdrop-blur-xl">
							{content}
						</div>
					</div>
				</div>
			) : (
				<div className={cn("flex items-start gap-2 w-full", className)}>{children}</div>
			)}
		</ChatInputContext.Provider>
	);
}

ChatInput.displayName = "ChatInput";

interface ChatInputTextAreaProps extends React.ComponentProps<typeof Textarea> {
	value?: string;
	onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
	onSubmit?: () => void;
	variant?: "default" | "unstyled";
}

function ChatInputTextArea({
	onSubmit: onSubmitProp,
	value: valueProp,
	onChange: onChangeProp,
	className,
	variant: variantProp,
	...props
}: ChatInputTextAreaProps) {
	const context = useContext(ChatInputContext);
	const value = valueProp ?? context.value ?? "";
	const onChange = onChangeProp ?? context.onChange;
	const onSubmit = onSubmitProp ?? context.onSubmit;
	const rows = context.rows ?? 4;

	// Convert parent variant to textarea variant unless explicitly overridden
	const variant =
		variantProp ?? (context.variant === "default" ? "unstyled" : "default");

	const textareaRef = useTextareaResize(value, rows);
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!onSubmit) {
			return;
		}
		if (e.key === "Enter" && !e.shiftKey) {
			if (typeof value !== "string" || value.trim().length === 0) {
				return;
			}
			e.preventDefault();
			onSubmit();
		}
	};

	return (
		<Textarea
			ref={textareaRef}
			{...props}
			value={value}
			onChange={onChange}
			onKeyDown={handleKeyDown}
			className={cn(
				"max-h-[600px] min-h-[220px] w-full resize-none overflow-x-hidden bg-transparent px-0 py-4 text-lg leading-relaxed text-zinc-100 placeholder:text-zinc-400",
				variant === "unstyled" &&
					"border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
				className,
			)}
			rows={rows}
		/>
	);
}

ChatInputTextArea.displayName = "ChatInputTextArea";

interface ChatInputSubmitProps extends React.ComponentProps<typeof RainbowButton> {
	onSubmit?: () => void;
	loading?: boolean;
	onStop?: () => void;
}

function ChatInputSubmit({
	onSubmit: onSubmitProp,
	loading: loadingProp,
	onStop: onStopProp,
	className,
	...props
}: ChatInputSubmitProps) {
	const context = useContext(ChatInputContext);
	const loading = loadingProp ?? context.loading;
	const onStop = onStopProp ?? context.onStop;
	const onSubmit = onSubmitProp ?? context.onSubmit;

	if (loading && onStop) {
		return (
			<RainbowButton
				onClick={onStop}
				className={cn(
					"flex items-center gap-2 group/arrow border-t border-white/20 pt-2",
					className,
				)}
				{...props}
			>
				Stop
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-label="Stop"
				>
					<title>Stop</title>
					<rect x="6" y="6" width="12" height="12" />
				</svg>
			</RainbowButton>
		);
	}

	const isDisabled =
		typeof context.value !== "string" || context.value.trim().length === 0;

	return (
		<RainbowButton
			className={cn(
				"flex items-center gap-2 group/arrow border-t border-white/20 pt-2 transition-all",
				isDisabled && "opacity-50 cursor-not-allowed",
				!isDisabled && "opacity-100",
				className,
			)}
			disabled={isDisabled}
			onClick={(event) => {
				event.preventDefault();
				if (!isDisabled) {
					onSubmit?.();
				}
			}}
			{...props}
		>
			Build
			<ArrowRight className="h-5 w-5 transition-all duration-300 group-hover/arrow:translate-x-1" />
		</RainbowButton>
	);
}

ChatInputSubmit.displayName = "ChatInputSubmit";

export { ChatInput, ChatInputTextArea, ChatInputSubmit };
