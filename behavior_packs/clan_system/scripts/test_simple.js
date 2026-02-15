import { world } from '@minecraft/server';

console.warn('[TEST] Script de teste carregado');

world.beforeEvents.chatSend.subscribe((event) => {
    console.warn('[TEST] Chat detectado:', event.message);
    event.sender.sendMessage('§aTeste funcionando!');
});
