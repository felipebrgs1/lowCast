import { createFileRoute } from '@tanstack/react-router';
import { convertFileSrc } from '@tauri-apps/api/core';
import { AppWindow, FileText, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import type { ClipboardEntry } from '@/lib/database';
import { type Application, useAppsStore } from '@/stores/appsStore';
import { useClipboardStore } from '@/stores/clipboardStore';

export const Route = createFileRoute('/')({
    component: Index,
});

function Index() {
    const [query, setQuery] = useState('');

    const {
        entries: clipboardEntries,
        loadHistory,
        search: searchClipboard,
        startListening,
        stopListening,
        copyToClipboard,
    } = useClipboardStore();

    const {
        filteredApps,
        loadApplications,
        search: searchApps,
        launchApp,
    } = useAppsStore();

    useEffect(() => {
        loadHistory();
        loadApplications();
        startListening();

        return () => {
            stopListening();
        };
    }, [loadHistory, loadApplications, startListening, stopListening]);

    useEffect(() => {
        searchClipboard(query);
        searchApps(query);
    }, [query, searchClipboard, searchApps]);

    // Limitar resultados
    const limitedClipboard = clipboardEntries.slice(0, 5);
    const limitedApps = filteredApps.slice(0, 8);

    const handleLaunchApp = async (app: Application) => {
        await launchApp(app);
        // Opcional: fechar a janela ou limpar a busca
    };

    const handleCopyClipboard = async (entry: ClipboardEntry) => {
        await copyToClipboard(entry);
    };

    return (
        <div className='h-full w-full bg-background/50 backdrop-blur-xl'>
            <Command
                shouldFilter={false}
                className='rounded-none border-0 bg-transparent'
            >
                <CommandInput
                    placeholder='Search for apps and commands...'
                    value={query}
                    onValueChange={setQuery}
                    className='text-lg h-14 border-none focus:ring-0'
                />
                <CommandList className='max-h-[calc(100vh-3.5rem)] pb-2'>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {limitedApps.length > 0 && (
                        <CommandGroup heading='Applications'>
                            {limitedApps.map((app) => (
                                <CommandItem
                                    key={app.desktop_file}
                                    onSelect={() => handleLaunchApp(app)}
                                    className='h-12'
                                >
                                    <div className='flex items-center gap-3 w-full'>
                                        <div className='flex h-8 w-8 items-center justify-center rounded bg-muted/50'>
                                            {app.icon ? (
                                                <img
                                                    src={convertFileSrc(
                                                        app.icon,
                                                    )}
                                                    alt={app.name}
                                                    className='h-6 w-6 object-contain'
                                                    onError={(e) => {
                                                        e.currentTarget.style.display =
                                                            'none';
                                                        e.currentTarget.nextElementSibling?.classList.remove(
                                                            'hidden',
                                                        );
                                                    }}
                                                />
                                            ) : null}
                                            <AppWindow
                                                className={`h-5 w-5 text-muted-foreground ${app.icon ? 'hidden' : ''}`}
                                            />
                                        </div>
                                        <div className='flex flex-col'>
                                            <span className='font-medium'>
                                                {app.name}
                                            </span>
                                            {app.description && (
                                                <span className='text-xs text-muted-foreground line-clamp-1'>
                                                    {app.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <CommandShortcut>↵</CommandShortcut>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {limitedApps.length > 0 && limitedClipboard.length > 0 && (
                        <CommandSeparator />
                    )}

                    {limitedClipboard.length > 0 && (
                        <CommandGroup heading='Clipboard History'>
                            {limitedClipboard.map((entry) => (
                                <CommandItem
                                    key={entry.id}
                                    onSelect={() => handleCopyClipboard(entry)}
                                    className='h-12'
                                >
                                    <div className='flex items-center gap-3 w-full'>
                                        <div className='flex h-8 w-8 items-center justify-center rounded bg-muted/50'>
                                            {entry.content_type === 'text' ? (
                                                <FileText className='h-5 w-5 text-muted-foreground' />
                                            ) : (
                                                <ImageIcon className='h-5 w-5 text-muted-foreground' />
                                            )}
                                        </div>
                                        <div className='flex flex-col flex-1 min-w-0'>
                                            <span className='font-medium truncate'>
                                                {entry.content_type === 'text'
                                                    ? (
                                                          entry.preview ||
                                                          entry.content
                                                      ).replace(/\n/g, ' ')
                                                    : 'Image'}
                                            </span>
                                            <span className='text-xs text-muted-foreground'>
                                                {new Date(
                                                    entry.created_at,
                                                ).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                    <CommandShortcut>↵</CommandShortcut>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </Command>
        </div>
    );
}
