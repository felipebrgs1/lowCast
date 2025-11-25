import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    isRegistered,
    register,
    unregister,
} from '@tauri-apps/plugin-global-shortcut';
import { useEffect, useRef } from 'react';

export function useGlobalShortcut(shortcut = 'Alt+Space') {
    const isRegisteredRef = useRef(false);

    useEffect(() => {
        const setupShortcut = async () => {
            try {
                // Verificar se já está registrado
                const alreadyRegistered = await isRegistered(shortcut);
                if (alreadyRegistered) {
                    await unregister(shortcut);
                }

                // Registrar o shortcut
                await register(shortcut, async (event) => {
                    if (event.state === 'Pressed') {
                        const window = getCurrentWindow();
                        const isVisible = await window.isVisible();

                        if (isVisible) {
                            await window.hide();
                        } else {
                            await window.show();
                            await window.setFocus();
                        }
                    }
                });

                isRegisteredRef.current = true;
                console.log(`Global shortcut ${shortcut} registrado`);
            } catch (error) {
                console.error('Erro ao registrar shortcut:', error);
            }
        };

        setupShortcut();

        return () => {
            if (isRegisteredRef.current) {
                unregister(shortcut).catch(console.error);
                isRegisteredRef.current = false;
            }
        };
    }, [shortcut]);
}
