"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTextareaResize } from "@/hooks/use-textarea-resize";
import { ArrowUpIcon } from "lucide-react";
import type React from "react";
import { createContext, useContext } from "react";

interface BuilderInputContextValue {
	value?: string;
	onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
	onSubmit?: () => void;
	loading?: boolean;
	onStop?: () => void;
	variant?: "default" | "unstyled";
	rows?: number;
}

const BuilderInputContext = createContext<BuilderInputContextValue>({});

interface BuilderInputProps extends Omit<BuilderInputContextValue, "variant"> {
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "unstyled";
	rows?: number;
}

function BuilderInput({
	children,
	className,
	variant = "default",
	value,
	onChange,
	onSubmit,
	loading,
	onStop,
	rows = 1,
}: BuilderInputProps) {
	const contextValue: BuilderInputContextValue = {
		value,
		onChange,
		onSubmit,
		loading,
		onStop,
		variant,
		rows,
	};

	return (
		<BuilderInputContext.Provider value={contextValue}>
			<div
				className={cn(
					variant === "default" &&
						"flex flex-col w-full p-2 rounded-2xl border border-input bg-transparent focus-within:ring-1 focus-within:ring-red-500 focus-within:outline-none",
					variant === "unstyled" && "flex flex-col gap-2 w-full",
					className,
				)}
			>
				{children}
			</div>
		</BuilderInputContext.Provider>
	);
}

BuilderInput.displayName = "BuilderInput";

interface BuilderInputTextAreaProps extends React.ComponentProps<typeof Textarea> {
	value?: string;
	onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
	onSubmit?: () => void;
	variant?: "default" | "unstyled";
}

function BuilderInputTextArea({
	onSubmit: onSubmitProp,
	value: valueProp,
	onChange: onChangeProp,
	className,
	variant: variantProp,
	...props
}: BuilderInputTextAreaProps) {
	const context = useContext(BuilderInputContext);

	const value = valueProp ?? context.value ?? "";
	const onChange = onChangeProp ?? context.onChange;
	const onSubmit = onSubmitProp ?? context.onSubmit;
	const rows = context.rows ?? 1;

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
				"max-h-[400px] min-h-0 resize-none overflow-x-hidden",
				variant === "unstyled" &&
					"flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
				className,
			)}
			rows={rows}
		/>
	);
}

BuilderInputTextArea.displayName = "BuilderInputTextArea";

interface BuilderInputSubmitProps extends React.ComponentProps<typeof Button> {
	onSubmit?: () => void;
	loading?: boolean;
	onStop?: () => void;
}

function BuilderInputSubmit({
	onSubmit: onSubmitProp,
	loading: loadingProp,
	onStop: onStopProp,
	className,
	...props
}: BuilderInputSubmitProps) {
	const context = useContext(BuilderInputContext);

	const loading = loadingProp ?? context.loading;
	const onStop = onStopProp ?? context.onStop;
	const onSubmit = onSubmitProp ?? context.onSubmit;

	if (loading && onStop) {
		return (
			<Button
				onClick={onStop}
				className={cn(
					"shrink-0 rounded-full p-0 w-7 h-7 flex items-center justify-center border bg-white text-black hover:bg-gray-100 border-gray-300",
					className,
				)}
				{...props}
			>
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
					<rect x="7" y="6" width="10" height="10" />
				</svg>
			</Button>
		);
	}

	const isDisabled =
		typeof context.value !== "string" || context.value.trim().length === 0;

	return (
		<Button
			className={cn(
				"shrink-0 rounded-full p-0 w-7 h-7 flex items-center justify-center border bg-white text-black hover:bg-gray-100 border-gray-300",
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
			<ArrowUpIcon className="w-5 h-5" />
		</Button>
	);
}

BuilderInputSubmit.displayName = "BuilderInputSubmit";

export { BuilderInput, BuilderInputTextArea, BuilderInputSubmit };
