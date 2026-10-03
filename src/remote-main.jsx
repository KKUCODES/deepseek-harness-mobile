import React from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteApp } from './RemoteApp.jsx';
import { installRemotePlatform } from './remote-platform.mjs';
import installRemoteUrl from './remote-url-platform.cjs';
import '@upstream/ui-theme/src/styles/base.css';
import '@upstream/ui-theme/src/styles/design-platform.css';
import '@upstream/ui-theme/src/styles/gradient-shadow-text.css';
import '@upstream/ui-theme/src/styles/corner-shape.css';
import './ui/mobile.css';
import './ui/ordinary-product.css';
import '../docs/design/ordinary-preview/remote.css';
import './ui/remote-product.css';

installRemotePlatform();
installRemoteUrl();
createRoot(document.getElementById('app')).render(<RemoteApp />);
