// Punto de entrada del panel de administración (/admin).
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/sora';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import './estilos/tokens.css';
import './estilos/panel.css';

import { iniciarApp } from './app';

const raiz = document.getElementById('app');
if (raiz) void iniciarApp(raiz);
