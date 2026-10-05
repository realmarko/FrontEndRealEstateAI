// Minimal ambient types for Google Identity Services (GIS) — no official @types package exists
// for it (unlike @types/google.maps, already a dependency), so this declares just the surface
// load-google-identity.ts and the login/register components actually call. Augments the same
// global `google` namespace @types/google.maps already declares.
declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }

  interface GsiButtonConfiguration {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
}
