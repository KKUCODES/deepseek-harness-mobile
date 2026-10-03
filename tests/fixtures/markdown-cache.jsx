import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OrdinaryMarkdown } from '../../src/ordinary-rendering.jsx';

function Fixture() {
  const [tick, setTick] = useState(0), [tail, setTail] = useState('');
  const history = Array.from({ length: 80 }, (_, i) => `第 ${i} 段：共享聊天历史需要保留已经完成的排版。`).join('\n\n');
  return <><button onClick={() => setTick(tick + 1)}>更新无关状态</button><output>{tick}</output>
    <button onClick={() => setTail(tail + '\n\n追加正在生成的段落。')}>继续生成</button>
    <section aria-label="历史"><OrdinaryMarkdown text={history}/></section>
    <section aria-label="流式"><OrdinaryMarkdown text={history + tail} streaming/></section>
  </>;
}
createRoot(document.getElementById('app')).render(<Fixture/>);
