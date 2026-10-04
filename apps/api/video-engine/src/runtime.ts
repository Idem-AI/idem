/**
 * Runtime partagé : la seule copie de React de la page.
 *
 * Le moteur et chaque addon importent `react` / `react-dom` ; au paquet, ces
 * imports sont redirigés vers window.__IDEM_RT__ (cf. video.engine.ts). Chargé
 * en premier, avant les addons et le moteur.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JSX from 'react/jsx-runtime';

const w = window as unknown as Record<string, unknown>;
w.__IDEM_RT__ = { React, ReactDOM, ReactDOMClient, JSX };
w.__IDEM_ADDONS__ = w.__IDEM_ADDONS__ || {};
