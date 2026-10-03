import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileComposer } from '../../src/ui/MobileComposer.jsx';
import '../../src/ui/mobile.css';

function Probe() {
  const [value, setValue] = useState(''), [checked, setChecked] = useState(false);
  const IconButton = ({ label, children, ...props }) => <button aria-label={label} {...props}>{children}</button>;
  return <main className="app">
    <section className="conversation" aria-label="测试记录">
      <div style={{ height: 900 }}>聊天记录</div>
      <label style={{ display: 'block', padding: 24 }}><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>继续验证</label>
    </section>
    <MobileComposer value={value} onChange={setValue} IconButton={IconButton} onSend={() => {}} onAttach={() => {}}/>
  </main>;
}
createRoot(document.getElementById('app')).render(<Probe/>);
