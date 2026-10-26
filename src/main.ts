import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installAudioUnlock } from './app/audio/engine';

// Antes de arrancar Angular: el desbloqueo del audio escucha el gesto real aunque la página aún no
// esté hidratada (PLAN §4.9).
installAudioUnlock(document);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
