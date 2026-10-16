'use client';

import { useState } from 'react';
import type { SellerContact } from '@/types';

/** WhatsApp wants country code + digits. A bare 10-digit number is assumed to be Indian. Returns null when unsure. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return digits.length >= 8 ? digits : null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

/** Seller contact details with one-tap actions. Used on the listing page and inside the chat. */
export default function ContactCard({ contact }: { contact: SellerContact }) {
  const [copied, setCopied] = useState('');
  const wa = contact.phone ? whatsappNumber(contact.phone) : null;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied`);
    } catch {
      setCopied('Could not copy. Select the text and copy it instead.');
    }
    window.setTimeout(() => setCopied(''), 2500);
  }

  return (
    <div className="contact-card">
      <p className="eyebrow">Seller contact</p>
      <p className="contact-line"><span>Name</span><strong>{contact.name}</strong></p>
      {contact.email && <p className="contact-line"><span>Email</span><a href={`mailto:${contact.email}`}>{contact.email}</a></p>}
      {contact.phone && <p className="contact-line"><span>Phone</span><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a></p>}
      <div className="contact-actions">
        {contact.phone && <a className="btn btn-primary btn-sm" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>CALL</a>}
        {wa && <a className="btn btn-outline btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WHATSAPP<span className="sr-only"> (opens in a new tab)</span></a>}
        {contact.email && <a className="btn btn-outline btn-sm" href={`mailto:${contact.email}`}>EMAIL</a>}
        {contact.phone && <button type="button" className="btn btn-outline btn-sm" onClick={() => copy('Phone', contact.phone as string)}>COPY PHONE</button>}
        {contact.email && <button type="button" className="btn btn-outline btn-sm" onClick={() => copy('Email', contact.email as string)}>COPY EMAIL</button>}
      </div>
      <p className="contact-copied" role="status">{copied}</p>
      <p className="contact-note">Meet on campus and check the item before paying.</p>
    </div>
  );
}
