import { useEffect, useState } from 'react';
import { api, img } from './api.js';

/* Admin-managed offers/ads. Hidden when there are none or the API is unreachable. */
export default function Banners() {
  const [list, setList] = useState([]);
  useEffect(() => {
    let live = true;
    const load = () => api('/banners').then((d) => live && Array.isArray(d) && setList(d)).catch(() => {});
    load();
    const id = setInterval(load, 120000);
    return () => { live = false; clearInterval(id); };
  }, []);
  if (!list.length) return null;
  return <section className="banners" aria-label="Offers">
    {list.map((b) => {
      const href = b.serviceId ? `/service-request?service_id=${b.serviceId}` : undefined;
      const Tag = href ? 'a' : 'div';
      return <Tag key={b.id} className="banner" style={{ background: b.color }} href={href}>
        <span className="banner-text">
          <b>{b.title}</b>
          {b.subtitle && <span>{b.subtitle}</span>}
          {b.coupon && <em className="banner-code">{b.percent ? `${b.percent}% off · ` : ''}Use code {b.coupon}</em>}
        </span>
        {b.img && <img src={img(b.img)} alt="" loading="lazy" />}
      </Tag>;
    })}
  </section>;
}
