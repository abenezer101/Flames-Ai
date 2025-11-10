"use client";

import { Xterm } from 'xterm-react';
import { useEffect, useRef } from 'react';
import 'xterm/css/xterm.css';

interface TerminalProps {
    className?: string;
    onTerminalInit?: (term: any) => void;
}

// This is a simple, static component for now.
// We will later make it dynamic by passing an xterm.js Terminal instance.
export function Terminal({ className, onTerminalInit }: TerminalProps) {
    const termRef = useRef(null);

    useEffect(() => {
        if (termRef.current && onTerminalInit) {
            onTerminalInit((termRef.current as any).terminal);
        }
    }, [onTerminalInit]);

    return (
        <div className={className}>
            <Xterm />
        </div>
    );
}
