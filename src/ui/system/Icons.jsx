import React from 'react';
import phone from '../assets/remote/phone.svg';
import edit from '../assets/remote/edit.svg';
import scan from '../assets/remote/scan.svg';
import image from '../assets/remote/image.svg';
import chevron from '../assets/remote/chevron.svg';
import chevronLight from '../assets/remote/chevron-light.svg';
import back from '../assets/remote/back.svg';
import more from '../assets/remote/more.svg';
import link from '../assets/remote/link.svg';
import lock from '../assets/remote/lock.svg';
import monitor from '../assets/remote/monitor.svg';
import folder from '../assets/remote/folder.svg';
import arrow from '../assets/remote/arrow.svg';
import loader from '../assets/remote/loader.svg';
import check from '../assets/remote/check.svg';
import alert from '../assets/remote/alert.svg';

const icons = { phone, edit, scan, image, chevron, chevronLight, back, more, link, lock, monitor, folder, arrow, loader, check, alert };

/** 原 Figma 矢量以 mask 使用，尺寸和颜色分别由组件与主题控制。 */
export function DesignIcon({ name, size = 24, className = '' }) {
  return <span aria-hidden="true" className={`dshm-icon ${className}`} style={{ width: size, height: size, maskImage: `url(${JSON.stringify(icons[name])})`, WebkitMaskImage: `url(${JSON.stringify(icons[name])})` }}/>;
}
