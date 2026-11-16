import { startHost } from './plugin-host.jsx';
import { OrdinaryApp } from './OrdinaryApp.jsx';
import '@upstream/ui-theme/src/styles/base.css';
import '@upstream/ui-theme/src/styles/design-platform.css';
import '@upstream/ui-theme/src/styles/gradient-shadow-text.css';
import '@upstream/ui-theme/src/styles/corner-shape.css';
import './ui/mobile.css';
import './ui/ordinary-product.css';

await startHost(props => <LocalizedApp host={props.host}><RemoteErrorBoundary logDomain="ordinary" onRecover={() => location.reload()}><OrdinaryApp {...props}/></RemoteErrorBoundary></LocalizedApp>);
import React from 'react';
import { LocalizedApp } from './ui/locale.jsx';
import { RemoteErrorBoundary } from './ui/RemoteRecovery.jsx';
