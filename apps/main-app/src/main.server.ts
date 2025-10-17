import { bootstrapApplication } from '@angular/platform-browser';
import { config } from './app/app.config.server';
import { App } from './app/app';

const bootstrap = () => bootstrapApplication(App, config);

export default bootstrap;
