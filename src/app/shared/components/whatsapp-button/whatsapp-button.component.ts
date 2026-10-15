import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

// WhatsApp's own click-to-chat links (wa.me) take a bare international phone number, no "+" and
// no spaces/dashes/parens — and for a Mexican number specifically, no leading "1" either
// (WhatsApp dropped that requirement in 2021), just the country code 52 prepended. Phone fields
// across the app have no real format validation (agent-signup only checks minLength(7)), so real
// stored numbers vary — 9, 10, 11 digits have all been seen in practice, not just the clean
// 10-digit case. Only skip prepending when the number already starts with 52 and is long enough
// to actually contain it (someone who typed their own country code); otherwise always prepend,
// even for an off-length number, rather than leaving it with no country code at all — a 52-less
// link is guaranteed to fail, while a mis-length one at least has a chance of reaching the right
// chat if the visitor needs to tweak it.
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('52') && digits.length > 10 ? digits : `52${digits}`;
}

// The recognizable WhatsApp "call bubble" glyph on a brand-green pill — reused across every
// contact point (agent, agency, listing) so it reads as the same affordance everywhere.
@Component({
  selector: 'app-whatsapp-button',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './whatsapp-button.component.html',
  styleUrl: './whatsapp-button.component.css'
})
export class WhatsAppButtonComponent {
  @Input({ required: true }) phone!: string;
  // Pre-filled message text the visitor can edit before sending — e.g. mentioning which
  // listing/agent/agency they're reaching out about, so the recipient has context immediately.
  @Input() message = '';
  // Overrides the default "Enviar WhatsApp" label when a caller needs different wording.
  @Input() label?: string;

  get whatsappUrl(): string {
    const number = toWhatsAppNumber(this.phone ?? '');
    const text = this.message?.trim();
    return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  }
}
