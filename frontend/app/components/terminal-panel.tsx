"use client";

import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
    terminal: Terminal;
    className?: string;
}

export function TerminalPanel({ terminal, className }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const fitAddon = useRef(new FitAddon());

    useEffect(() => {
        if (terminalRef.current && !terminal.element) {
            terminal.loadAddon(fitAddon.current);
            terminal.open(terminalRef.current);
            fitAddon.current.fit();
        }

        const handleResize = () => {
            fitAddon.current.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            // Do not dispose of the terminal here, as it's managed by the parent
        };
    }, [terminal]);

    return (
        <div className={`w-full h-full bg-[#1e1e1e] p-2 ${className || ''}`} ref={terminalRef} />
    );
}
